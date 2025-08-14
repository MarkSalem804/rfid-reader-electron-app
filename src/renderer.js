const { ipcRenderer } = require("electron");

// Store vehicle entries
const vehicleEntries = new Map();
let currentPage = 1;
let rowsPerPage = 10;
const rowsPerPageOptions = [10, 20, 50];
let currentDateFilter = "all"; // "all" or "current"

// Function to update the vehicle table
async function updateVehicleTable(page = 1) {
  currentPage = page;
  try {
    const response = await ipcRenderer.invoke("get-all-timelogs", {});
    if (!response.success) {
      console.error("Failed to get time logs:", response.error);
      return;
    }
    let timeLogs = response.logs;
    if (!Array.isArray(timeLogs)) {
      console.error("timeLogs is not an array:", timeLogs);
      return;
    }

    // Apply date filtering
    if (currentDateFilter === "current") {
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const todayEnd = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      );

      timeLogs = timeLogs.filter((log) => {
        const logDate = new Date(log.timeOut || log.timeIn);
        return logDate >= todayStart && logDate < todayEnd;
      });
    }

    const tbody = document.getElementById("vehicle-entries");
    if (!tbody) return; // Guard against missing element

    tbody.innerHTML = ""; // Clear existing entries

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedLogs = timeLogs.slice(startIndex, endIndex);

    paginatedLogs.forEach((log, index) => {
      const row = document.createElement("tr");
      row.style.cssText = `
        background: ${index % 2 === 0 ? "#ffffff" : "#f8f9fa"};
        transition: background-color 0.2s;
      `;

      // Add hover effect
      row.addEventListener("mouseenter", () => {
        row.style.background = "#e3f2fd";
      });

      row.addEventListener("mouseleave", () => {
        row.style.background = index % 2 === 0 ? "#ffffff" : "#f8f9fa";
      });

      // Plate Number
      const plateCell = document.createElement("td");
      plateCell.textContent = log.vehicle?.plateNo || "-";
      plateCell.style.cssText =
        "padding: 12px; border-bottom: 1px solid #dee2e6; color: #495057;";
      row.appendChild(plateCell);

      // Time Out
      const timeOutCell = document.createElement("td");
      timeOutCell.textContent = log.timeOut
        ? new Date(log.timeOut).toLocaleTimeString()
        : "-";
      timeOutCell.style.cssText =
        "padding: 12px; border-bottom: 1px solid #dee2e6; color: #495057;";
      row.appendChild(timeOutCell);

      // Time In
      const timeInCell = document.createElement("td");
      timeInCell.textContent = log.timeIn
        ? new Date(log.timeIn).toLocaleTimeString()
        : "-";
      timeInCell.style.cssText =
        "padding: 12px; border-bottom: 1px solid #dee2e6; color: #495057;";
      row.appendChild(timeInCell);

      // Status
      const statusCell = document.createElement("td");
      let status;
      let statusColor;
      let statusBg;

      if (log.timeOut && log.timeIn) {
        status = "COMPLETED";
        statusColor = "#28a745";
        statusBg = "#d4edda";
      } else if (log.timeOut && !log.timeIn) {
        status = "OUT";
        statusColor = "#dc3545";
        statusBg = "#f8d7da";
      } else if (log.timeIn && !log.timeOut) {
        status = "IN";
        statusColor = "#007bff";
        statusBg = "#d1ecf1";
      } else {
        status = "UNKNOWN";
        statusColor = "#6c757d";
        statusBg = "#e2e3e5";
      }

      statusCell.textContent = status;
      statusCell.style.cssText = `
        padding: 12px; 
        border-bottom: 1px solid #dee2e6; 
        color: ${statusColor}; 
        background: ${statusBg};
        border-radius: 4px;
        text-align: center;
        font-weight: 500;
        min-width: 100px;
      `;
      row.appendChild(statusCell);

      tbody.appendChild(row);
    });

    // Add minimal blank rows for consistent spacing
    const blankRowsToAdd = Math.max(0, rowsPerPage - paginatedLogs.length);

    // Remove existing blank rows first
    const existingBlankRows = tbody.querySelectorAll("tr.blank-row");
    existingBlankRows.forEach((row) => row.remove());

    // Add new blank rows
    for (let i = 0; i < blankRowsToAdd; i++) {
      const emptyRow = document.createElement("tr");
      emptyRow.className = "blank-row";
      emptyRow.style.cssText = "height: 50px;";
      for (let j = 0; j < 4; j++) {
        const emptyCell = document.createElement("td");
        emptyCell.innerHTML = "&nbsp;";
        emptyCell.style.cssText =
          "padding: 12px; border-bottom: 1px solid #dee2e6;";
        emptyRow.appendChild(emptyCell);
      }
      tbody.appendChild(emptyRow);
    }

    updatePaginationControls(timeLogs.length);
    updateFilterStatus(timeLogs.length);
  } catch (error) {
    console.error("Error fetching time logs:", error);
  }
}

// Function to update filter status display
function updateFilterStatus(totalLogs) {
  const filterStatus = document.getElementById("filter-status");
  if (!filterStatus) return;

  if (currentDateFilter === "current") {
    const today = new Date().toLocaleDateString();
    filterStatus.innerHTML = `<i class="fas fa-filter" style="margin-right: 5px;"></i>Showing only entries from ${today}`;
    filterStatus.style.color = "#007bff";
  } else {
    filterStatus.innerHTML = `<i class="fas fa-list" style="margin-right: 5px;"></i>Showing all entries`;
    filterStatus.style.color = "#6c757d";
  }
}

