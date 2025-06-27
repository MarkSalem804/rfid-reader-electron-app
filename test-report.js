const vehicleTracker = require("./src/backend/vehicleTracker-service");

async function testReportGeneration() {
  console.log("Testing Report Generation...\n");

  try {
    // Test 1: Generate comprehensive report
    console.log("1. Testing Comprehensive Report...");
    const comprehensiveReport = await vehicleTracker.generateReport({
      startDate: new Date(new Date().setDate(new Date().getDate() - 7)), // Last 7 days
      endDate: new Date(),
      reportType: "comprehensive",
    });
    console.log("✅ Comprehensive report generated successfully");
    console.log("Summary:", comprehensiveReport.summary);
    console.log("");

    // Test 2: Generate daily report
    console.log("2. Testing Daily Report...");
    const dailyReport = await vehicleTracker.generateReport({
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
      endDate: new Date(),
      reportType: "daily",
    });
    console.log("✅ Daily report generated successfully");
    console.log("Total days:", dailyReport.summary.totalDays);
    console.log("");

    // Test 3: Generate parking report
    console.log("3. Testing Parking Report...");
    const parkingReport = await vehicleTracker.generateReport({
      reportType: "parking",
    });
    console.log("✅ Parking report generated successfully");
    console.log("Currently parked:", parkingReport.summary.currentlyParked);
    console.log("");

    // Test 4: Export report to JSON
    console.log("4. Testing JSON Export...");
    const jsonExport = await vehicleTracker.exportReport(
      comprehensiveReport,
      "json"
    );
    console.log("✅ JSON export successful");
    console.log("Export length:", jsonExport.length, "characters");
    console.log("");

    // Test 5: Export report to CSV
    console.log("5. Testing CSV Export...");
    const csvExport = await vehicleTracker.exportReport(dailyReport, "csv");
    console.log("✅ CSV export successful");
    console.log("Export length:", csvExport.length, "characters");
    console.log("");

    console.log("🎉 All tests passed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test
testReportGeneration();
