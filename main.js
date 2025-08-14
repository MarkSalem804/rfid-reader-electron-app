if (require("electron-squirrel-startup")) return;

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const net = require("net");
const fs = require("fs");
const { exec } = require("child_process");
const mysql = require("mysql2/promise");
const { URL } = require("url");
const XLSX = require("xlsx");

// Import service layer
const vehicleService = require("./src/backend/vehicleTracker-service");
const vehicleData = require("./src/backend/vehicleTracker-data");

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

  // Clean up old tag timestamps every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [epc, ts] of tagTimestamps.entries()) {
      if (now - ts > MIN_INTERVAL_MS) {
        tagTimestamps.delete(epc);
      }
    }
  }, 5 * 60 * 1000);

  // Periodic network health check every 30 seconds
  setInterval(async () => {
    try {
      await pingNetwork();
    } catch (error) {
      console.log("[NETWORK] Ping failed:", error.message);
    }
  }, 30 * 1000);
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

// Add signal strength tracking variables
const signalStrengthLog = new Map(); // Store signal strength history
const MIN_SIGNAL_LENGTH = 20; // Minimum expected data length for good signal

// Add comprehensive signal tracking
const signalStats = {
  totalReads: 0,
  strongSignals: 0,
  weakSignals: 0,
  failedReads: 0,
  averageDataLength: 0,
  signalHistory: [],
};

// Add connection health monitoring variables
const connectionHealth = {
  connectionAttempts: 0,
  successfulConnections: 0,
  failedConnections: 0,
  connectionSuccessRate: 0,
  lastConnectionTime: null,
  connectionDuration: 0,
  totalUptime: 0,
  totalDowntime: 0,
  consecutiveFailures: 0,
  maxConsecutiveFailures: 0,
  networkLatency: [],
  lastPingTime: null,
  connectionHistory: [],
  alerts: [],
};

// Add unknown tags tracking
const unknownTagsLog = new Map(); // key: EPC, value: tag data object
const MAX_UNKNOWN_TAGS = 1000; // Maximum number of unknown tags to store

// Connection health thresholds
const CONNECTION_THRESHOLDS = {
  MAX_CONSECUTIVE_FAILURES: 5,
  MIN_SUCCESS_RATE: 70,
  MAX_LATENCY_MS: 1000,
  ALERT_COOLDOWN_MS: 30000, // 30 seconds between alerts
};

function analyzeSignalStrength(data, hexData) {
  const dataLength = data.length;
  const timestamp = new Date();

  // Calculate signal quality metrics
  const signalQuality = {
    timestamp,
    dataLength,
    hexLength: hexData.length,
    hasValidPattern: /(e[2-9][\da-f]{22})/i.test(hexData),
    signalCategory: categorizeSignal(dataLength),
    glassInterference: detectGlassInterference(dataLength, hexData),
  };

  // Update statistics
  signalStats.totalReads++;
  signalStats.signalHistory.push(signalQuality);

  if (signalQuality.signalCategory === "STRONG") {
    signalStats.strongSignals++;
  } else if (
    signalQuality.signalCategory === "WEAK" ||
    signalQuality.signalCategory === "VERY_WEAK"
  ) {
    signalStats.weakSignals++;
  }

  // Calculate running average
  signalStats.averageDataLength =
    (signalStats.averageDataLength * (signalStats.totalReads - 1) +
      dataLength) /
    signalStats.totalReads;

  // Keep only last 1000 readings to prevent memory issues
  if (signalStats.signalHistory.length > 1000) {
    signalStats.signalHistory.shift();
  }

  return signalQuality;
}

function categorizeSignal(dataLength) {
  if (dataLength >= 24) return "STRONG";
  if (dataLength >= 18) return "MEDIUM";
  if (dataLength >= 12) return "WEAK";
  return "VERY_WEAK";
}

function detectGlassInterference(dataLength, hexData) {
  // Glass interference indicators
  const indicators = {
    veryWeakSignal: dataLength < 12,
    incompleteData: hexData.length < 24,
    noValidPattern: !/(e[2-9][\da-f]{22})/i.test(hexData),
    possibleReflection: dataLength > 0 && dataLength < 8,
  };

  return indicators;
}

