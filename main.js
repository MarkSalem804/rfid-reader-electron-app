const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const net = require("net");

// Import service layer
const vehicleService = require("./src/backend/vehicleTracker-service");

// Enable hot reloading in development
try {
  require("electron-reloader")(module, {
    debug: false,
    watchRenderer: true,
  });
} catch (_) {
  console.log("Error hot reloading");
}

let mainWindow;

// Remove default menu
app.on("ready", () => {
  // Remove the default menu
  require("electron").Menu.setApplicationMenu(null);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "src/renderer.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Disable cache
  mainWindow.webContents.session.clearCache();

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();
  connectToRFIDReader();
  setInterval(() => {
    const now = Date.now();
    for (const [epc, ts] of tagTimestamps.entries()) {
      if (now - ts > MIN_INTERVAL_MS) {
        tagTimestamps.delete(epc);
      }
    }
  }, 5 * 60 * 1000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const tagTimestamps = new Map(); // key: EPC, value: timestamp
const MIN_INTERVAL_MS = 120 * 1000; // 2 minutes

// TCP CLIENT FUNCTION
function connectToRFIDReader() {
  const client = new net.Socket();

  client.connect(49152, "10.10.100.254", () => {
    console.log("[✅] Connected to RFID Reader");
  });

  client.on("data", async (data) => {
    const hexData = data.toString("hex");
    const match = hexData.match(/e2[\da-f]{22}/i); // looks for valid EPC

    if (match) {
      const tagId = match[0].toLowerCase(); // <- EPC tag
      const timestamp = new Date().toISOString();

      console.log(`[${timestamp}] Tag ID: ${tagId}`);
      mainWindow.webContents.send(
        "rfid-data",
        `${timestamp} - Tag ID: ${tagId}`
      );

      const now = Date.now();

      if (tagTimestamps.has(tagId)) {
        const lastTime = tagTimestamps.get(tagId);
        if (now - lastTime < MIN_INTERVAL_MS) {
          console.log(
            `[⏱] Skipped duplicate scan for ${tagId} within 1 minute`
          );
          return; // 🚫 Skip processing this tag
        }
      }

      // ✅ Update timestamp and proceed
      tagTimestamps.set(tagId, now);

      console.log(`[${timestamp}] Tag ID: ${tagId}`);
      mainWindow.webContents.send(
        "rfid-data",
        `${timestamp} - Tag ID: ${tagId}`
      );

      try {
        // ✅ Call service logic
        const result = await vehicleService.handleTagScan(tagId);
        console.log(`[🟢] Tag processed:`, result);

        mainWindow.webContents.send(
          "rfid-result",
          `${timestamp} - ${result.status.toUpperCase()} for ${
            result.vehicle?.plateNo || "Unknown Plate"
          }`
        );
      } catch (error) {
        console.error(`[🔴] Error processing tag: ${error.message}`);
        mainWindow.webContents.send(
          "rfid-error",
          `${timestamp} - Error: ${error.message}`
        );
      }
    } else {
      console.log(
        `[${new Date().toISOString()}] Ignored packet (no tag): ${hexData}`
      );
    }
  });

  client.on("close", () => {
    console.log("[❌] Connection to RFID Reader closed");
  });

  client.on("error", (err) => {
    console.error("[🚫] TCP error:", err.message);
  });
}
