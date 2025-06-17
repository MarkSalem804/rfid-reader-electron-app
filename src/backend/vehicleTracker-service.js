const db = require("./vehicleTracker-data");

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

async function getAllTimeLogs() {
  try {
    const time = await db.getAllVehicleEntries();
    return time;
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  handleTagScan,
  addVehicle,
  getAllTimeLogs,
};