function updatePaginationControls(totalLogs) {
  const paginationContainer = document.getElementById("pagination-controls");
  if (!paginationContainer) return;

  const totalPages = Math.ceil(totalLogs / rowsPerPage);
  paginationContainer.innerHTML = ""; // Clear existing controls

  // Set the main container to use flexbox for horizontal layout
  paginationContainer.style.display = "flex";
  paginationContainer.style.alignItems = "center";
  paginationContainer.style.justifyContent = "center";
  paginationContainer.style.flexWrap = "wrap";

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.style.cssText =
    "color: white; margin-right: 20px; text-align: center; font-size: 14px; font-weight: 500;";
  const startIndex = (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, totalLogs);

  let filterInfo = "";
  if (currentDateFilter === "current") {
    const today = new Date().toLocaleDateString();
    filterInfo = ` (Filtered: ${today})`;
  }

  paginationInfo.innerHTML = `Showing ${startIndex} to ${endIndex} of ${totalLogs} entries${filterInfo}`;
  paginationContainer.appendChild(paginationInfo);

  // Rows per page selector with better styling
  const rowsSelectContainer = document.createElement("div");
  rowsSelectContainer.style.cssText =
    "display: flex; align-items: center; justify-content: center; margin-right: 20px; gap: 10px;";

  const rowsSelectLabel = document.createElement("label");
  rowsSelectLabel.textContent = "Rows per page:";
  rowsSelectLabel.style.cssText =
    "color: white; font-size: 14px; font-weight: 500;";

  const rowsSelect = document.createElement("select");
  rowsSelect.style.cssText =
    "padding: 5px 10px; border: 1px solid #2c3e50; border-radius: 4px; background: #34495e; font-size: 14px; min-width: 80px; color: white;";

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

  rowsSelectContainer.appendChild(rowsSelectLabel);
  rowsSelectContainer.appendChild(rowsSelect);
  paginationContainer.appendChild(rowsSelectContainer);

  if (totalPages <= 1) return; // Don't show pagination if only one page

  // Pagination controls container
  const paginationControls = document.createElement("div");
  paginationControls.style.cssText =
    "display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;";

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
  prevButton.disabled = currentPage === 1;
  prevButton.style.cssText = `
    padding: 8px 12px;
    border: none;
    background: ${currentPage === 1 ? "#95a5a6" : "#34495e"};
    color: white;
    border-radius: 4px;
    cursor: ${currentPage === 1 ? "not-allowed" : "pointer"};
    font-size: 0.9rem;
    transition: background-color 0.3s;
  `;
  prevButton.addEventListener("click", () =>
    updateVehicleTable(currentPage - 1)
  );
  paginationControls.appendChild(prevButton);

  // Smart page number display
  const pageNumbers = generatePageNumbers(currentPage, totalPages);

  pageNumbers.forEach((pageInfo) => {
    if (pageInfo === "...") {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.style.cssText =
        "color: white; padding: 8px 12px; font-size: 14px; font-weight: 500;";
      paginationControls.appendChild(ellipsis);
    } else {
      const pageButton = document.createElement("button");
      pageButton.textContent = pageInfo;
      pageButton.style.cssText = `
        padding: 8px 12px;
        border: none;
        background: ${pageInfo === currentPage ? "#1abc9c" : "#34495e"};
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        min-width: 40px;
        transition: background-color 0.3s;
      `;

      pageButton.addEventListener("mouseenter", () => {
        if (pageInfo !== currentPage) {
          pageButton.style.background = "#1abc9c";
        }
      });

      pageButton.addEventListener("mouseleave", () => {
        if (pageInfo !== currentPage) {
          pageButton.style.background = "#34495e";
        }
      });

      pageButton.addEventListener("click", () => updateVehicleTable(pageInfo));
      paginationControls.appendChild(pageButton);
    }
  });

  // Next button
  const nextButton = document.createElement("button");
  nextButton.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
  nextButton.disabled = currentPage === totalPages;
  nextButton.style.cssText = `
    padding: 8px 12px;
    border: none;
    background: ${currentPage === totalPages ? "#95a5a6" : "#34495e"};
    color: white;
    border-radius: 4px;
    cursor: ${currentPage === totalPages ? "not-allowed" : "pointer"};
    font-size: 0.9rem;
    transition: background-color 0.3s;
  `;
  nextButton.addEventListener("click", () =>
    updateVehicleTable(currentPage + 1)
  );
  paginationControls.appendChild(nextButton);

  paginationContainer.appendChild(paginationControls);
}

// Smart page number generation for better pagination display
function generatePageNumbers(currentPage, totalPages) {
  const pages = [];
  const maxVisiblePages = 7; // Show max 7 page numbers

  if (totalPages <= maxVisiblePages) {
    // If total pages is small, show all pages
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Always show first page
    pages.push(1);

    if (currentPage <= 4) {
      // Show first 5 pages + ellipsis + last page
      for (let i = 2; i <= 5; i++) {
        pages.push(i);
      }
      pages.push("...");
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      // Show first page + ellipsis + last 5 pages
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page + ellipsis + current page and neighbors + ellipsis + last page
      pages.push("...");
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i);
      }
      pages.push("...");
      pages.push(totalPages);
    }
  }

  return pages;
}

