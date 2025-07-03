const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");
const { exec } = require("child_process");
const mysql = require("mysql2/promise");
const { URL } = require("url");

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

// Helper function to get RFID settings from .env
function getRfidSettings() {
  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const portMatch = envContent.match(/^RFID_PORT\s*=\s*(.*)$/m);
    const ipMatch = envContent.match(/^READER_IP\s*=\s*(.*)$/m);

    return {
      port: portMatch ? parseInt(portMatch[1]) : 49152,
      ip: ipMatch ? ipMatch[1] : "10.10.100.254",
    };
  } catch (err) {
    console.warn(
      "[RFID] Error reading .env file, using defaults:",
      err.message
    );
    return { port: 49152, ip: "10.10.100.254" };
  }
}

// TCP CLIENT FUNCTION
function connectToRFIDReader() {
  const client = new net.Socket();
  const rfidSettings = getRfidSettings();

  client.connect(rfidSettings.port, rfidSettings.ip, () => {
    console.log(
      `[✅] Connected to RFID Reader at ${rfidSettings.ip}:${rfidSettings.port}`
    );
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

const envPath = path.join(__dirname, ".env"); // Adjust if your .env is elsewhere

ipcMain.handle("get-db-url", async () => {
  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^DATABASE_URL\s*=\s*(.*)$/m);
    return match ? match[1] : "";
  } catch (err) {
    return "";
  }
});

ipcMain.handle("set-db-url", async (event, newUrl) => {
  try {
    let envContent = fs.readFileSync(envPath, "utf-8");
    if (envContent.match(/^DATABASE_URL\s*=/m)) {
      envContent = envContent.replace(
        /^DATABASE_URL\s*=.*$/m,
        `DATABASE_URL=${newUrl}`
      );
    } else {
      envContent += `\nDATABASE_URL=${newUrl}\n`;
    }
    fs.writeFileSync(envPath, envContent, "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// RFID Settings handlers
ipcMain.handle("get-rfid-settings", async () => {
  try {
    const settings = getRfidSettings();
    return { success: true, settings };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("set-rfid-settings", async (event, { ip, port }) => {
  try {
    let envContent = fs.readFileSync(envPath, "utf-8");

    // Update or add READER_IP
    if (envContent.match(/^READER_IP\s*=/m)) {
      envContent = envContent.replace(/^READER_IP\s*=.*$/m, `READER_IP=${ip}`);
    } else {
      envContent += `\nREADER_IP=${ip}\n`;
    }

    // Update or add RFID_PORT
    if (envContent.match(/^RFID_PORT\s*=/m)) {
      envContent = envContent.replace(
        /^RFID_PORT\s*=.*$/m,
        `RFID_PORT=${port}`
      );
    } else {
      envContent += `\nRFID_PORT=${port}\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Test RFID connection handler - tests the app's connection to RFID reader
ipcMain.handle("test-rfid-connection", async (event, { ip, port }) => {
  try {
    const client = new net.Socket();
    let connectionEstablished = false;
    let dataReceived = false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        client.destroy();
        if (connectionEstablished) {
          resolve({
            success: true,
            message: "Connected to RFID reader (no data received yet)",
          });
        } else {
          resolve({
            success: false,
            error: "Connection timeout - RFID reader not responding",
          });
        }
      }, 5000); // 5 second timeout

      client.connect(port, ip, () => {
        clearTimeout(timeout);
        connectionEstablished = true;
        console.log(`[TEST] Connected to RFID reader at ${ip}:${port}`);

        // Send a test command or just wait for data
        setTimeout(() => {
          client.destroy();
          if (dataReceived) {
            resolve({
              success: true,
              message: "RFID reader connection established and receiving data",
            });
          } else {
            resolve({
              success: true,
              message: "Connected to RFID reader successfully",
            });
          }
        }, 2000); // Wait 2 seconds to see if we receive any data
      });

      client.on("data", (data) => {
        dataReceived = true;
        console.log(
          `[TEST] Received data from RFID reader: ${data.toString("hex")}`
        );
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        client.destroy();
        console.error(`[TEST] RFID connection error: ${err.message}`);
        resolve({
          success: false,
          error: `RFID reader connection failed: ${err.message}`,
        });
      });

      client.on("close", () => {
        console.log(`[TEST] RFID connection closed`);
      });
    });
  } catch (err) {
    console.error(`[TEST] RFID connection exception: ${err.message}`);
    return { success: false, error: `RFID connection error: ${err.message}` };
  }
});

// Test database connection handler
ipcMain.handle("test-db-connection", async (event, dbUrl) => {
  try {
    const connection = await mysql.createConnection({ uri: dbUrl });
    await connection.end();
    return { success: true, message: "Database connection established" };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Helper to parse DB name from URL using Node.js URL module
function getDbNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    // Remove leading slash from pathname
    return parsed.pathname.replace(/^\//, "");
  } catch (e) {
    return null;
  }
}

// IPC handler to check DB and run Prisma if needed (with detailed logging)
ipcMain.handle("check-and-init-db", async (event, dbUrl) => {
  const dbName = getDbNameFromUrl(dbUrl);
  if (!dbName) {
    console.error("[DB INIT] Invalid DB URL:", dbUrl);
    return { success: false, error: "Invalid DB URL" };
  }

  // Remove db name from URL for connection
  const baseUrl = dbUrl.replace(`/${dbName}`, "/");
  try {
    console.log("[DB INIT] Trying to connect to DB:", dbUrl);
    const connection = await mysql.createConnection({ uri: dbUrl });
    await connection.end();
    console.log("[DB INIT] Database exists:", dbName);
    return { success: true, message: "Database exists." };
  } catch (err) {
    console.warn(
      "[DB INIT] Database does not exist, will attempt to create:",
      dbName
    );
    try {
      // Connect to MySQL without the DB to create it
      const adminConn = await mysql.createConnection({ uri: baseUrl });
      await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await adminConn.end();
      console.log("[DB INIT] Database created:", dbName);

      return {
        success: true,
        message: "Database created.",
      };
    } catch (e) {
      console.error("[DB INIT] Error during DB creation:", e);
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  }
});

// Add after other ipcMain.handle blocks
ipcMain.handle("get-all-timelogs", async (event, options) => {
  try {
    const logs = await vehicleService.getAllTimeLogsForReport(options);
    return { success: true, logs };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
