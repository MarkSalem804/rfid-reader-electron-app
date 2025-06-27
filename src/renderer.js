const { ipcRenderer } = require("electron");
const vehicleTracker = require("./backend/vehicleTracker-service");

// Store vehicle entries
const vehicleEntries = new Map();
let currentPage = 1;
let rowsPerPage = 10;
const rowsPerPageOptions = [10, 20, 50];

// Function to update the vehicle table
async function updateVehicleTable(page = 1) {
  currentPage = page;
  try {
    const timeLogs = await vehicleTracker.getAllTimeLogs();
    const tbody = document.getElementById("vehicle-entries");
    if (!tbody) return; // Guard against missing element

    tbody.innerHTML = ""; // Clear existing entries

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedLogs = timeLogs.slice(startIndex, endIndex);

    paginatedLogs.forEach((log) => {
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

    updatePaginationControls(timeLogs.length);
  } catch (error) {
    console.error("Error fetching time logs:", error);
  }
}

function updatePaginationControls(totalLogs) {
  const paginationContainer = document.getElementById("pagination-controls");
  if (!paginationContainer) return;

  const totalPages = Math.ceil(totalLogs / rowsPerPage);
  paginationContainer.innerHTML = ""; // Clear existing controls

  // Rows per page selector
  const rowsSelectLabel = document.createElement("label");
  rowsSelectLabel.textContent = "Rows per page: ";
  rowsSelectLabel.style.color = "white";
  rowsSelectLabel.style.marginRight = "8px";
  const rowsSelect = document.createElement("select");
  rowsPerPageOptions.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    if (opt === rowsPerPage) option.selected = true;
    rowsSelect.appendChild(option);
  });
  rowsSelect.addEventListener("change", (e) => {
    rowsPerPage = parseInt(e.target.value, 10);
    updateVehicleTable(1);
  });
  paginationContainer.appendChild(rowsSelectLabel);
  paginationContainer.appendChild(rowsSelect);

  if (totalPages <= 1) return; // Don't show pagination if only one page

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.textContent = "Previous";
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener("click", () =>
    updateVehicleTable(currentPage - 1)
  );
  paginationContainer.appendChild(prevButton);

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const pageButton = document.createElement("button");
    pageButton.textContent = i;
    pageButton.disabled = i === currentPage;
    pageButton.addEventListener("click", () => updateVehicleTable(i));
    if (i === currentPage) {
      pageButton.classList.add("active");
    }
    paginationContainer.appendChild(pageButton);
  }

  // Next button
  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.disabled = currentPage === totalPages;
  nextButton.addEventListener("click", () =>
    updateVehicleTable(currentPage + 1)
  );
  paginationContainer.appendChild(nextButton);
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
                 <div id="pagination-controls" class="pagination-controls"></div>
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

  // Don't add raw RFID data to logs - only process valid events
});

// Handle RFID results
ipcRenderer.on("rfid-result", (event, data) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = "waiting for data";
  }

  // Parse the result data to extract vehicle info
  // Format from main.js: `${timestamp} - ${result.status.toUpperCase()} for ${result.vehicle?.plateNo || "Unknown Plate"}`
  const match = data.match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z) - (\w+) for (.+)/
  );

  if (match) {
    const [_, timestamp, action, plateNo] = match;
    const entry = vehicleEntries.get(plateNo) || {};

    if (action === "TIMEIN") {
      entry.timeIn = new Date(timestamp).toLocaleTimeString();
      entry.timeOut = null;

      // Add to recent logs with proper formatting
      addToRecentLogs(`${plateNo} - Vehicle Entered`, "success");
    } else if (action === "TIMEOUT") {
      entry.timeOut = new Date(timestamp).toLocaleTimeString();

      // Add to recent logs with proper formatting
      addToRecentLogs(`${plateNo} - Vehicle Exited`, "info");
    }

    vehicleEntries.set(plateNo, entry);
    updateVehicleTable();
  }
});

// Handle RFID errors
ipcRenderer.on("rfid-error", (event, data) => {
  // Only log actual errors, not unregistered tags
  if (!data.includes("Unregistered EPC")) {
    addToRecentLogs(data, "error");
  }
});

// Function to add entries to recent logs
function addToRecentLogs(message, type = "info") {
  const logsList = document.getElementById("logs-list");
  if (!logsList) return;

  const logEntry = document.createElement("div");
  logEntry.className = `log-entry log-${type}`;

  const timestamp = new Date().toLocaleTimeString();
  const icon =
    type === "success"
      ? "fa-sign-in-alt"
      : type === "error"
      ? "fa-exclamation-circle"
      : "fa-sign-out-alt";

  logEntry.innerHTML = `
    <div class="log-icon">
      <i class="fas ${icon}"></i>
    </div>
    <div class="log-content">
      <div class="log-message">${message}</div>
      <div class="log-time">${timestamp}</div>
    </div>
  `;

  // Add to the top of the list
  logsList.insertBefore(logEntry, logsList.firstChild);

  // Keep only the last 50 logs
  const logEntries = logsList.querySelectorAll(".log-entry");
  if (logEntries.length > 50) {
    logsList.removeChild(logEntries[logEntries.length - 1]);
  }
}