// Function to update the real-time clock
function updateClock() {
  const timeElement = document.getElementById("current-time");
  if (timeElement) {
    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const dateString = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    timeElement.textContent = `${dateString} - ${timeString}`;
  }
}

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

// Function to load recent logs from database
async function loadRecentLogs() {
  try {
    console.log("Loading recent logs...");
    const logsList = document.getElementById("logs-list");
    if (!logsList) {
      console.error("logs-list element not found");
      return;
    }

    // Clear existing logs
    logsList.innerHTML = "";

    // Get recent time logs from database
    console.log("Fetching time logs from database...");
    const response = await ipcRenderer.invoke("get-all-timelogs", {});
    if (!response.success) {
      console.error("Failed to get time logs:", response.error);
      return;
    }
    const timeLogs = response.logs;
    console.log("Received timeLogs:", timeLogs);

    if (Array.isArray(timeLogs) && timeLogs.length > 0) {
      console.log(`Found ${timeLogs.length} logs, showing first 20`);
      // Take the most recent 20 logs
      const recentLogs = timeLogs.slice(0, 20);

      recentLogs.forEach((log, index) => {
        console.log(`Processing log ${index + 1}:`, log);
        if (log.vehicle && log.vehicle.plateNo) {
          let message, type;

          if (log.timeOut && log.timeIn) {
            message = `${log.vehicle.plateNo} - Vehicle completed trip`;
            type = "success";
          } else if (log.timeOut) {
            message = `${log.vehicle.plateNo} - Vehicle left building`;
            type = "info";
          } else if (log.timeIn) {
            message = `${log.vehicle.plateNo} - Vehicle entered building`;
            type = "success";
          } else {
            message = `${log.vehicle.plateNo} - Vehicle detected`;
            type = "info";
          }

          const logEntry = document.createElement("div");
          logEntry.className = `log-entry log-${type}`;

          const timestamp = log.timeOut || log.timeIn || new Date();
          const timeString = new Date(timestamp).toLocaleTimeString();
          const dateString = new Date(timestamp).toLocaleDateString();

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
              <div class="log-time">${dateString} - ${timeString}</div>
            </div>
          `;

          logsList.appendChild(logEntry);
        } else {
          console.log(`Log ${index + 1} missing vehicle or plateNo:`, log);
        }
      });
    } else {
      console.log("No logs found or logs is not an array");
      // Show no logs message
      logsList.innerHTML = `
        <div style="text-align: center; color: #6c757d; padding: 20px;">
          <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
          <div>No recent logs found</div>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error loading recent logs:", error);
    const logsList = document.getElementById("logs-list");
    if (logsList) {
      logsList.innerHTML = `
        <div style="text-align: center; color: #dc3545; padding: 20px;">
          <i class="fas fa-exclamation-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
          <div>Error loading logs: ${error.message}</div>
        </div>
      `;
    }
  }
}

// Add table control event listeners function
function addTableControlEventListeners() {
  const refreshBtn = document.getElementById("refresh-table-btn");
  const quickJumpInput = document.getElementById("quick-jump-input");
  const quickJumpBtn = document.getElementById("quick-jump-btn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
      refreshBtn.disabled = true;
      updateVehicleTable(currentPage).then(() => {
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshBtn.disabled = false;
      });
    });
  }

  if (quickJumpBtn && quickJumpInput) {
    quickJumpBtn.addEventListener("click", () => {
      const pageNum = parseInt(quickJumpInput.value);
      if (pageNum && pageNum > 0) {
        updateVehicleTable(pageNum);
        quickJumpInput.value = "";
      }
    });

    quickJumpInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        quickJumpBtn.click();
      }
    });
  }

  const dateFilterSelect = document.getElementById("date-filter-select");
  if (dateFilterSelect) {
    dateFilterSelect.addEventListener("change", (e) => {
      currentDateFilter = e.target.value;
      currentPage = 1; // Reset to first page when filter changes
      updateVehicleTable(1);
    });
  }

  const clearFilterBtn = document.getElementById("clear-filter-btn");
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
      currentDateFilter = "all";
      dateFilterSelect.value = "all";
      currentPage = 1;
      updateVehicleTable(1);
    });
  }
}

