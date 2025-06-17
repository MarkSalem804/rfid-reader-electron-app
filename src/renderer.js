const { ipcRenderer } = require("electron");
const vehicleTracker = require("./backend/vehicleTracker-service");

// Store vehicle entries
const vehicleEntries = new Map();

// Function to update the vehicle table
async function updateVehicleTable() {
  try {
    const timeLogs = await vehicleTracker.getAllTimeLogs();
    const tbody = document.getElementById("vehicle-entries");
    if (!tbody) return; // Guard against missing element

    tbody.innerHTML = ""; // Clear existing entries

    timeLogs.forEach((log) => {
      const row = document.createElement("tr");

      // Plate Number
      const plateCell = document.createElement("td");
      plateCell.textContent = log.vehicle?.plateNo || "-";
      row.appendChild(plateCell);

      // Time In
      const timeInCell = document.createElement("td");
      timeInCell.textContent = log.timeIn
        ? new Date(log.timeIn).toLocaleTimeString()
        : "-";
      row.appendChild(timeInCell);

      // Time Out
      const timeOutCell = document.createElement("td");
      timeOutCell.textContent = log.timeOut
        ? new Date(log.timeOut).toLocaleTimeString()
        : "-";
      row.appendChild(timeOutCell);

      // Status
      const statusCell = document.createElement("td");
      let status;
      if (log.timeIn && log.timeOut) {
        status = "COMPLETED";
        statusCell.className = "status-completed";
      } else if (log.timeOut) {
        status = "OUT";
        statusCell.className = "status-inactive";
      } else {
        status = "IN";
        statusCell.className = "status-active";
      }
      statusCell.textContent = status;
      row.appendChild(statusCell);

      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching time logs:", error);
  }
}

// Show logs view
function showLogsView() {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="logs-container">
      <h2>System Logs</h2>
      <div id="logs-list">
        <!-- Logs will be added here dynamically -->
      </div>
    </div>
  `;
}

// Show vehicles view
function showVehiclesView() {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="vehicles-container">
      <h2>Vehicle Management</h2>
      <div class="vehicle-list" id="vehicle-list">
        <!-- Vehicle list will be added here dynamically -->
      </div>
    </div>
  `;
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Navigation event listeners
  const logsBtn = document.getElementById("logs-btn");
  const vehiclesBtn = document.getElementById("vehicles-btn");
  const adminBtn = document.getElementById("admin-btn");

  if (logsBtn) logsBtn.addEventListener("click", showLogsView);
  if (vehiclesBtn) vehiclesBtn.addEventListener("click", showVehiclesView);
  if (adminBtn)
    adminBtn.addEventListener("click", () => {
      window.location.href = "src/pages/login/index.html";
    });

  // Load initial view
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="content-wrapper">
        <div class="main-section">
            <div class="vehicle-table-container">
                <h2>
                    <i class="fas fa-car-side" style="margin-right: 10px;"></i>
                    Vehicle Entries
                </h2>
                <table class="vehicle-table">
                    <thead>
                        <tr>
                            <th>Plate Number</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="vehicle-entries">
                        <!-- Vehicle entries will be added here dynamically -->
                    </tbody>
                </table>
            </div>
        </div>

        <div class="logs-section" style="margin-top: -1px;">
            <h2>
                <i class="fas fa-history" style="margin-right: 10px;"></i>
                Recent Logs
            </h2>
            <div class="logs-container" id="logs-list">
                <!-- Logs will be added here dynamically -->
            </div>
        </div>
    </div>
  `;

  // Initial load of the table
  updateVehicleTable();
});

// Handle RFID data
ipcRenderer.on("rfid-data", (event, data) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "Processing data...";
  }
});

// Handle RFID results
ipcRenderer.on("rfid-result", (event, data) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "waiting for data";
  }

  // Parse the result data
  const match = data.match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z) - (\w+) for (.+)/
  );
  if (match) {
    const [_, timestamp, action, plateNo] = match;
    const entry = vehicleEntries.get(plateNo) || {};

    if (action === "IN") {
      entry.timeIn = new Date(timestamp).toLocaleTimeString();
      entry.timeOut = null;
    } else if (action === "OUT") {
      entry.timeOut = new Date(timestamp).toLocaleTimeString();
    }

    vehicleEntries.set(plateNo, entry);
    updateVehicleTable();
  }
});
