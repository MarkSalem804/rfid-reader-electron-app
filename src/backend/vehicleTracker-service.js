const db = require("./vehicleTracker-data");
const userAuth = require("./Users/auth");

// Called when a tag is scanned
async function handleTagScan(epc) {
  try {
    const vehicle = await db.getVehicleByEPC(epc);
    if (!vehicle) {
      return { status: "not found", epc };
    }

    const openLog = await db.getOpenTimeLog(vehicle.id);

    if (openLog && !openLog.timeOut) {
      console.log("Vehicle is exiting...");
    } else {
      console.log("Vehicle is entering...");
    }

    if (openLog && !openLog.timeOut) {
      // Vehicle is exiting
      await db.updateTimeOut(openLog.id);
      return { status: "timeout", vehicle };
    } else {
      // Vehicle is entering
      await db.createTimeIn(vehicle.id);
      return { status: "timein", vehicle };
    }
  } catch (err) {
    console.error("Error processing tag:", err);
    return { status: "error", message: err.message };
  }
}

// Called when manually registering a vehicle
async function addVehicle(data) {
  try {
    const newVehicle = await db.registerVehicle(data);
    return newVehicle;
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return { success: false, error: error.message };
  }
}

// Add RFID tag to existing vehicle
async function addRfidTagToVehicle(vehicleId, epc, tagType = "EasyTrip") {
  try {
    const result = await db.addRfidTagToVehicle(vehicleId, epc, tagType);
    return result;
  } catch (error) {
    console.error("Error adding RFID tag:", error);
    return { success: false, error: error.message };
  }
}

// Get all RFID tags for a vehicle
async function getVehicleRfidTags(vehicleId) {
  try {
    return await db.getVehicleRfidTags(vehicleId);
  } catch (error) {
    console.error("Error getting vehicle RFID tags:", error);
    return { success: false, error: error.message };
  }
}

// Get all RFID tags
async function getAllRfidTags() {
  try {
    return await db.getAllRfidTags();
  } catch (error) {
    console.error("Error getting all RFID tags:", error);
    return { success: false, error: error.message };
  }
}

// Deactivate RFID tag
async function deactivateRfidTag(epc) {
  try {
    return await db.deactivateRfidTag(epc);
  } catch (error) {
    console.error("Error deactivating RFID tag:", error);
    return { success: false, error: error.message };
  }
}

// Alias for addVehicle to match routes
async function registerVehicle(data) {
  return await addVehicle(data);
}

async function getAllTimeLogs() {
  try {
    const time = await db.getAllVehicleEntries();
    return time;
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return { success: false, error: error.message };
  }
}

// Generate comprehensive report
async function generateReport(options = {}) {
  try {
    const {
      startDate = new Date(new Date().setDate(new Date().getDate() - 30)), // Default to last 30 days
      endDate = new Date(),
      reportType = "comprehensive",
      vehicleId = null,
    } = options;

    let report = {
      generatedAt: new Date(),
      dateRange: { startDate, endDate },
      summary: {},
      details: [],
    };

    switch (reportType) {
      case "daily":
        report = await generateDailyReport(startDate, endDate);
        break;
      case "vehicle":
        report = await generateVehicleReport(vehicleId, startDate, endDate);
        break;
      case "parking":
        report = await generateParkingReport();
        break;
      case "comprehensive":
      default:
        report = await generateComprehensiveReport(startDate, endDate);
        break;
    }

    return report;
  } catch (error) {
    console.error("Error generating report:", error);
    return { success: false, error: error.message };
  }
}

// Generate daily activity report
async function generateDailyReport(startDate, endDate) {
  const timeLogs = await db.getTimeLogsByDateRange(startDate, endDate);
  const parkedVehicles = await db.getCurrentlyParkedVehicles();

  // Group by date
  const dailyStats = {};
  timeLogs.forEach((log) => {
    const date = log.timeIn.toISOString().split("T")[0];
    if (!dailyStats[date]) {
      dailyStats[date] = {
        date,
        totalEntries: 0,
        totalExits: 0,
        vehicles: new Set(),
        averageDuration: 0,
        durations: [],
      };
    }

    dailyStats[date].totalEntries++;
    dailyStats[date].vehicles.add(log.vehicleId);

    if (log.timeOut) {
      dailyStats[date].totalExits++;
      const duration = new Date(log.timeOut) - new Date(log.timeIn);
      dailyStats[date].durations.push(duration);
    }
  });

  // Calculate averages
  Object.values(dailyStats).forEach((day) => {
    day.uniqueVehicles = day.vehicles.size;
    day.vehicles = undefined; // Remove Set from output
    if (day.durations.length > 0) {
      day.averageDuration = Math.round(
        day.durations.reduce((a, b) => a + b, 0) /
          day.durations.length /
          1000 /
          60
      ); // in minutes
    }
    day.durations = undefined; // Remove array from output
  });

  return {
    type: "daily",
    generatedAt: new Date(),
    dateRange: { startDate, endDate },
    summary: {
      totalDays: Object.keys(dailyStats).length,
      totalEntries: timeLogs.length,
      totalExits: timeLogs.filter((log) => log.timeOut).length,
      currentlyParked: parkedVehicles.length,
    },
    dailyStats: Object.values(dailyStats),
  };
}