// Show main view function
function showMainView() {
  const content = document.getElementById("content");
  if (!content) return;

  // Restore the main view content
  content.innerHTML = `
    <div class="content-wrapper">
        <div class="main-section">
            <div class="real-time-clock">
                <i class="fas fa-clock"></i>
                <span id="current-time">Loading...</span>
            </div>
            
            <div class="vehicle-table-container">
                                 <div class="filter-controls">
                     <div>
                         <h2>
                             <i class="fas fa-car-side"></i>
                             Vehicle Movement Log
                         </h2>
                         <div id="filter-status" class="filter-status">
                             <!-- Filter status will be displayed here -->
                         </div>
                     </div>
                                         <div class="filter-controls-right">
                         <div class="filter-controls-group">
                             <label class="filter-label">Date Filter:</label>
                             <select id="date-filter-select" class="filter-select">
                                 <option value="all">All Dates</option>
                                 <option value="current">Current Date</option>
                             </select>
                             <button id="clear-filter-btn" class="filter-button" title="Clear Date Filter">
                                 <i class="fas fa-times"></i>
                             </button>
                         </div>
                         <button id="refresh-table-btn" class="refresh-button">
                             <i class="fas fa-sync-alt"></i>
                             Refresh
                         </button>
                         <div class="filter-controls-group">
                             <label class="filter-label">Quick Jump:</label>
                             <input type="number" id="quick-jump-input" placeholder="Page #" min="1" class="quick-jump-input">
                             <button id="quick-jump-btn" class="quick-jump-button">Go</button>
                         </div>
                     </div>
                </div>
                <table class="vehicle-table">
                    <thead>
                        <tr>
                            <th>Plate Number</th>
                            <th>Time Out</th>
                            <th>Time In</th>
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

        <div class="logs-section">
            <h2>
                <i class="fas fa-history"></i>
                Recent Logs
            </h2>
            <div class="logs-container" id="logs-list">
                                <!-- Logs will be added here dynamically -->
            </div>
        </div>
    </div>
  `;

  // Restore the real-time clock
  updateClock();
  setInterval(updateClock, 1000);

  // Reload the vehicle table and recent logs
  updateVehicleTable();
  loadRecentLogs();

  // Re-add event listeners for table controls
  setTimeout(() => {
    addTableControlEventListeners();
  }, 100);
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Navigation event listeners
  const homeBtn = document.getElementById("home-btn");
  const adminBtn = document.getElementById("admin-btn");
  const signalBtn = document.getElementById("signal-btn");
  const connectionBtn = document.getElementById("connection-btn");

  if (homeBtn) homeBtn.addEventListener("click", showMainView);
  if (signalBtn) signalBtn.addEventListener("click", showSignalMonitoring);
  if (connectionBtn)
    connectionBtn.addEventListener("click", showConnectionHealth);
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
            <div class="real-time-clock">
                <i class="fas fa-clock"></i>
                <span id="current-time">Loading...</span>
            </div>
            
            <div class="vehicle-table-container">
                                 <div class="filter-controls">
                     <div>
                         <h2>
                             <i class="fas fa-car-side"></i>
                             Vehicle Movement Log
                         </h2>
                         <div id="filter-status" class="filter-status">
                             <!-- Filter status will be displayed here -->
                         </div>
                     </div>
                                         <div class="filter-controls-right">
                         <div class="filter-controls-group">
                             <label class="filter-label">Date Filter:</label>
                             <select id="date-filter-select" class="filter-select">
                                 <option value="all">All Dates</option>
                                 <option value="current">Current Date</option>
                             </select>
                             <button id="clear-filter-btn" class="filter-button" title="Clear Date Filter">
                                 <i class="fas fa-times"></i>
                             </button>
                         </div>
                         <button id="refresh-table-btn" class="refresh-button">
                             <i class="fas fa-sync-alt"></i>
                             Refresh
                         </button>
                         <div class="filter-controls-group">
                             <label class="filter-label">Quick Jump:</label>
                             <input type="number" id="quick-jump-input" placeholder="Page #" min="1" class="quick-jump-input">
                             <button id="quick-jump-btn" class="quick-jump-button">Go</button>
                         </div>
                     </div>
                </div>
                <table class="vehicle-table">
                    <thead>
                        <tr>
                            <th>Plate Number</th>
                            <th>Time Out</th>
                            <th>Time In</th>
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

        <div class="logs-section">
            <h2>
                <i class="fas fa-history"></i>
                Recent Logs
            </h2>
            <div class="logs-container" id="logs-list">
                                <!-- Logs will be added here dynamically -->
            </div>
        </div>
    </div>
  `;

  // Start the real-time clock
  updateClock();
  setInterval(updateClock, 1000);

  // Initial load of the table
  updateVehicleTable();

  // Add event listeners for table controls
  setTimeout(() => {
    addTableControlEventListeners();
  }, 100);

  // Load recent logs
  loadRecentLogs();
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
      addToRecentLogs(`${plateNo} - Vehicle Re-entered Building`, "success");
    } else if (action === "TIMEOUT") {
      entry.timeOut = new Date(timestamp).toLocaleTimeString();

      // Add to recent logs with proper formatting
      addToRecentLogs(`${plateNo} - Vehicle Left Building`, "info");
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

// Add signal strength monitoring section
function showSignalMonitoring() {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="signal-monitoring-container">
      <h2>
        <i class="fas fa-signal" style="margin-right: 10px;"></i>
        RFID Signal Monitoring
      </h2>
      
      <div class="signal-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="stat-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Signal Quality</h3>
          <div id="signal-quality-display">Loading...</div>
        </div>
        
        <div class="stat-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Recent Signals</h3>
          <div id="recent-signals-list">Loading...</div>
        </div>
        
        <div class="stat-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Glass Interference</h3>
          <div id="glass-interference-status">Loading...</div>
        </div>
      </div>
      
             <div class="signal-chart-container" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
         <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Signal Strength Over Time</h3>
         <div id="signal-chart" style="height: 300px; background: #f8f9fa; border-radius: 5px; padding: 20px; text-align: center; color: #6c757d;">
           Chart will be displayed here
         </div>
       </div>
       
       <div class="unknown-tags-container" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
         <h3 style="margin: 0 0 15px 0; color: #2c3e50;">
           <i class="fas fa-exclamation-triangle" style="margin-right: 10px; color: #ffc107;"></i>
           Unknown Tags Log
         </h3>
         <div class="unknown-tags-controls" style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
           <button id="clear-unknown-tags-btn" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
             <i class="fas fa-trash" style="margin-right: 8px;"></i>
             Clear Log
           </button>
           <button id="export-unknown-tags-btn" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
             <i class="fas fa-download" style="margin-right: 8px;"></i>
             Export CSV
           </button>
           <span style="color: #6c757d; font-size: 14px; margin-left: auto;">
             <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
             Raw RFID tags that couldn't be matched to registered vehicles
           </span>
         </div>
         <div id="unknown-tags-list" style="max-height: 400px; overflow-y: auto; border: 1px solid #e9ecef; border-radius: 5px; padding: 10px;">
           Loading unknown tags...
         </div>
       </div>
    </div>
  `;

  // Load initial signal data
  loadSignalData();

  // Load unknown tags data
  loadUnknownTags();

  // Add event listeners for unknown tags controls
  setTimeout(() => {
    const clearBtn = document.getElementById("clear-unknown-tags-btn");
    const exportBtn = document.getElementById("export-unknown-tags-btn");

    if (clearBtn) clearBtn.addEventListener("click", clearUnknownTags);
    if (exportBtn) exportBtn.addEventListener("click", exportUnknownTags);
  }, 100);
}