// Connection Health Monitoring Functions
function updateConnectionHealth(success, error = null, latency = null) {
  const timestamp = new Date();

  connectionHealth.connectionAttempts++;

  if (success) {
    connectionHealth.successfulConnections++;
    connectionHealth.consecutiveFailures = 0;
    connectionHealth.lastConnectionTime = timestamp;

    if (latency) {
      connectionHealth.networkLatency.push(latency);
      // Keep only last 100 latency measurements
      if (connectionHealth.networkLatency.length > 100) {
        connectionHealth.networkLatency.shift();
      }
    }
  } else {
    connectionHealth.failedConnections++;
    connectionHealth.consecutiveFailures++;

    if (
      connectionHealth.consecutiveFailures >
      connectionHealth.maxConsecutiveFailures
    ) {
      connectionHealth.maxConsecutiveFailures =
        connectionHealth.consecutiveFailures;
    }
  }

  // Calculate success rate
  connectionHealth.connectionSuccessRate =
    (connectionHealth.successfulConnections /
      connectionHealth.connectionAttempts) *
    100;

  // Record connection history
  connectionHealth.connectionHistory.push({
    timestamp,
    success,
    error: error?.message || null,
    latency,
    consecutiveFailures: connectionHealth.consecutiveFailures,
  });

  // Keep only last 1000 connection records
  if (connectionHealth.connectionHistory.length > 1000) {
    connectionHealth.connectionHistory.shift();
  }

  // Check for alerts
  checkConnectionAlerts();

  // Send update to renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("connection-health-update", connectionHealth);
  }
}

function checkConnectionAlerts() {
  const now = Date.now();
  const lastAlert = connectionHealth.alerts[connectionHealth.alerts.length - 1];

  // Check if enough time has passed since last alert
  if (
    lastAlert &&
    now - lastAlert.timestamp < CONNECTION_THRESHOLDS.ALERT_COOLDOWN_MS
  ) {
    return;
  }

  let alertMessage = null;
  let alertLevel = "info";

  // Check consecutive failures threshold
  if (
    connectionHealth.consecutiveFailures >=
    CONNECTION_THRESHOLDS.MAX_CONSECUTIVE_FAILURES
  ) {
    alertMessage = `🚨 CRITICAL: ${connectionHealth.consecutiveFailures} consecutive connection failures!`;
    alertLevel = "critical";
  }
  // Check success rate threshold
  else if (
    connectionHealth.connectionSuccessRate <
    CONNECTION_THRESHOLDS.MIN_SUCCESS_RATE
  ) {
    alertMessage = `⚠️ WARNING: Connection success rate is ${connectionHealth.connectionSuccessRate.toFixed(
      1
    )}% (below ${CONNECTION_THRESHOLDS.MIN_SUCCESS_RATE}%)`;
    alertLevel = "warning";
  }
  // Check latency threshold
  else if (connectionHealth.networkLatency.length > 0) {
    const avgLatency =
      connectionHealth.networkLatency.reduce((a, b) => a + b, 0) /
      connectionHealth.networkLatency.length;
    if (avgLatency > CONNECTION_THRESHOLDS.MAX_LATENCY_MS) {
      alertMessage = `⚠️ WARNING: High network latency detected: ${avgLatency.toFixed(
        0
      )}ms`;
      alertLevel = "warning";
    }
  }

  if (alertMessage) {
    const alert = {
      timestamp: now,
      message: alertMessage,
      level: alertLevel,
      consecutiveFailures: connectionHealth.consecutiveFailures,
      successRate: connectionHealth.connectionSuccessRate,
    };

    connectionHealth.alerts.push(alert);

    // Send alert to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("connection-alert", alert);
    }

    // Log alert to console
    console.log(`[${alertLevel.toUpperCase()}] ${alertMessage}`);
  }
}

function getConnectionHealthStats() {
  const avgLatency =
    connectionHealth.networkLatency.length > 0
      ? connectionHealth.networkLatency.reduce((a, b) => a + b, 0) /
        connectionHealth.networkLatency.length
      : 0;

  return {
    ...connectionHealth,
    averageLatency: avgLatency,
    uptimePercentage:
      connectionHealth.connectionAttempts > 0
        ? (connectionHealth.successfulConnections /
            connectionHealth.connectionAttempts) *
          100
        : 0,
  };
}

