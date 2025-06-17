const express = require("express");
const router = express.Router();
const service = require("./vehicleTracker-service");

router.post("/register", async (req, res) => {
  const { epc, plateNo, vehicleName } = req.body;

  if (!epc) {
    return res.status(400).json({ error: "EPC is required" });
  }

  try {
    const result = await service.registerVehicle({ epc, plateNo, vehicleName });
    res.json(result);
  } catch (err) {
    console.error("Error in /register route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