// Load and display signal data
async function loadSignalData() {
  try {
    const [statsResult, qualityResult] = await Promise.all([
      ipcRenderer.invoke("get-signal-stats"),
      ipcRenderer.invoke("get-signal-quality"),
    ]);

    if (statsResult.success && qualityResult.success) {
      displaySignalStats(statsResult.stats);
      displaySignalQuality(qualityResult.metrics);
    }
  } catch (error) {
    console.error("Error loading signal data:", error);
  }
}

// Display signal statistics
function displaySignalStats(stats) {
  const recentSignalsList = document.getElementById("recent-signals-list");
  const glassInterferenceStatus = document.getElementById(
    "glass-interference-status"
  );

  if (recentSignalsList) {
    const recent = stats.recentSignals.slice(-10);
    recentSignalsList.innerHTML = recent
      .map(
        (signal) => `
      <div style="margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid ${getSignalColor(
        signal.signalCategory
      )};">
        <div style="font-weight: bold; color: #2c3e50;">${
          signal.signalCategory
        }</div>
        <div style="font-size: 12px; color: #6c757d;">
          ${new Date(signal.timestamp).toLocaleTimeString()} - ${
          signal.dataLength
        } bytes
        </div>
      </div>
    `
      )
      .join("");
  }

  if (glassInterferenceStatus) {
    const recent = stats.recentSignals.slice(-20);
    const interferenceCount = recent.filter(
      (s) =>
        s.glassInterference.veryWeakSignal ||
        s.glassInterference.incompleteData ||
        s.glassInterference.possibleReflection
    ).length;

    const interferencePercentage = (
      (interferenceCount / recent.length) *
      100
    ).toFixed(1);

    glassInterferenceStatus.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: ${
          interferencePercentage > 30
            ? "#dc3545"
            : interferencePercentage > 15
            ? "#ffc107"
            : "#28a745"
        };">${interferencePercentage}%</div>
        <div style="color: #6c757d;">Interference detected</div>
        <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">
          ${interferenceCount} out of ${recent.length} recent signals
        </div>
      </div>
    `;
  }
}

// Display signal quality metrics
function displaySignalQuality(metrics) {
  const signalQualityDisplay = document.getElementById(
    "signal-quality-display"
  );

  if (signalQualityDisplay) {
    signalQualityDisplay.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 15px;">
          <div style="font-size: 14px; color: #6c757d;">Strong Signals</div>
          <div style="font-size: 20px; font-weight: bold; color: #28a745;">${metrics.strongSignalPercentage}%</div>
        </div>
        <div style="margin-bottom: 15px;">
          <div style="font-size: 14px; color: #6c757d;">Weak Signals</div>
          <div style="font-size: 20px; font-weight: bold; color: #dc3545;">${metrics.weakSignalPercentage}%</div>
        </div>
        <div style="margin-bottom: 15px;">
          <div style="font-size: 14px; color: #6c757d;">Avg Data Length</div>
          <div style="font-size: 20px; font-weight: bold; color: #17a2b8;">${metrics.averageDataLength} bytes</div>
        </div>
        <div>
          <div style="font-size: 14px; color: #6c757d;">Total Reads</div>
          <div style="font-size: 20px; font-weight: bold; color: #6c757d;">${metrics.totalReads}</div>
        </div>
      </div>
    `;
  }
}

// Get color for signal category
function getSignalColor(category) {
  switch (category) {
    case "STRONG":
      return "#28a745";
    case "MEDIUM":
      return "#17a2b8";
    case "WEAK":
      return "#ffc107";
    case "VERY_WEAK":
      return "#dc3545";
    default:
      return "#6c757d";
  }
}

// Handle real-time signal updates
ipcRenderer.on("signal-update", (event, data) => {
  updateSignalDisplay(data);
});

// Handle real-time unknown tag updates
ipcRenderer.on("unknown-tag-detected", (event, tagData) => {
  // Update the unknown tags display if we're on the signal monitoring page
  if (document.getElementById("unknown-tags-list")) {
    // Add the new tag to the top of the list
    addUnknownTagToDisplay(tagData);
  }
});