function pingNetwork() {
  const { exec } = require("child_process");
  const rfidSettings = getRfidSettings();

  return new Promise((resolve) => {
    const platform = process.platform;
    const command =
      platform === "win32"
        ? `ping -n 1 ${rfidSettings.ip}`
        : `ping -c 1 ${rfidSettings.ip}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ reachable: false, latency: null, error: error.message });
        return;
      }

      // Extract latency from ping output
      let latency = null;
      if (platform === "win32") {
        const match = stdout.match(/time[=<](\d+)ms/i);
        if (match) latency = parseInt(match[1]);
      } else {
        const match = stdout.match(/time=(\d+\.?\d*) ms/i);
        if (match) latency = parseFloat(match[1]);
      }

      resolve({ reachable: true, latency, output: stdout });
    });
  });
}

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
  let client;
  const rfidSettings = getRfidSettings();

  function doConnect() {
    const startTime = Date.now();
    client = new net.Socket();
    client.setKeepAlive(true, 10000); // Enable TCP keep-alive (10s)

    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
      console.log(
        `[⏰] Connection timeout to ${rfidSettings.ip}:${rfidSettings.port}`
      );
      updateConnectionHealth(false, { message: "Connection timeout" });
      client.destroy();
      cleanupAndReconnect();
    }, 10000); // 10 second timeout

    client.connect(rfidSettings.port, rfidSettings.ip, () => {
      clearTimeout(connectionTimeout);
      const latency = Date.now() - startTime;
      console.log(
        `[✅] Connected to RFID Reader at ${rfidSettings.ip}:${rfidSettings.port} (${latency}ms)`
      );
      updateConnectionHealth(true, null, latency);
    });

    client.on("data", async (data) => {
      const hexData = data.toString("hex");

      // Analyze signal strength
      const signalQuality = analyzeSignalStrength(data, hexData);

      // Log detailed signal information
      console.log(`[SIGNAL ANALYSIS] ${signalQuality.timestamp.toISOString()}`);
      console.log(`  Data Length: ${signalQuality.dataLength} bytes`);
      console.log(`  Signal Category: ${signalQuality.signalCategory}`);
      console.log(
        `  Glass Interference: ${JSON.stringify(
          signalQuality.glassInterference
        )}`
      );

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
            console.log(
              `[⏱] Skipped duplicate scan for ${tagId} within 30 secs`
            );
            return; // 🚫 Skip processing this tag
          } else {
            // It's the same tag, and it's been more than 30 seconds
            // Fetch vehicle info
            let vehicle = null;
            try {
              vehicle = await vehicleData.getVehicleByEPC(tagId);
            } catch (e) {
              console.error("Error fetching vehicle for manual override:", e);
            }
            // Comment out manual override prompt in RFID scan logic
            // mainWindow.webContents.send("manual-override-prompt", {
            //   plateNo: vehicle?.plateNo || tagId,
            //   vehicleId: vehicle?.id,
            //   lastLog: null, // Optionally fetch last log if needed
            // });
            // Continue to process the scan as normal if you want, or return here if you want only manual override after 30s
            // return;
          }
        }
        tagTimestamps.set(tagId, now);

        // Check if tag is registered
        const isRegistered = await vehicleService.isTagRegistered(tagId);
        if (!isRegistered) {
          // Store unknown tag for monitoring
          const unknownTagData = {
            epc: tagId,
            rawData: hexData,
            dataLength: data.length,
            signalStrength: analyzeSignalStrength(data, hexData).signalCategory,
            timestamp: timestamp,
          };

          // Store in unknown tags log (limit to prevent memory issues)
          if (unknownTagsLog.size >= MAX_UNKNOWN_TAGS) {
            // Remove oldest entry
            const firstKey = unknownTagsLog.keys().next().value;
            unknownTagsLog.delete(firstKey);
          }
          unknownTagsLog.set(tagId, unknownTagData);

          // Send to frontend for real-time updates
          mainWindow.webContents.send("unknown-tag-detected", unknownTagData);

          // Log as unregistered
          mainWindow.webContents.send(
            "rfid-result",
            `${timestamp} - Unregistered EPC: ${tagId} (stored for monitoring)`
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
        // Handle packets that don't contain valid EPC patterns but might be RFID data
        if (hexData.length > 0 && hexData !== "000000000000000000000000") {
          const timestamp = new Date().toISOString();
          const unknownTagData = {
            epc: "INVALID_PATTERN",
            rawData: hexData,
            dataLength: data.length,
            signalStrength: analyzeSignalStrength(data, hexData).signalCategory,
            timestamp: timestamp,
          };

          // Store in unknown tags log with a unique key
          const invalidKey = `invalid_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          if (unknownTagsLog.size >= MAX_UNKNOWN_TAGS) {
            // Remove oldest entry
            const firstKey = unknownTagsLog.keys().next().value;
            unknownTagsLog.delete(firstKey);
          }
          unknownTagsLog.set(invalidKey, unknownTagData);

          // Send to frontend for real-time updates
          mainWindow.webContents.send("unknown-tag-detected", unknownTagData);

          console.log(
            `[${timestamp}] Invalid RFID packet stored for monitoring: ${hexData}`
          );
        } else {
          console.log(
            `[${new Date().toISOString()}] Ignored empty/null packet: ${hexData}`
          );
        }
      }
    });

    client.on("close", () => {
      console.log(
        "[❌] Connection to RFID Reader closed. Reconnecting in 5 seconds..."
      );
      updateConnectionHealth(false, { message: "Connection closed" });
      cleanupAndReconnect();
    });

    client.on("error", (err) => {
      console.error("[🚫] TCP error:", err.message);
      updateConnectionHealth(false, err);
      client.destroy();
      cleanupAndReconnect();
    });
  }

  function cleanupAndReconnect() {
    if (client) {
      client.removeAllListeners();
      client.destroy();
      client = null;
    }
    setTimeout(() => {
      doConnect();
    }, 5000);
  }

  doConnect();
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