// Generate vehicle-specific report
async function generateVehicleReport(vehicleId, startDate, endDate) {
  const timeLogs = await db.getTimeLogsByDateRange(startDate, endDate);
  const vehicleLogs = vehicleId
    ? timeLogs.filter((log) => log.vehicleId === vehicleId)
    : timeLogs;

  const vehicleStats = {};
  vehicleLogs.forEach((log) => {
    const vehicleKey = log.vehicle?.plateNo || `Vehicle ${log.vehicleId}`;
    if (!vehicleStats[vehicleKey]) {
      vehicleStats[vehicleKey] = {
        plateNo: log.vehicle?.plateNo,
        vehicleName: log.vehicle?.vehicleName,
        rfidTags: log.vehicle?.rfidTags || [],
        totalEntries: 0,
        totalExits: 0,
        totalDuration: 0,
        averageDuration: 0,
        durations: [],
        lastEntry: null,
        lastExit: null,
      };
    }

    vehicleStats[vehicleKey].totalEntries++;
    vehicleStats[vehicleKey].lastEntry = log.timeIn;

    if (log.timeOut) {
      vehicleStats[vehicleKey].totalExits++;
      vehicleStats[vehicleKey].lastExit = log.timeOut;
      const duration = new Date(log.timeOut) - new Date(log.timeIn);
      vehicleStats[vehicleKey].durations.push(duration);
      vehicleStats[vehicleKey].totalDuration += duration;
    }
  });

  // Calculate averages
  Object.values(vehicleStats).forEach((vehicle) => {
    if (vehicle.durations.length > 0) {
      vehicle.averageDuration = Math.round(
        vehicle.totalDuration / vehicle.durations.length / 1000 / 60
      ); // in minutes
    }
    vehicle.totalDuration = Math.round(vehicle.totalDuration / 1000 / 60); // in minutes
    vehicle.durations = undefined; // Remove array from output
  });

  return {
    type: "vehicle",
    generatedAt: new Date(),
    dateRange: { startDate, endDate },
    summary: {
      totalVehicles: Object.keys(vehicleStats).length,
      totalEntries: vehicleLogs.length,
      totalExits: vehicleLogs.filter((log) => log.timeOut).length,
    },
    vehicleStats: Object.values(vehicleStats),
  };
}

// Generate parking status report
async function generateParkingReport() {
  const parkedVehicles = await db.getCurrentlyParkedVehicles();
  const parkedVehiclesList = parkedVehicles.map((log) => {
    const duration = Math.round(
      (new Date() - new Date(log.timeIn)) / 1000 / 60
    ); // in minutes
    return {
      plateNo: log.vehicle?.plateNo,
      vehicleName: log.vehicle?.vehicleName,
      rfidTags: log.vehicle?.rfidTags || [],
      timeIn: log.timeIn,
      duration,
    };
  });

  return {
    type: "parking",
    generatedAt: new Date(),
    summary: {
      currentlyParked: parkedVehiclesList.length,
      parkedVehicles: parkedVehiclesList,
    },
  };
}

// Generate comprehensive report
async function generateComprehensiveReport(startDate, endDate) {
  const timeLogs = await db.getTimeLogsByDateRange(startDate, endDate);
  const parkedVehicles = await db.getCurrentlyParkedVehicles();
  const allVehicles = await db.getAllVehiclesWithStats();

  // Calculate summary statistics
  const totalVehicles = allVehicles.length;
  const currentlyParked = parkedVehicles.length;
  const totalEntries = timeLogs.length;
  const totalExits = timeLogs.filter((log) => log.timeOut).length;

  return {
    type: "comprehensive",
    generatedAt: new Date(),
    dateRange: { startDate, endDate },
    summary: {
      totalVehicles,
      currentlyParked,
      totalEntries,
      totalExits,
    },
    sections: {
      daily: await generateDailyReport(startDate, endDate),
      vehicles: await generateVehicleReport(null, startDate, endDate),
      parking: await generateParkingReport(),
    },
  };
}

// Export report in different formats
async function exportReport(report, format = "json") {
  try {
    switch (format.toLowerCase()) {
      case "csv":
        return generateCSV(report);
      case "json":
      default:
        return JSON.stringify(report, null, 2);
    }
  } catch (error) {
    console.error("Error exporting report:", error);
    throw error;
  }
}

// Generate CSV format
function generateCSV(report) {
  // Implementation for CSV generation
  // This would need to be implemented based on your specific needs
  return "CSV format not yet implemented";
}

// User authentication
async function authenticateUser(email, password) {
  return await userAuth.checkUserCredentials(email, password);
}

// User registration
async function registerUser(email, password, role) {
  return await userAuth.registerUser(email, password, role);
}

// Extract EPC tag from raw hex data
function extractEpcTag(rawHex) {
  const match = rawHex.match(/e2[\da-f]{22}/i);
  return match ? match[0].toLowerCase() : null;
}

// Check if tag is registered
async function isTagRegistered(epc) {
  return await db.isTagRegistered(epc);
}

// Get all vehicles with stats
async function getAllVehiclesWithStats() {
  return await db.getAllVehiclesWithStats();
}

module.exports = {
  handleTagScan,
  addVehicle,
  addRfidTagToVehicle,
  getVehicleRfidTags,
  getAllRfidTags,
  deactivateRfidTag,
  registerVehicle,
  getAllTimeLogs,
  generateReport,
  exportReport,
  authenticateUser,
  registerUser,
  extractEpcTag,
  isTagRegistered,
  getAllVehiclesWithStats,
};