// Add new unknown tag to the display
function addUnknownTagToDisplay(tagData) {
  const unknownTagsList = document.getElementById("unknown-tags-list");
  if (!unknownTagsList) return;

  // Check if we're currently showing "no unknown tags" message
  const noTagsMessage = unknownTagsList.querySelector(
    '[style*="color: #28a745"]'
  );
  if (noTagsMessage) {
    noTagsList.innerHTML = "";
  }

  // Create new tag entry
  const tagEntry = document.createElement("div");
  tagEntry.style.cssText =
    "margin-bottom: 15px; padding: 12px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; border-left: 4px solid #ffc107; animation: slideIn 0.3s ease-out;";

  tagEntry.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
      <div style="font-weight: bold; color: #856404; font-size: 14px;">
        <i class="fas fa-tag" style="margin-right: 8px;"></i>
        EPC: ${tagData.epc || "Unknown"}
      </div>
      <div style="font-size: 12px; color: #856404;">
        ${new Date(tagData.timestamp).toLocaleString()}
      </div>
    </div>
    <div style="margin-bottom: 8px;">
      <div style="font-size: 12px; color: #856404; margin-bottom: 4px;">
        <strong>Raw Data:</strong> ${tagData.rawData || "N/A"}
      </div>
      <div style="font-size: 12px; color: #856404; margin-bottom: 4px;">
        <strong>Data Length:</strong> ${tagData.dataLength || "N/A"} bytes
      </div>
      <div style="font-size: 12px; color: #856404;">
        <strong>Signal Strength:</strong> ${tagData.signalStrength || "N/A"}
      </div>
    </div>
    <div style="font-size: 11px; color: #856404; font-style: italic;">
      <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
      This tag is not registered in the vehicle database
    </div>
  `;

  // Add to the top of the list
  unknownTagsList.insertBefore(tagEntry, unknownTagsList.firstChild);

  // Keep only the last 100 entries to prevent memory issues
  const entries = unknownTagsList.querySelectorAll(
    "div[style*='background: #fff3cd']"
  );
  if (entries.length > 100) {
    unknownTagsList.removeChild(entries[entries.length - 1]);
  }
}

// Update signal display with real-time data
function updateSignalDisplay(data) {
  // Update the display with new data
  if (data.recentSignals && data.recentSignals.length > 0) {
    const recentSignalsList = document.getElementById("recent-signals-list");
    if (recentSignalsList) {
      const recent = data.recentSignals.slice(-10);
      recentSignalsList.innerHTML = recent
        .map(
          (signal) => `
        <div style="margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid ${getSignalColor(
          signal.signalCategory
        )};">
          <div style="font-weight: bold; color: #2c3e50;">${
            signal.signalCategory
          }</div>
          <div style="font-size: 12px; color: #6c757d;">
            ${new Date(signal.timestamp).toLocaleTimeString()} - ${
            signal.dataLength
          } bytes
          </div>
        </div>
      `
        )
        .join("");
    }
  }
}

// Load and display unknown tags
async function loadUnknownTags() {
  try {
    const unknownTagsResult = await ipcRenderer.invoke("get-unknown-tags");

    if (unknownTagsResult.success) {
      displayUnknownTags(unknownTagsResult.tags);
    } else {
      console.error("Failed to get unknown tags:", unknownTagsResult.error);
      displayUnknownTags([]);
    }
  } catch (error) {
    console.error("Error loading unknown tags:", error);
    displayUnknownTags([]);
  }
}

// Display unknown tags in the list
function displayUnknownTags(tags) {
  const unknownTagsList = document.getElementById("unknown-tags-list");
  if (!unknownTagsList) return;

  if (!Array.isArray(tags) || tags.length === 0) {
    unknownTagsList.innerHTML = `
      <div style="text-align: center; color: #28a745; padding: 20px;">
        <i class="fas fa-check-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
        <div>No unknown tags detected</div>
        <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">
          All RFID tags are properly registered
        </div>
      </div>
    `;
    return;
  }

  // Sort by timestamp (most recent first)
  const sortedTags = tags.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  unknownTagsList.innerHTML = sortedTags
    .map(
      (tag) => `
      <div style="margin-bottom: 15px; padding: 12px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; border-left: 4px solid #ffc107;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div style="font-weight: bold; color: #856404; font-size: 14px;">
            <i class="fas fa-tag" style="margin-right: 8px;"></i>
            EPC: ${tag.epc || "Unknown"}
          </div>
          <div style="font-size: 12px; color: #856404;">
            ${new Date(tag.timestamp).toLocaleString()}
          </div>
        </div>
        <div style="margin-bottom: 8px;">
          <div style="font-size: 12px; color: #856404; margin-bottom: 4px;">
            <strong>Raw Data:</strong> ${tag.rawData || "N/A"}
          </div>
          <div style="font-size: 12px; color: #856404; margin-bottom: 4px;">
            <strong>Data Length:</strong> ${tag.dataLength || "N/A"} bytes
          </div>
          <div style="font-size: 12px; color: #856404;">
            <strong>Signal Strength:</strong> ${tag.signalStrength || "N/A"}
          </div>
        </div>
        <div style="font-size: 11px; color: #856404; font-style: italic;">
          <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
          This tag is not registered in the vehicle database
        </div>
      </div>
    `
    )
    .join("");
}

// Clear unknown tags log
async function clearUnknownTags() {
  try {
    const clearBtn = document.getElementById("clear-unknown-tags-btn");
    if (clearBtn) {
      clearBtn.disabled = true;
      clearBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Clearing...';
    }

    const result = await ipcRenderer.invoke("clear-unknown-tags");

    if (result.success) {
      // Refresh the display
      await loadUnknownTags();

      // Show success message
      showNotification("Unknown tags log cleared successfully", "success");
    } else {
      showNotification("Failed to clear unknown tags log", "error");
    }
  } catch (error) {
    console.error("Error clearing unknown tags:", error);
    showNotification("Error clearing unknown tags log", "error");
  } finally {
    const clearBtn = document.getElementById("clear-unknown-tags-btn");
    if (clearBtn) {
      clearBtn.disabled = false;
      clearBtn.innerHTML =
        '<i class="fas fa-trash" style="margin-right: 8px;"></i>Clear Log';
    }
  }
}

// Export unknown tags to CSV
async function exportUnknownTags() {
  try {
    const exportBtn = document.getElementById("export-unknown-tags-btn");
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Exporting...';
    }

    const result = await ipcRenderer.invoke("export-unknown-tags");

    if (result.success) {
      showNotification("Unknown tags exported successfully", "success");
    } else {
      showNotification("Failed to export unknown tags", "error");
    }
  } catch (error) {
    console.error("Error exporting unknown tags:", error);
    showNotification("Error exporting unknown tags", "error");
  } finally {
    const exportBtn = document.getElementById("export-unknown-tags-btn");
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML =
        '<i class="fas fa-download" style="margin-right: 8px;"></i>Export CSV';
    }
  }
}

// Show notification function
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${
      type === "success" ? "#28a745" : type === "error" ? "#dc3545" : "#17a2b8"
    };
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 400px;
    font-family: 'Poppins', sans-serif;
  `;

  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">
      <i class="fas fa-${
        type === "success"
          ? "check-circle"
          : type === "error"
          ? "exclamation-circle"
          : "info-circle"
      }" style="margin-right: 8px;"></i>
      ${type.toUpperCase()}
    </div>
    <div style="font-size: 14px;">${message}</div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Connection Health Monitoring Functions