// Add signal monitoring IPC handlers
ipcMain.handle("get-signal-stats", async () => {
  return {
    success: true,
    stats: signalStats,
    recentSignals: signalStats.signalHistory.slice(-50), // Last 50 readings
  };
});

ipcMain.handle("get-signal-quality", async () => {
  const recent = signalStats.signalHistory.slice(-100);
  const qualityMetrics = {
    strongSignalPercentage: (
      (signalStats.strongSignals / signalStats.totalReads) *
      100
    ).toFixed(2),
    weakSignalPercentage: (
      (signalStats.weakSignals / signalStats.totalReads) *
      100
    ).toFixed(2),
    averageDataLength: signalStats.averageDataLength.toFixed(2),
    totalReads: signalStats.totalReads,
    lastHourReads: recent.filter(
      (s) => Date.now() - s.timestamp.getTime() < 3600000
    ).length,
  };

  return { success: true, metrics: qualityMetrics };
});

// Send real-time signal updates to renderer
setInterval(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const recent = signalStats.signalHistory.slice(-10);
    mainWindow.webContents.send("signal-update", {
      recentSignals: recent,
      currentStats: {
        strongSignals: signalStats.strongSignals,
        weakSignals: signalStats.weakSignals,
        totalReads: signalStats.totalReads,
      },
    });
  }
}, 5000); // Update every 5 seconds

// Send real-time connection health updates to renderer
setInterval(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "connection-health-update",
      getConnectionHealthStats()
    );
  }
}, 3000); // Update every 3 seconds

// Connection Health IPC Handlers
ipcMain.handle("get-connection-health", async () => {
  return {
    success: true,
    health: getConnectionHealthStats(),
  };
});

