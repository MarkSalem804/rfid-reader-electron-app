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
    icon: path.join(__dirname, "src/assets/deped_logo_icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "src/renderer.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Disable cache
  mainWindow.webContents.session.clearCache();

  mainWindow.loadFile("index.html");

  mainWindow.webContents.openDevTools();
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
const MIN_INTERVAL_MS = 30 * 1000; // 30 seconds

// TCP CLIENT FUNCTION
function connectToRFIDReader() {
  const client = new net.Socket();

  client.connect(49152, "10.10.100.254", () => {
    console.log("[✅] Connected to RFID Reader");
  });

  client.on("data", async (data) => {
    const hexData = data.toString("hex");
    console.log(`[RAW TAG] ${hexData}`); // Log the raw tag data

    // Updated regex to handle multiple tag patterns (e2, ee, etc.)
    let match = hexData.match(/(e[2-9][\da-f]{22})/i); // looks for valid EPC patterns starting with e2-e9
    let tagId;

    if (match) {
      tagId = match[0].toLowerCase();
    } else {
      // Fallback: try to find any 24-character hex pattern that might be an EPC
      match = hexData.match(/([e-f][\da-f][\da-f]{22})/i);
      if (match) {
        tagId = match[0].toLowerCase();
      } else {
        tagId = hexData;
      }
    }

    if (tagId) {
      const timestamp = new Date().toISOString();

      // Always log the tag in the UI
      mainWindow.webContents.send(
        "rfid-data",
        `${timestamp} - Tag ID: ${tagId}`
      );

      const now = Date.now();
      if (tagTimestamps.has(tagId)) {
        const lastTime = tagTimestamps.get(tagId);
        if (now - lastTime < MIN_INTERVAL_MS) {
          console.log(`[⏱] Skipped duplicate scan for ${tagId} within 30 secs`);
          return; // 🚫 Skip processing this tag
        }
      }
      tagTimestamps.set(tagId, now);

      // Check if tag is registered
      const isRegistered = await vehicleService.isTagRegistered(tagId);
      if (!isRegistered) {
        // Just log as unregistered, do not process
        mainWindow.webContents.send(
          "rfid-result",
          `${timestamp} - Unregistered EPC: ${tagId}`
        );
        return;
      }

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
        `[${new Date().toISOString()}] Ignored packet (no tag, no conversion): ${hexData}`
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

// Admin login handler
ipcMain.handle("admin-login", async (event, { email, password }) => {
  try {
    const user = await vehicleService.authenticateUser(email, password);
    if (user) {
      return { success: true, message: "Login successful", user };
    } else {
      return { success: false, message: "Invalid email or password" };
    }
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: "Login failed: " + error.message };
  }
});

ipcMain.handle("register-user", async (event, { email, password, role }) => {
  try {
    const result = await vehicleService.registerUser(email, password, role);
    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
});
