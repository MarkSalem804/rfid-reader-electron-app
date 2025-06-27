const express = require("express");
const router = express.Router();
const vehicleService = require("./vehicleTracker-service");

router.post("/register", async (req, res) => {
  const { epc, plateNo, vehicleName, tagType = "EasyTrip" } = req.body;

  if (!epc) {
    return res.status(400).json({ error: "EPC is required" });
  }

  try {
    const result = await vehicleService.registerVehicle({
      epc,
      plateNo,
      vehicleName,
      tagType,
    });
    res.json(result);
  } catch (err) {
    console.error("Error in /register route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add RFID tag to existing vehicle
router.post("/vehicles/:vehicleId/rfid-tags", async (req, res) => {
  const { vehicleId } = req.params;
  const { epc, tagType = "EasyTrip" } = req.body;

  if (!epc) {
    return res.status(400).json({ error: "EPC is required" });
  }

  try {
    const result = await vehicleService.addRfidTagToVehicle(
      parseInt(vehicleId),
      epc,
      tagType
    );
    res.json(result);
  } catch (err) {
    console.error("Error in /vehicles/:vehicleId/rfid-tags route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all RFID tags for a vehicle
router.get("/vehicles/:vehicleId/rfid-tags", async (req, res) => {
  const { vehicleId } = req.params;

  try {
    const result = await vehicleService.getVehicleRfidTags(parseInt(vehicleId));
    res.json(result);
  } catch (err) {
    console.error("Error in /vehicles/:vehicleId/rfid-tags route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all RFID tags
router.get("/rfid-tags", async (req, res) => {
  try {
    const result = await vehicleService.getAllRfidTags();
    res.json(result);
  } catch (err) {
    console.error("Error in /rfid-tags route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate RFID tag
router.delete("/rfid-tags/:epc", async (req, res) => {
  const { epc } = req.params;

  try {
    const result = await vehicleService.deactivateRfidTag(epc);
    res.json(result);
  } catch (err) {
    console.error("Error in /rfid-tags/:epc route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all time logs
router.get("/timelogs", async (req, res) => {
  try {
    const timeLogs = await vehicleService.getAllTimeLogs();
    res.json(timeLogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate report
router.post("/reports/generate", async (req, res) => {
  try {
    const { startDate, endDate, reportType, vehicleId } = req.body;
    const report = await vehicleService.generateReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      reportType,
      vehicleId,
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export report
router.post("/reports/export", async (req, res) => {
  try {
    const { report, format } = req.body;
    const exportedData = await vehicleService.exportReport(report, format);

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report-${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report-${
          new Date().toISOString().split("T")[0]
        }.json"`
      );
    }

    res.send(exportedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily report
router.get("/reports/daily", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await vehicleService.generateReport({
      startDate: startDate
        ? new Date(startDate)
        : new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate: endDate ? new Date(endDate) : new Date(),
      reportType: "daily",
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get vehicle report
router.get("/reports/vehicle", async (req, res) => {
  try {
    const { startDate, endDate, vehicleId } = req.query;
    const report = await vehicleService.generateReport({
      startDate: startDate
        ? new Date(startDate)
        : new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate: endDate ? new Date(endDate) : new Date(),
      reportType: "vehicle",
      vehicleId: vehicleId ? parseInt(vehicleId) : null,
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get parking report
router.get("/reports/parking", async (req, res) => {
  try {
    const report = await vehicleService.generateReport({
      reportType: "parking",
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