ipcMain.handle("ping-network", async () => {
  try {
    const pingResult = await pingNetwork();
    if (pingResult.reachable && pingResult.latency) {
      updateConnectionHealth(true, null, pingResult.latency);
    }
    return {
      success: true,
      result: pingResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle("reset-connection-stats", async () => {
  try {
    // Reset connection statistics
    connectionHealth.connectionAttempts = 0;
    connectionHealth.successfulConnections = 0;
    connectionHealth.failedConnections = 0;
    connectionHealth.connectionSuccessRate = 0;
    connectionHealth.consecutiveFailures = 0;
    connectionHealth.maxConsecutiveFailures = 0;
    connectionHealth.networkLatency = [];
    connectionHealth.connectionHistory = [];
    connectionHealth.alerts = [];

    return {
      success: true,
      message: "Connection statistics reset successfully",
    };
  } catch (error) {
    return { success: false, error: error.message };
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

ipcMain.handle(
  "export-timelogs-excel",
  async (event, { rows, startDate, endDate }) => {
    try {
      const headers = ["Vehicle Name", "Time In", "Time Out"];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Style header row (A1:C1) - try multiple approaches
      ["A1", "B1", "C1"].forEach((cell) => {
        if (!ws[cell]) return;

        // Method 1: Standard style
        ws[cell].s = {
          fill: { patternType: "solid", fgColor: { rgb: "C6EFCE" } },
          font: { bold: true, color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" },
        };

        // Method 2: Alternative style format
        if (!ws[cell].s) {
          ws[cell].s = {};
        }
        ws[cell].s.fill = { patternType: "solid", fgColor: { rgb: "C6EFCE" } };
        ws[cell].s.font = { bold: true };

        console.log(`Applied style to ${cell}:`, ws[cell].s);
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TimeLogs");

      // Try different write options
      const wbout = XLSX.write(wb, {
        bookType: "xlsx",
        type: "buffer",
        compression: true,
      });

      // Ask user where to save
      const { filePath } = await dialog.showSaveDialog({
        title: "Save Excel File",
        defaultPath: `timelogs-report_${startDate}_to_${endDate}.xlsx`,
        filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
      });
      if (!filePath) return { success: false, message: "Save cancelled" };

      require("fs").writeFileSync(filePath, wbout);
      return { success: true, message: "Exported successfully!" };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
);

// Unknown tags IPC handlers
ipcMain.handle("get-unknown-tags", async () => {
  try {
    return { success: true, tags: Array.from(unknownTagsLog.values()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("clear-unknown-tags", async () => {
  try {
    unknownTagsLog.clear();
    return { success: true, message: "Unknown tags log cleared successfully" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("export-unknown-tags", async () => {
  try {
    const tags = Array.from(unknownTagsLog.values());
    if (tags.length === 0) {
      return { success: false, message: "No unknown tags to export" };
    }

    const headers = [
      "EPC",
      "Raw Data",
      "Data Length",
      "Signal Strength",
      "Timestamp",
    ];
    const rows = tags.map((tag) => [
      tag.epc || "Unknown",
      tag.rawData || "N/A",
      tag.dataLength || "N/A",
      tag.signalStrength || "N/A",
      tag.timestamp,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UnknownTags");

    const wbout = XLSX.write(wb, {
      bookType: "xlsx",
      type: "buffer",
      compression: true,
    });

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Unknown Tags Report",
      defaultPath: `unknown-tags-report_${
        new Date().toISOString().split("T")[0]
      }.xlsx`,
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (!filePath) return { success: false, message: "Save cancelled" };

    require("fs").writeFileSync(filePath, wbout);
    return { success: true, message: "Unknown tags exported successfully!" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/*
ipcMain.on(
  "manual-override-submit",
  async (event, { vehicleId, plateNo, datetime }) => {
    try {
      // Fetch the last open log for this vehicle
      const lastOpenLog = await vehicleService.getOpenTimeLog(vehicleId);
      if (lastOpenLog && !lastOpenLog.timeOut) {
        // Set timeOut for the open log
        await vehicleService.updateTimeOutManual(lastOpenLog.id, datetime);
        mainWindow.webContents.send("manual-override-success", {
          plateNo,
          action: "timeOut",
          datetime,
        });
      } else {
        // Create a new timeIn log
        await vehicleService.createTimeInManual(vehicleId, datetime);
        mainWindow.webContents.send("manual-override-success", {
          plateNo,
          action: "timeIn",
          datetime,
        });
      }
    } catch (err) {
      mainWindow.webContents.send("manual-override-error", {
        plateNo,
        error: err.message,
      });
    }
  }
);
*/
