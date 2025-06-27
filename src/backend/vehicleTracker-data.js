const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

// Register a new vehicle with RFID tags
async function registerVehicle(data) {
  const { epc, plateNo, vehicleName, tagType = "EasyTrip" } = data;

  try {
    // Check if RFID tag already exists
    const existingTag = await prisma.rfidTag.findUnique({
      where: { epc },
      include: { vehicles: true },
    });

    if (existingTag) {
      return { status: "tag_exists", tag: existingTag };
    }

    // Create new vehicle and RFID tag
    const newVehicle = await prisma.vehicle.create({
      data: {
        plateNo,
        vehicleName,
        rfidTags: {
          create: {
            epc,
            tagType,
            isActive: true,
          },
        },
      },
      include: {
        rfidTags: true,
      },
    });

    return { status: "registered", vehicle: newVehicle };
  } catch (err) {
    console.error("registerVehicle error:", err);
    throw err;
  }
}

// Add RFID tag to existing vehicle
async function addRfidTagToVehicle(vehicleId, epc, tagType = "EasyTrip") {
  try {
    // Check if tag already exists
    const existingTag = await prisma.rfidTag.findUnique({ where: { epc } });
    if (existingTag) {
      return { status: "tag_exists", tag: existingTag };
    }

    // Create new tag and link to vehicle
    const newTag = await prisma.rfidTag.create({
      data: {
        epc,
        tagType,
        isActive: true,
        vehicles: {
          connect: { id: vehicleId },
        },
      },
    });

    return { status: "tag_added", tag: newTag };
  } catch (err) {
    console.error("addRfidTagToVehicle error:", err);
    throw err;
  }
}

// Get vehicle by EPC (now searches through RFID tags)
async function getVehicleByEPC(epc) {
  const rfidTag = await prisma.rfidTag.findUnique({
    where: { epc, isActive: true },
    include: {
      vehicles: true,
    },
  });

  return rfidTag?.vehicles[0] || null; // Return first vehicle associated with this tag
}

// Get all RFID tags for a vehicle
async function getVehicleRfidTags(vehicleId) {
  return await prisma.rfidTag.findMany({
    where: {
      vehicles: {
        some: { id: vehicleId },
      },
      isActive: true,
    },
  });
}

// Create time-in entry
async function createTimeIn(vehicleId) {
  console.log("[DEBUG] createTimeIn called with vehicleId:", vehicleId);
  const result = await prisma.timeLogs.create({
    data: {
      vehicleId,
      timeIn: new Date(),
    },
  });
  console.log("[DEBUG] createTimeIn result:", result);
  return result;
}

// Update the time-out field
async function updateTimeOut(logId) {
  console.log("[DEBUG] updateTimeOut called with logId:", logId);
  const result = await prisma.timeLogs.update({
    where: { id: logId },
    data: {
      timeOut: new Date(),
    },
  });
  console.log("[DEBUG] updateTimeOut result:", result);
  return result;
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
        vehicle: {
          include: {
            rfidTags: true,
          },
        },
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

// Get time logs within a date range
async function getTimeLogsByDateRange(startDate, endDate) {
  try {
    const fetchedData = await prisma.timeLogs.findMany({
      where: {
        timeIn: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        vehicle: {
          include: {
            rfidTags: true,
          },
        },
      },
      orderBy: {
        timeIn: "desc",
      },
    });
    return fetchedData;
  } catch (error) {
    throw new Error("Error getting time logs by date range: " + error.message);
  }
}

// Get all vehicles with their statistics and RFID tags
async function getAllVehiclesWithStats() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        timeLogs: {
          orderBy: {
            timeIn: "desc",
          },
        },
        rfidTags: {
          where: { isActive: true },
        },
        _count: {
          select: {
            timeLogs: true,
          },
        },
      },
    });
    return vehicles;
  } catch (error) {
    throw new Error("Error getting vehicles with stats: " + error.message);
  }
}

// Get vehicle statistics for a specific date range
async function getVehicleStatsByDateRange(startDate, endDate) {
  try {
    const stats = await prisma.timeLogs.groupBy({
      by: ["vehicleId"],
      where: {
        timeIn: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      _count: {
        id: true,
      },
      _avg: {
        // Calculate duration for completed trips
        // This would need to be calculated in the service layer
      },
    });
    return stats;
  } catch (error) {
    throw new Error("Error getting vehicle stats: " + error.message);
  }
}

// Get currently parked vehicles (vehicles with open time logs)
async function getCurrentlyParkedVehicles() {
  try {
    const parkedVehicles = await prisma.timeLogs.findMany({
      where: {
        timeOut: null,
      },
      include: {
        vehicle: {
          include: {
            rfidTags: true,
          },
        },
      },
      orderBy: {
        timeIn: "desc",
      },
    });
    return parkedVehicles;
  } catch (error) {
    throw new Error("Error getting parked vehicles: " + error.message);
  }
}

// Get daily summary statistics
async function getDailySummary(date) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const summary = await prisma.timeLogs.groupBy({
      by: ["vehicleId"],
      where: {
        timeIn: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _count: {
        id: true,
      },
    });

    return {
      date: date,
      totalEntries: summary.length,
      totalTimeLogs: summary.reduce((sum, item) => sum + item._count.id, 0),
    };
  } catch (error) {
    throw new Error("Error getting daily summary: " + error.message);
  }
}

// Check user credentials with hashed password
async function checkUserCredentials(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return false;
  // Compare hashed password
  const match = await bcrypt.compare(password, user.password);
  return match;
}

// Check if a vehicle with the given EPC exists (now searches through RFID tags)
async function isTagRegistered(epc) {
  const rfidTag = await prisma.rfidTag.findUnique({
    where: { epc, isActive: true },
    include: { vehicles: true },
  });
  return !!rfidTag && rfidTag.vehicles.length > 0;
}

// Get all RFID tags
async function getAllRfidTags() {
  return await prisma.rfidTag.findMany({
    include: {
      vehicles: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Deactivate RFID tag
async function deactivateRfidTag(epc) {
  return await prisma.rfidTag.update({
    where: { epc },
    data: { isActive: false },
  });
}

module.exports = {
  registerVehicle,
  addRfidTagToVehicle,
  getVehicleByEPC,
  getVehicleRfidTags,
  createTimeIn,
  updateTimeOut,
  getOpenTimeLog,
  getAllVehicleEntries,
  getTimeLogsByDateRange,
  getAllVehiclesWithStats,
  getVehicleStatsByDateRange,
  getCurrentlyParkedVehicles,
  getDailySummary,
  checkUserCredentials,
  isTagRegistered,
  getAllRfidTags,
  deactivateRfidTag,
};
