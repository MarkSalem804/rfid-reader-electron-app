const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Register a new vehicle
async function registerVehicle(data) {
  const { epc, plateNo, vehicleName } = data;

  try {
    const existing = await prisma.vehicle.findUnique({ where: { epc } });

    if (existing) {
      return { status: "exists", vehicle: existing };
    }

    const newVehicle = await prisma.vehicle.create({
      data: {
        epc,
        plateNo,
        vehicleName,
      },
    });

    return { status: "registered", vehicle: newVehicle };
  } catch (err) {
    console.error("registerVehicle error:", err);
    throw err;
  }
}

// Get vehicle by EPC
async function getVehicleByEPC(epc) {
  return await prisma.vehicle.findUnique({ where: { epc } });
}

// Create time-in entry
async function createTimeIn(vehicleId) {
  return await prisma.timeLogs.create({
    data: {
      vehicleId,
      timeIn: new Date(),
    },
  });
}

// Update the time-out field
async function updateTimeOut(logId) {
  return await prisma.timeLogs.update({
    where: { id: logId },
    data: {
      timeOut: new Date(),
    },
  });
}

// Find the latest timeLog with no timeOut (open entry)
async function getOpenTimeLog(vehicleId) {
  return await prisma.timeLogs.findFirst({
    where: {
      vehicleId,
      timeOut: null,
    },
    orderBy: {
      timeIn: "desc",
    },
  });
}

async function getAllVehicleEntries() {
  try {
    const fetchedData = await prisma.timeLogs.findMany({
      include: {
        vehicle: true,
      },
      orderBy: {
        timeIn: "desc",
      },
    });
    return fetchedData;
  } catch (error) {
    throw new Error("Error getting time logs: " + error.message);
  }
}

module.exports = {
  registerVehicle,
  getVehicleByEPC,
  createTimeIn,
  updateTimeOut,
  getOpenTimeLog,
  getAllVehicleEntries,
};