function showConnectionHealth() {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="connection-health-container">
      <h2>
        <i class="fas fa-network-wired" style="margin-right: 10px;"></i>
        Connection Health Monitoring
      </h2>
      
      <div class="connection-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
        <div class="stat-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Connection Status</h3>
          <div id="connection-status-display">Loading...</div>
        </div>
        
        <div class="stat-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Network Performance</h3>
          <div id="network-performance-display">Loading...</div>
        </div>
        
        <div class="stat-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Recent Alerts</h3>
          <div id="recent-alerts-display">Loading...</div>
        </div>
      </div>
      
      <div class="connection-controls" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Network Diagnostics</h3>
        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
          <button id="ping-network-btn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
            <i class="fas fa-ping" style="margin-right: 8px;"></i>
            Ping Network
          </button>
          <button id="reset-stats-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
            <i class="fas fa-redo" style="margin-right: 8px;"></i>
            Reset Statistics
          </button>
          <button id="back-to-main-btn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
            <i class="fas fa-arrow-left" style="margin-right: 8px;"></i>
            Back to Main
          </button>
        </div>
      </div>
      
      <div class="connection-history-container" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Connection History</h3>
        <div id="connection-history-list" style="max-height: 300px; overflow-y: auto;">
          Loading connection history...
        </div>
      </div>
    </div>
  `;

  // Load initial connection health data
  loadConnectionHealthData();

  // Add event listeners for connection health controls
  setTimeout(() => {
    const pingBtn = document.getElementById("ping-network-btn");
    const resetBtn = document.getElementById("reset-stats-btn");
    const backBtn = document.getElementById("back-to-main-btn");

    if (pingBtn) pingBtn.addEventListener("click", pingNetwork);
    if (resetBtn) resetBtn.addEventListener("click", resetConnectionStats);
    if (backBtn) backBtn.addEventListener("click", showMainView);
  }, 100);
}

// Load and display connection health data
async function loadConnectionHealthData() {
  try {
    const healthResult = await ipcRenderer.invoke("get-connection-health");

    if (healthResult.success) {
      displayConnectionHealth(healthResult.health);
    }
  } catch (error) {
    console.error("Error loading connection health data:", error);
  }
}

// Display connection health information
function displayConnectionHealth(health) {
  // Update connection status
  const connectionStatusDisplay = document.getElementById(
    "connection-status-display"
  );
  if (connectionStatusDisplay) {
    const statusColor =
      health.consecutiveFailures >= 5
        ? "#dc3545"
        : health.consecutiveFailures >= 3
        ? "#ffc107"
        : "#28a745";

    connectionStatusDisplay.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 15px;">
          <div style="font-size: 14px; color: #6c757d;">Connection Success Rate</div>
          <div style="font-size: 20px; font-weight: bold; color: ${statusColor};">${health.connectionSuccessRate.toFixed(
      1
    )}%</div>
        </div>
        <div style="margin-bottom: 15px;">
          <div style="font-size: 14px; color: #6c757d;">Consecutive Failures</div>
          <div style="font-size: 20px; font-weight: bold; color: ${
            health.consecutiveFailures >= 5 ? "#dc3545" : "#6c757d"
          };">${health.consecutiveFailures}</div>
        </div>
        <div>
          <div style="font-size: 14px; color: #6c757d;">Total Attempts</div>
          <div style="font-size: 20px; font-weight: bold; color: #6c757d;">${
            health.connectionAttempts
          }</div>
        </div>
      </div>
    `;
  }

  // Update network performance
  const networkPerformanceDisplay = document.getElementById(
    "network-performance-display"
  );
  if (networkPerformanceDisplay) {
    const avgLatency = health.averageLatency || 0;
    const latencyColor =
      avgLatency > 1000 ? "#dc3545" : avgLatency > 500 ? "#ffc107" : "#28a745";

    networkPerformanceDisplay.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 15px;">
          <div style="font-size: 14px; color: #6c757d;">Average Latency</div>
          <div style="font-size: 20px; font-weight: bold; color: ${latencyColor};">${avgLatency.toFixed(
      0
    )}ms</div>
        </div>
        <div style="margin-bottom: 15px;">
          <div style="font-size: 14px; color: #6c757d;">Uptime Percentage</div>
          <div style="font-size: 20px; font-weight: bold; color: #28a745;">${health.uptimePercentage.toFixed(
            1
          )}%</div>
        </div>
        <div>
          <div style="font-size: 14px; color: #6c757d;">Last Connection</div>
          <div style="font-size: 12px; color: #6c757d;">${
            health.lastConnectionTime
              ? new Date(health.lastConnectionTime).toLocaleString()
              : "Never"
          }</div>
        </div>
      </div>
    `;
  }

  // Update recent alerts
  const recentAlertsDisplay = document.getElementById("recent-alerts-display");
  if (recentAlertsDisplay) {
    const recentAlerts = health.alerts.slice(-5);
    if (recentAlerts.length === 0) {
      recentAlertsDisplay.innerHTML = `
        <div style="text-align: center; color: #28a745;">
          <i class="fas fa-check-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
          <div>No alerts</div>
        </div>
      `;
    } else {
      recentAlertsDisplay.innerHTML = recentAlerts
        .map(
          (alert) => `
          <div style="margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid ${
            alert.level === "critical" ? "#dc3545" : "#ffc107"
          };">
            <div style="font-weight: bold; color: #2c3e50; font-size: 12px;">${alert.level.toUpperCase()}</div>
            <div style="font-size: 12px; color: #6c757d;">${alert.message}</div>
            <div style="font-size: 10px; color: #6c757d; margin-top: 5px;">
              ${new Date(alert.timestamp).toLocaleString()}
            </div>
          </div>
        `
        )
        .join("");
    }
  }

  // Update connection history
  const connectionHistoryList = document.getElementById(
    "connection-history-list"
  );
  if (connectionHistoryList) {
    const recentConnections = health.connectionHistory.slice(-20);
    if (recentConnections.length === 0) {
      connectionHistoryList.innerHTML =
        '<div style="text-align: center; color: #6c757d;">No connection history available</div>';
    } else {
      connectionHistoryList.innerHTML = recentConnections
        .map(
          (connection) => `
          <div style="margin-bottom: 8px; padding: 6px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid ${
            connection.success ? "#28a745" : "#dc3545"
          };">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #2c3e50; font-weight: ${
                connection.success ? "normal" : "bold"
              };">
                ${connection.success ? "✅ Success" : "❌ Failed"}
              </span>
              <span style="font-size: 10px; color: #6c757d;">
                ${new Date(connection.timestamp).toLocaleTimeString()}
              </span>
            </div>
            ${
              connection.latency
                ? `<div style="font-size: 10px; color: #6c757d;">Latency: ${connection.latency}ms</div>`
                : ""
            }
            ${
              connection.error
                ? `<div style="font-size: 10px; color: #dc3545;">Error: ${connection.error}</div>`
                : ""
            }
          </div>
        `
        )
        .join("");
    }
  }
}

// Ping network function
async function pingNetwork() {
  try {
    const pingBtn = document.getElementById("ping-network-btn");
    if (pingBtn) {
      pingBtn.disabled = true;
      pingBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Pinging...';
    }

    const result = await ipcRenderer.invoke("ping-network");

    if (result.success) {
      // Refresh the display
      await loadConnectionHealthData();
    }
  } catch (error) {
    console.error("Error pinging network:", error);
  } finally {
    const pingBtn = document.getElementById("ping-network-btn");
    if (pingBtn) {
      pingBtn.disabled = false;
      pingBtn.innerHTML =
        '<i class="fas fa-ping" style="margin-right: 8px;"></i>Ping Network';
    }
  }
}

// Reset connection statistics
async function resetConnectionStats() {
  try {
    const resetBtn = document.getElementById("reset-stats-btn");
    if (resetBtn) {
      resetBtn.disabled = true;
      resetBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Resetting...';
    }

    const result = await ipcRenderer.invoke("reset-connection-stats");

    if (result.success) {
      // Refresh the display
      await loadConnectionHealthData();
    }
  } catch (error) {
    console.error("Error resetting connection stats:", error);
  } finally {
    const resetBtn = document.getElementById("reset-stats-btn");
    if (resetBtn) {
      resetBtn.disabled = false;
      resetBtn.innerHTML =
        '<i class="fas fa-redo" style="margin-right: 8px;"></i>Reset Statistics';
    }
  }
}

// Handle real-time connection health updates
ipcRenderer.on("connection-health-update", (event, health) => {
  // Update the display if we're on the connection health page
  if (document.getElementById("connection-status-display")) {
    displayConnectionHealth(health);
  }
});

// Handle connection alerts
ipcRenderer.on("connection-alert", (event, alert) => {
  // Show alert notification
  showAlertNotification(alert);
});

// Show alert notification
function showAlertNotification(alert) {
  // Create notification element
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${alert.level === "critical" ? "#dc3545" : "#ffc107"};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 400px;
    font-family: 'Poppins', sans-serif;
  `;

  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">${alert.level.toUpperCase()}</div>
    <div style="font-size: 14px;">${alert.message}</div>
    <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">
      ${new Date(alert.timestamp).toLocaleTimeString()}
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 10000);
}
