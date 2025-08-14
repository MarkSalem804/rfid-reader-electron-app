// Admin Panel Script
const { ipcRenderer } = require("electron");
const vehicleTracker = require("../../backend/vehicleTracker-service");
const { getAllUsers } = require("../../backend/Users/auth");

// Global variables
let currentPage = "dashboard";
let currentReport = null;
let vehicleCurrentPage = 1;
let userCurrentPage = 1;
const vehicleRowsPerPage = 6;
const userRowsPerPage = 6;
let timelogsCurrentPage = 1;
const timelogsRowsPerPage = 6;
let timelogsData = [];

document.addEventListener("DOMContentLoaded", function () {
  initializeAdminPanel();
  loadDashboardData();
  setDefaultDates();
  // setupAddUserModal();

  // Add back to main button functionality
  const backBtn = document.getElementById("back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      window.location.href = "../../../index.html";
    });
  }

  // Add logout functionality
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      if (confirm("Are you sure you want to logout?")) {
        window.location.href = "../login/index.html";
      }
    });
  }

  // Dynamically create the Add Vehicle button with the same design as the old button
  const vehiclesPage = document.getElementById("vehicles-page");
  if (vehiclesPage) {
    const vehiclesHeader = vehiclesPage.querySelector(".vehicles-header");
    if (vehiclesHeader && !vehiclesHeader.querySelector("#add-vehicle-btn")) {
      const addVehicleBtn = document.createElement("button");
      addVehicleBtn.id = "add-vehicle-btn";
      addVehicleBtn.className = "add-vehicle-btn btn-primary";
      addVehicleBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Vehicle';
      addVehicleBtn.style.marginBottom = "20px";
      vehiclesHeader.appendChild(addVehicleBtn);
      console.log(
        "Dynamically created Add Vehicle button and appended to vehicles-header"
      );
      addVehicleBtn.addEventListener("click", function () {
        console.log("Add Vehicle button clicked");
        showAddVehicleModal();
      });
    }
  }

  // Dynamically create the Add User button with the same design as the old button
  const usersPage = document.getElementById("users-page");
  if (usersPage) {
    const usersHeader = usersPage.querySelector(".users-header");
    if (usersHeader && !usersHeader.querySelector("#add-user-btn")) {
      const addUserBtn = document.createElement("button");
      addUserBtn.id = "add-user-btn";
      addUserBtn.className = "add-user-btn btn-primary";
      addUserBtn.innerHTML = '<i class="fas fa-user-plus"></i> Add New User';
      addUserBtn.style.marginBottom = "20px";
      usersHeader.appendChild(addUserBtn);
      console.log(
        "Dynamically created Add User button and appended to users-header"
      );
      addUserBtn.addEventListener("click", function () {
        console.log("Add User button clicked");
        showAddUserModal();
      });
    }
  }

  // Wire up the Edit Database URL button in the settings page
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "open-db-settings-btn") {
      showDbUrlEditorModal();
    }
    if (e.target && e.target.id === "open-rfid-settings-btn") {
      showRfidSettingsModal();
    }
  });
});

// Initialize admin panel functionality
function initializeAdminPanel() {
  // Sidebar toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("collapsed");
      // Update button icon based on state
      const icon = sidebarToggle.querySelector("i");
      if (sidebar.classList.contains("collapsed")) {
        icon.className = "fas fa-bars";
        sidebarToggle.title = "Expand Sidebar";
      } else {
        icon.className = "fas fa-times";
        sidebarToggle.title = "Collapse Sidebar";
      }
    });
  }

  // Navigation
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const page = this.getAttribute("data-page");
      showPage(page);
    });
  });

  // Set default active page
  showPage("dashboard");
}

// Show specific page
function showPage(pageName) {
  // Hide all pages
  const pages = document.querySelectorAll(".page");
  pages.forEach((page) => page.classList.remove("active"));

  // Show selected page
  const selectedPage = document.getElementById(pageName + "-page");
  if (selectedPage) {
    selectedPage.classList.add("active");
  }

  // Update navigation
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => link.classList.remove("active"));

  const activeLink = document.querySelector(`[data-page="${pageName}"]`);
  if (activeLink) {
    activeLink.classList.add("active");
  }

  currentPage = pageName;

  // Load page-specific data
  switch (pageName) {
    case "dashboard":
      loadDashboardData();
      break;
    case "reports":
      loadTimeLogsTable();
      break;
    case "vehicles":
      loadVehiclesData();
      break;
    case "users":
      loadUsersData();
      break;
    case "settings":
      // Settings page is static
      // Fetch and display the current DB URL in the static field
      ipcRenderer.invoke("get-db-url").then((dbUrl) => {
        const staticField = document.getElementById("admin-db-url-static");
        if (staticField) {
          staticField.value = dbUrl;
        }
      });

      // Fetch and display the current RFID settings in the static fields
      ipcRenderer.invoke("get-rfid-settings").then((result) => {
        if (result.success) {
          const ipField = document.getElementById("rfid-ip-static");
          const portField = document.getElementById("rfid-port-static");
          if (ipField) ipField.value = result.settings.ip;
          if (portField) portField.value = result.settings.port;
        }
      });
      break;
  }
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Load statistics
    await loadDashboardStats();

    // Load recent activity
    await loadRecentActivity();
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }
}

// Load dashboard statistics
async function loadDashboardStats() {
  try {
    const comprehensiveReport = await vehicleTracker.generateReport({
      startDate: new Date(new Date().setHours(0, 0, 0, 0)),
      endDate: new Date(),
      reportType: "comprehensive",
    });

    // Update stat cards
    document.getElementById("total-vehicles").textContent =
      comprehensiveReport.summary.totalVehicles || 0;
    document.getElementById("parked-vehicles").textContent =
      comprehensiveReport.summary.currentlyParked || 0;
    document.getElementById("today-entries").textContent =
      comprehensiveReport.summary.totalEntries || 0;
    document.getElementById("today-exits").textContent =
      comprehensiveReport.summary.totalExits || 0;
  } catch (error) {
    console.error("Error loading dashboard stats:", error);
  }
}

// Load recent activity
async function loadRecentActivity() {
  try {
    const timeLogs = await vehicleTracker.getAllTimeLogs();
    const activityList = document.getElementById("recent-activity");

    if (!activityList) return;

    // Get last 10 activities
    const recentLogs = timeLogs.slice(0, 10);

    activityList.innerHTML = recentLogs
      .map((log) => {
        const isEntry = !log.timeOut;
        const activityType = isEntry ? "entry" : "exit";
        const activityText = isEntry ? "Vehicle entered" : "Vehicle exited";
        const time = isEntry ? log.timeIn : log.timeOut;
        const vehicleName =
          log.vehicle?.plateNo || log.vehicle?.vehicleName || "Unknown Vehicle";

        return `
                <div class="activity-item">
                    <div class="activity-icon ${activityType}">
                        <i class="fas fa-${
                          isEntry ? "sign-in-alt" : "sign-out-alt"
                        }"></i>
                    </div>
                    <div class="activity-content">
                        <h4>${activityText}</h4>
                        <p>${vehicleName} - ${new Date(
          time
        ).toLocaleString()}</p>
                    </div>
                </div>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading recent activity:", error);
  }
}

// Load vehicles data
async function loadVehiclesData(page = 1) {
  try {
    const vehicles = await vehicleTracker.getAllVehiclesWithStats();
    const tbody = document.getElementById("vehicles-tbody");
    if (!tbody) return;
    vehicleCurrentPage = page;
    const startIndex = (vehicleCurrentPage - 1) * vehicleRowsPerPage;
    const endIndex = startIndex + vehicleRowsPerPage;
    const paginatedVehicles = vehicles.slice(startIndex, endIndex);
    tbody.innerHTML = paginatedVehicles
      .map((vehicle) => {
        const lastActivity =
          vehicle.timeLogs.length > 0 ? vehicle.timeLogs[0].timeIn : null;
        const isParked = vehicle.timeLogs.some((log) => !log.timeOut);
        const status = isParked ? "Parked" : "Available";
        const statusClass = isParked ? "parked" : "available";

        // Display RFID tags
        const rfidTagsHtml =
          vehicle.rfidTags && vehicle.rfidTags.length > 0
            ? vehicle.rfidTags
                .map(
                  (tag) =>
                    `<span class="tag-badge ${
                      tag.tagType?.toLowerCase() || "default"
                    }" title="${tag.epc}">
                ${tag.tagType || "Unknown"} - ${tag.epc.substring(0, 8)}...
              </span>`
                )
                .join("")
            : '<span class="no-tags">No tags assigned</span>';

        return `
                <tr>
                    <td>${vehicle.plateNo || "-"}</td>
                    <td>${vehicle.vehicleName || "-"}</td>
                    <td class="rfid-tags-cell">
                        ${rfidTagsHtml}
                    </td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>${
                      lastActivity
                        ? new Date(lastActivity).toLocaleString()
                        : "Never"
                    }</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn-small edit-btn" onclick="editVehicle(${
                              vehicle.id
                            })" title="Edit Vehicle">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn-small tag-btn" onclick="manageVehicleTags(${
                              vehicle.id
                            })" title="Manage RFID Tags">
                                <i class="fas fa-tags"></i>
                            </button>
                            <button class="action-btn-small delete-btn" onclick="deleteVehicle(${
                              vehicle.id
                            })" title="Delete Vehicle">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
      })
      .join("");
    // Add blank rows if needed
    const blankVehicleRows = vehicleRowsPerPage - paginatedVehicles.length;
    for (let i = 0; i < blankVehicleRows; i++) {
      const emptyRow = document.createElement("tr");
      for (let j = 0; j < 6; j++) {
        // 6 columns
        const emptyCell = document.createElement("td");
        emptyCell.innerHTML = "&nbsp;";
        emptyRow.appendChild(emptyCell);
      }
      tbody.appendChild(emptyRow);
    }
    renderVehiclePagination(vehicles.length);
  } catch (error) {
    console.error("Error loading vehicles data:", error);
  }
}

function renderVehiclePagination(total) {
  const container = document.getElementById("vehicle-pagination");
  if (!container) return;
  container.className = "pagination-container";
  const totalPages = Math.ceil(total / vehicleRowsPerPage);
  let html = "";
  if (totalPages > 1) {
    html += `<button class="pagination-btn" ${
      vehicleCurrentPage === 1 ? "disabled" : ""
    } onclick="loadVehiclesData(${vehicleCurrentPage - 1})">Previous</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-btn${
        i === vehicleCurrentPage ? " active" : ""
      }" onclick="loadVehiclesData(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" ${
      vehicleCurrentPage === totalPages ? "disabled" : ""
    } onclick="loadVehiclesData(${vehicleCurrentPage + 1})">Next</button>`;
  }
  container.innerHTML = html;
}

// Load users data
async function loadUsersData(page = 1) {
  try {
    const users = await getAllUsers();
    const tbody = document.getElementById("users-tbody");
    if (!tbody) return;
    userCurrentPage = page;
    const startIndex = (userCurrentPage - 1) * userRowsPerPage;
    const endIndex = startIndex + userRowsPerPage;
    const paginatedUsers = users.slice(startIndex, endIndex);
    tbody.innerHTML = paginatedUsers
      .map((user) => {
        return `
            <tr>
                <td>${user.email}</td> 
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td><span class="status-badge active">Active</span></td>
                <td>${new Date(user.createdAt).toLocaleString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn-small edit-btn" onclick="editUser(${
                          user.id
                        })">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn-small delete-btn" onclick="deleteUser(${
                          user.id
                        })">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
      })
      .join("");
    // Add blank rows if needed
    const blankUserRows = userRowsPerPage - paginatedUsers.length;
    for (let i = 0; i < blankUserRows; i++) {
      const emptyRow = document.createElement("tr");
      for (let j = 0; j < 6; j++) {
        // 6 columns
        const emptyCell = document.createElement("td");
        emptyCell.innerHTML = "&nbsp;";
        emptyRow.appendChild(emptyCell);
      }
      tbody.appendChild(emptyRow);
    }
    renderUserPagination(users.length);
  } catch (error) {
    console.error("Error loading users data:", error);
    const tbody = document.getElementById("users-tbody");
    if (tbody) {
      tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #b91c1c;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    <p>Error loading user data.</p>
                </td>
            </tr>
        `;
    }
  }
}

function renderUserPagination(total) {
  const container = document.getElementById("user-pagination");
  if (!container) return;
  container.className = "pagination-container";
  const totalPages = Math.ceil(total / userRowsPerPage);
  let html = "";
  if (totalPages > 1) {
    html += `<button class="pagination-btn" ${
      userCurrentPage === 1 ? "disabled" : ""
    } onclick="loadUsersData(${userCurrentPage - 1})">Previous</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-btn${
        i === userCurrentPage ? " active" : ""
      }" onclick="loadUsersData(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" ${
      userCurrentPage === totalPages ? "disabled" : ""
    } onclick="loadUsersData(${userCurrentPage + 1})">Next</button>`;
  }
  container.innerHTML = html;
}

// Set default dates for reports
function setDefaultDates() {
  const startDate = document.getElementById("start-date");
  const endDate = document.getElementById("end-date");

  if (startDate && endDate) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    startDate.value = thirtyDaysAgo.toISOString().split("T")[0];
    endDate.value = today.toISOString().split("T")[0];
  }
}

// Generate report function
async function generateReport() {
  const reportType = document.getElementById("report-type").value;
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;

  const reportContent = document.getElementById("report-content");
  const exportJsonBtn = document.getElementById("export-json-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");

  // Show loading
  reportContent.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Generating report...</p>
        </div>
    `;

  try {
    const report = await vehicleTracker.generateReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reportType,
    });

    // Store report for export
    currentReport = report;

    // Enable export buttons
    exportJsonBtn.disabled = false;
    exportCsvBtn.disabled = false;

    // Display report
    displayReport(report);
  } catch (error) {
    reportContent.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error generating report: ${error.message}</p>
            </div>
        `;
  }
}

// Display report function
function displayReport(report) {
  const reportContent = document.getElementById("report-content");

  let html = `
        <div class="report-header">
            <h3>${getReportTitle(report.type)}</h3>
            ${
              report.generatedAt
                ? `<p>Generated on: ${new Date(
                    report.generatedAt
                  ).toLocaleString()}</p>`
                : ""
            }
            ${
              report.dateRange
                ? `<p>Date Range: ${new Date(
                    report.dateRange.startDate
                  ).toLocaleDateString()} - ${new Date(
                    report.dateRange.endDate
                  ).toLocaleDateString()}</p>`
                : ""
            }
        </div>
    `;

  // Add summary section
  if (report.summary) {
    html += `
            <div class="report-summary">
                <h4>Summary</h4>
                <div class="summary-stats">
                    ${Object.entries(report.summary)
                      .map(
                        ([key, value]) => `
                        <div class="stat-item">
                            <span class="stat-label">${formatStatLabel(
                              key
                            )}:</span>
                            <span class="stat-value">${value}</span>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `;
  }

  // Add specific sections based on report type
  switch (report.type) {
    case "daily":
      html += displayDailyReport(report);
      break;
    case "vehicle":
      html += displayVehicleReport(report);
      break;
    case "parking":
      html += displayParkingReport(report);
      break;
    case "comprehensive":
      html += displayComprehensiveReport(report);
      break;
    case "timelogs":
      html += displayTimeLogsReport(report);
      break;
  }

  reportContent.innerHTML = html;
}

// Display daily report
function displayDailyReport(report) {
  return `
        <div class="report-section">
            <h4>Daily Statistics</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Total Entries</th>
                        <th>Total Exits</th>
                        <th>Unique Vehicles</th>
                        <th>Avg Duration (min)</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.dailyStats
                      .map(
                        (day) => `
                        <tr>
                            <td>${new Date(day.date).toLocaleDateString()}</td>
                            <td>${day.totalEntries}</td>
                            <td>${day.totalExits}</td>
                            <td>${day.uniqueVehicles}</td>
                            <td>${day.averageDuration}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

// Display vehicle report
function displayVehicleReport(report) {
  return `
        <div class="report-section">
            <h4>Vehicle Statistics</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Plate Number</th>
                        <th>Vehicle Name</th>
                        <th>Total Entries</th>
                        <th>Total Exits</th>
                        <th>Total Duration (min)</th>
                        <th>Avg Duration (min)</th>
                        <th>Last Entry</th>
                        <th>Last Exit</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.vehicleStats
                      .map(
                        (vehicle) => `
                        <tr>
                            <td>${vehicle.plateNo || "-"}</td>
                            <td>${vehicle.vehicleName || "-"}</td>
                            <td>${vehicle.totalEntries}</td>
                            <td>${vehicle.totalExits}</td>
                            <td>${vehicle.totalDuration}</td>
                            <td>${vehicle.averageDuration}</td>
                            <td>${
                              vehicle.lastEntry
                                ? new Date(vehicle.lastEntry).toLocaleString()
                                : "-"
                            }</td>
                            <td>${
                              vehicle.lastExit
                                ? new Date(vehicle.lastExit).toLocaleString()
                                : "-"
                            }</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

// Display parking report
function displayParkingReport(report) {
  return `
        <div class="report-section">
            <h4>Currently Parked Vehicles</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Plate Number</th>
                        <th>Vehicle Name</th>
                        <th>Time In</th>
                        <th>Duration (min)</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.summary.parkedVehicles
                      .map(
                        (vehicle) => `
                        <tr>
                            <td>${vehicle.plateNo || "-"}</td>
                            <td>${vehicle.vehicleName || "-"}</td>
                            <td>${new Date(
                              vehicle.timeIn
                            ).toLocaleString()}</td>
                            <td>${vehicle.duration}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

// Display comprehensive report
function displayComprehensiveReport(report) {
  return `
        <div class="report-section">
            <h4>Daily Activity</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Total Entries</th>
                        <th>Total Exits</th>
                        <th>Unique Vehicles</th>
                        <th>Avg Duration (min)</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.sections.daily
                      .map(
                        (day) => `
                        <tr>
                            <td>${new Date(day.date).toLocaleDateString()}</td>
                            <td>${day.totalEntries}</td>
                            <td>${day.totalExits}</td>
                            <td>${day.uniqueVehicles}</td>
                            <td>${day.averageDuration}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="report-section">
            <h4>Vehicle Statistics</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Plate Number</th>
                        <th>Vehicle Name</th>
                        <th>Total Entries</th>
                        <th>Total Exits</th>
                        <th>Total Duration (min)</th>
                        <th>Avg Duration (min)</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.sections.vehicles
                      .map(
                        (vehicle) => `
                        <tr>
                            <td>${vehicle.plateNo || "-"}</td>
                            <td>${vehicle.vehicleName || "-"}</td>
                            <td>${vehicle.totalEntries}</td>
                            <td>${vehicle.totalExits}</td>
                            <td>${vehicle.totalDuration}</td>
                            <td>${vehicle.averageDuration}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="report-section">
            <h4>Currently Parked Vehicles</h4>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Plate Number</th>
                        <th>Vehicle Name</th>
                        <th>Time In</th>
                        <th>Duration (min)</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.sections.parking
                      .map(
                        (vehicle) => `
                        <tr>
                            <td>${vehicle.plateNo || "-"}</td>
                            <td>${vehicle.vehicleName || "-"}</td>
                            <td>${new Date(
                              vehicle.timeIn
                            ).toLocaleString()}</td>
                            <td>${vehicle.duration}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

function displayTimeLogsReport(report) {
  if (
    !report.details ||
    !Array.isArray(report.details) ||
    report.details.length === 0
  ) {
    return `<div class="report-section"><p>No time logs found.</p></div>`;
  }
  return `
    <div class="report-section">
      <h4>Time Logs</h4>
      <table class="report-table">
        <thead>
          <tr>
            <th>Vehicle Name</th>
            <th>Time In</th>
            <th>Time Out</th>
          </tr>
        </thead>
        <tbody>
          ${report.details
            .map(
              (log) => `
                <tr>
                  <td>${log.vehicle?.vehicleName || "-"}</td>
                  <td>${
                    log.timeIn ? new Date(log.timeIn).toLocaleString() : "-"
                  }</td>
                  <td>${
                    log.timeOut ? new Date(log.timeOut).toLocaleString() : "-"
                  }</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Export report function
async function exportReport(format) {
  if (format !== "excel") return;
  if (!timelogsData || timelogsData.length === 0) {
    alert("No report to export. Please load data first.");
    return;
  }

  // Get the current date range for the filename
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;
  const dateRangeText =
    startDate && endDate ? `_${startDate}_to_${endDate}` : "";

  // Get headers from the table
  const headers = ["Vehicle Name", "Time In", "Time Out"];

  // Prepare data rows
  const rows = timelogsData.map((log) => [
    log.vehicle?.vehicleName || "",
    log.timeIn ? new Date(log.timeIn).toLocaleString() : "",
    log.timeOut ? new Date(log.timeOut).toLocaleString() : "",
  ]);

  console.log(
    `Exporting ${timelogsData.length} records for date range: ${startDate} to ${endDate}`
  );

  // Try to use SheetJS (xlsx) if available
  let isSheetJS = false;
  try {
    var XLSX = require("xlsx");
    isSheetJS = true;
  } catch (e) {
    isSheetJS = false;
  }

  if (isSheetJS) {
    // SheetJS export
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Add color to header row (A1:C1 for 3 columns)
    const headerRange = ["A1", "B1", "C1"];
    headerRange.forEach((cell) => {
      if (!ws[cell]) return;
      ws[cell].s = {
        fill: {
          patternType: "solid",
          fgColor: { rgb: "C6EFCE" }, // Light green
        },
        font: {
          bold: true,
        },
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TimeLogs");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timelogs-report-${
      new Date().toISOString().split("T")[0]
    }${dateRangeText}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success message
    showToast(
      `Successfully exported ${timelogsData.length} records for date range: ${startDate} to ${endDate}`
    );
  } else {
    // Fallback: CSV with .csv extension
    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")
        )
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timelogs-report-${
      new Date().toISOString().split("T")[0]
    }${dateRangeText}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success message
    showToast(
      `Successfully exported ${timelogsData.length} records for date range: ${startDate} to ${endDate} (CSV format)`
    );
    alert("Excel export module not found. Exported as CSV instead.");
  }
}

// Add this function near your other export/report functions
async function exportReportExcel() {
  if (!timelogsData || timelogsData.length === 0) {
    alert("No report to export. Please load data first.");
    return;
  }
  const rows = timelogsData.map((log) => [
    log.vehicle?.vehicleName || "",
    log.timeIn ? new Date(log.timeIn).toLocaleString() : "",
    log.timeOut ? new Date(log.timeOut).toLocaleString() : "",
  ]);
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;
  try {
    const result = await window
      .require("electron")
      .ipcRenderer.invoke("export-timelogs-excel", {
        rows,
        startDate,
        endDate,
      });
    if (result.success) {
      showToast("Excel exported with colored headers!");
    } else {
      alert("Export failed: " + result.message);
    }
  } catch (err) {
    alert("Export failed: " + err.message);
  }
}

// Helper functions
function getReportTitle(type) {
  const titles = {
    daily: "Daily Activity Report",
    vehicle: "Vehicle Statistics Report",
    parking: "Parking Status Report",
    comprehensive: "Comprehensive Report",
    timelogs: "Time Logs Report",
  };
  return titles[type] || "Report";
}

function formatStatLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/([A-Z])/g, " $1")
    .trim();
}

// Vehicle management functions
async function editVehicle(vehicleId) {
  try {
    // Get vehicle details
    const vehicles = await vehicleTracker.getAllVehiclesWithStats();
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    if (!vehicle) {
      alert("Vehicle not found");
      return;
    }

    showEditVehicleModal(vehicle);
  } catch (error) {
    console.error("Error loading vehicle for editing:", error);
    alert("Error loading vehicle details: " + error.message);
  }
}

function deleteVehicle(vehicleId) {
  if (confirm("Are you sure you want to delete this vehicle?")) {
    // TODO: Implement vehicle deletion
    alert(`Delete vehicle ${vehicleId} - Functionality coming soon`);
  }
}

// User management functions
function editUser(userId) {
  // TODO: Implement user editing
  alert(`Edit user ${userId} - Functionality coming soon`);
}

function deleteUser(userId) {
  if (confirm("Are you sure you want to delete this user?")) {
    // TODO: Implement user deletion
    alert(`Delete user ${userId} - Functionality coming soon`);
  }
}

function showAddUserModal() {
  const addUserModal = document.createElement("div");
  addUserModal.className = "modal";
  addUserModal.style.display = "flex";

  addUserModal.innerHTML = `
    <div class="modal-content material-modal">
      <div class="modal-header material-modal-header">
        <span class="modal-title">Add New User</span>
        <button class="modal-close-btn" type="button" aria-label="Close" onclick="this.closest('.modal').remove()">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <form id="add-user-form" class="material-modal-body">
        <div class="material-form-grid" style="grid-template-columns: 1fr;">
          <div class="form-group">
            <label for="new-email">Email</label>
            <input type="email" id="new-email" required placeholder="Enter email address">
          </div>
          <div class="form-group">
            <label for="new-password">Password</label>
            <input type="password" id="new-password" required placeholder="Enter password">
          </div>
          <div class="form-group">
            <label for="new-role">Role</label>
            <select id="new-role" required>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
        <div class="modal-footer material-modal-footer">
          <button type="submit" class="btn-primary">Add User</button>
          <button type="button" class="cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(addUserModal);

  // Add the toggle button after the password input
  const passwordInput = addUserModal.querySelector("#new-password");
  if (passwordInput) {
    // Create toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleBtn.style.position = "absolute";
    toggleBtn.style.right = "10px";
    toggleBtn.style.top = "50%";
    toggleBtn.style.transform = "translateY(-50%)";
    toggleBtn.style.background = "none";
    toggleBtn.style.border = "none";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.padding = "0";
    toggleBtn.style.outline = "none";

    // Wrap the password input in a relative container
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    passwordInput.parentNode.insertBefore(wrapper, passwordInput);
    wrapper.appendChild(passwordInput);
    wrapper.appendChild(toggleBtn);

    // Toggle logic
    toggleBtn.addEventListener("click", function () {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
      } else {
        passwordInput.type = "password";
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      }
    });
  }

  // Add form submit handler
  const addUserForm = addUserModal.querySelector("#add-user-form");
  if (addUserForm) {
    addUserForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById("new-email").value.trim();
      const password = document.getElementById("new-password").value;
      const role = document.getElementById("new-role").value;
      if (!email || !password || !role) {
        alert("Please enter all fields.");
        return;
      }
      const result = await registerUser(email, password, role);
      if (result.success) {
        addUserModal.remove();
        showToast("User registered successfully!", () => {
          loadUsersData();
        });
      } else {
        alert("Registration failed: " + result.message);
      }
    });
  }
}

// Auto-refresh dashboard data every 30 seconds
setInterval(() => {
  if (currentPage === "dashboard") {
    loadDashboardData();
  }
}, 30000);

// Register a new user via IPC
async function registerUser(email, password, role) {
  try {
    const result = await ipcRenderer.invoke("register-user", {
      email,
      password,
      role,
    });
    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Toast notification logic
function showToast(message, onHide) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  toast.style.display = "block";
  setTimeout(() => {
    toast.classList.remove("show");
    toast.style.display = "none";
    if (typeof onHide === "function") onHide();
  }, 2000);
}

// RFID Tag management functions
async function manageVehicleTags(vehicleId) {
  try {
    // Get vehicle details and current tags
    const vehicles = await vehicleTracker.getAllVehiclesWithStats();
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    if (!vehicle) {
      alert("Vehicle not found");
      return;
    }

    // Get all available RFID tags
    const allTags = await vehicleTracker.getAllRfidTags();

    showTagManagementModal(vehicle, allTags);
  } catch (error) {
    console.error("Error loading tag management:", error);
    alert("Error loading tag management: " + error.message);
  }
}

function showTagManagementModal(vehicle, allTags) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";

  const currentTags = vehicle.rfidTags || [];

  modal.innerHTML = `
    <div class="modal-content material-modal">
      <div class="modal-header material-modal-header">
        <span class="modal-title">Manage RFID Tags - ${
          vehicle.plateNo || vehicle.vehicleName
        }</span>
        <button class="modal-close-btn" type="button" aria-label="Close" onclick="this.closest('.modal').remove()">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <div class="material-modal-body">
        <div class="tag-management-section">
          <h3>Current Tags</h3>
          <div class="current-tags-container" style="
            max-height: 280px;
            overflow-y: auto;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            padding: 16px;
            background-color: #f8f9fa;
            margin-bottom: 24px;
          ">
            <div class="current-tags" style="
              display: flex;
              flex-direction: column;
              gap: 8px;
            ">
              ${
                currentTags.length > 0
                  ? currentTags
                      .map(
                        (tag) => `
                <div class="tag-item" style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 8px 12px;
                  background: white;
                  border-radius: 6px;
                  border: 1px solid #dee2e6;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                ">
                  <span class="tag-badge ${
                    tag.tagType?.toLowerCase() || "default"
                  }" style="
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: 500;
                  ">
                    ${tag.tagType || "Unknown"} - ${tag.epc}
                  </span>
                  <button class="remove-tag-btn" onclick="removeTagFromVehicle(${
                    vehicle.id
                  }, '${tag.epc}')" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background-color 0.2s;
                  " onmouseover="this.style.backgroundColor='#c82333'" onmouseout="this.style.backgroundColor='#dc3545'">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `
                      )
                      .join("")
                  : "<p style='text-align: center; color: #6c757d; font-style: italic; margin: 20px 0;'>No tags assigned to this vehicle.</p>"
              }
            </div>
          </div>
        </div>
        <div class="tag-management-section">
          <h3>Add New Tag</h3>
          <form id="add-tag-form">
            <div class="form-row">
              <div class="form-group">
                <label for="new-tag-epc">EPC Tag ID:</label>
                <input type="text" id="new-tag-epc" required placeholder="Enter EPC tag ID">
              </div>
              <div class="form-group">
                <label for="new-tag-type">Tag Type:</label>
                <select id="new-tag-type" required>
                  <option value="EasyTrip">EasyTrip</option>
                  <option value="EasySweep">EasySweep</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>
            <div class="modal-footer material-modal-footer">
              <button type="submit" class="btn-primary">Add Tag</button>
              <button type="button" class="cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add form submit handler
  const addTagForm = modal.querySelector("#add-tag-form");
  if (addTagForm) {
    addTagForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const epc = document.getElementById("new-tag-epc").value.trim();
      const tagType = document.getElementById("new-tag-type").value;
      if (!epc) {
        alert("Please enter an EPC tag ID");
        return;
      }
      try {
        const result = await vehicleTracker.addRfidTagToVehicle(
          vehicle.id,
          epc,
          tagType
        );
        if (result.status === "tag_added") {
          showToast("Tag added successfully!");
          loadVehiclesData(); // Refresh the table
          modal.remove();
        } else if (result.status === "tag_exists") {
          alert("This tag is already assigned to another vehicle");
        } else {
          alert("Error adding tag: " + result.message);
        }
      } catch (error) {
        console.error("Error adding tag:", error);
        alert("Error adding tag: " + error.message);
      }
    });
  }
}

async function assignTagToVehicle(vehicleId, epc) {
  try {
    const result = await vehicleTracker.addRfidTagToVehicle(vehicleId, epc);

    if (result.status === "tag_added") {
      showToast("Tag assigned successfully!");
      loadVehiclesData(); // Refresh the table
      // Refresh modal
      manageVehicleTags(vehicleId);
    } else if (result.status === "tag_exists") {
      alert("This tag is already assigned to another vehicle");
    } else {
      alert("Error assigning tag: " + result.message);
    }
  } catch (error) {
    console.error("Error assigning tag:", error);
    alert("Error assigning tag: " + error.message);
  }
}

async function removeTagFromVehicle(vehicleId, epc) {
  if (!confirm("Are you sure you want to remove this tag from the vehicle?")) {
    return;
  }

  try {
    const result = await vehicleTracker.deactivateRfidTag(epc);

    if (result) {
      showToast("Tag removed successfully!");
      loadVehiclesData(); // Refresh the table
      // Refresh modal
      manageVehicleTags(vehicleId);
    } else {
      alert("Error removing tag");
    }
  } catch (error) {
    console.error("Error removing tag:", error);
    alert("Error removing tag: " + error.message);
  }
}

function showAddVehicleModal() {
  console.log("showAddVehicleModal called");
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";

  modal.innerHTML = `
    <div class="modal-content material-modal">
      <div class="modal-header material-modal-header">
        <span class="modal-title">Add New Vehicle</span>
        <button class="modal-close-btn" type="button" aria-label="Close" onclick="this.closest('.modal').remove()">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <form id="add-vehicle-form" class="material-modal-body">
        <div class="material-form-grid">
          <div class="form-group">
            <label for="vehicle-plate">Plate Number</label>
            <input type="text" id="vehicle-plate" required placeholder="Enter plate number">
          </div>
          <div class="form-group">
            <label for="vehicle-name">Vehicle Name</label>
            <input type="text" id="vehicle-name" required placeholder="Enter vehicle name">
          </div>
          <div class="form-group">
            <label for="vehicle-epc">RFID Tag EPC</label>
            <input type="text" id="vehicle-epc" required placeholder="Enter EPC tag ID">
          </div>
          <div class="form-group">
            <label for="vehicle-tag-type">Tag Type</label>
            <select id="vehicle-tag-type" required>
              <option value="EasyTrip">EasyTrip</option>
              <option value="EasySweep">EasySweep</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </div>
        <div class="modal-footer material-modal-footer">
          <button type="submit" class="btn-primary">Add Vehicle</button>
          <button type="button" class="cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Add form submit handler
  const addVehicleForm = modal.querySelector("#add-vehicle-form");
  if (addVehicleForm) {
    addVehicleForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const plateNo = document.getElementById("vehicle-plate").value.trim();
      const vehicleName = document.getElementById("vehicle-name").value.trim();
      const epc = document.getElementById("vehicle-epc").value.trim();
      const tagType = document.getElementById("vehicle-tag-type").value;
      if (!plateNo || !vehicleName || !epc) {
        alert("Please fill in all required fields");
        return;
      }
      try {
        const result = await vehicleTracker.registerVehicle({
          plateNo,
          vehicleName,
          epc,
          tagType,
        });
        if (result.status === "registered") {
          showToast("Vehicle added successfully!");
          loadVehiclesData();
          modal.remove();
        } else if (result.status === "tag_exists") {
          alert("This RFID tag is already registered to another vehicle");
        } else {
          alert("Error adding vehicle: " + result.message);
        }
      } catch (error) {
        console.error("Error adding vehicle:", error);
        alert("Error adding vehicle: " + error.message);
      }
    });
  }
}

window.showAddVehicleModal = showAddVehicleModal;
window.showAddUserModal = showAddUserModal;

function showEditVehicleModal(vehicle) {
  console.log("showEditVehicleModal called for vehicle:", vehicle);
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";

  modal.innerHTML = `
    <div class="modal-content material-modal">
      <div class="modal-header material-modal-header">
        <span class="modal-title">Edit Vehicle - ${
          vehicle.plateNo || vehicle.vehicleName
        }</span>
        <button class="modal-close-btn" type="button" aria-label="Close" onclick="this.closest('.modal').remove()">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <form id="edit-vehicle-form" class="material-modal-body">
        <div class="material-form-grid">
          <div class="form-group">
            <label for="edit-vehicle-plate">Plate Number</label>
            <input type="text" id="edit-vehicle-plate" required placeholder="Enter plate number" value="${
              vehicle.plateNo || ""
            }">
          </div>
          <div class="form-group">
            <label for="edit-vehicle-name">Vehicle Name</label>
            <input type="text" id="edit-vehicle-name" required placeholder="Enter vehicle name" value="${
              vehicle.vehicleName || ""
            }">
          </div>
        </div>
        <div class="rfid-tags-section">
          <h4>Current RFID Tags</h4>
          <div class="current-rfid-tags">
            ${
              vehicle.rfidTags && vehicle.rfidTags.length > 0
                ? vehicle.rfidTags
                    .map(
                      (tag) => `
                    <div class="tag-item">
                      <span class="tag-badge ${
                        tag.tagType?.toLowerCase() || "default"
                      }">
                        ${tag.tagType || "Unknown"} - ${tag.epc}
                      </span>
                    </div>
                  `
                    )
                    .join("")
                : "<p>No RFID tags assigned to this vehicle.</p>"
            }
          </div>
          <p class="tag-note">
            <i class="fas fa-info-circle"></i>
            RFID tags can be managed separately using the "Manage RFID Tags" button.
          </p>
        </div>
        <div class="modal-footer material-modal-footer">
          <button type="submit" class="btn-primary">Update Vehicle</button>
          <button type="button" class="cancel-btn" onclick="this.closest('.modal').remove()">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Add form submit handler
  const editVehicleForm = modal.querySelector("#edit-vehicle-form");
  if (editVehicleForm) {
    editVehicleForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const plateNo = document
        .getElementById("edit-vehicle-plate")
        .value.trim();
      const vehicleName = document
        .getElementById("edit-vehicle-name")
        .value.trim();

      if (!plateNo || !vehicleName) {
        alert("Please fill in all required fields");
        return;
      }

      try {
        const result = await vehicleTracker.updateVehicle(vehicle.id, {
          plateNo,
          vehicleName,
        });

        if (result.status === "updated") {
          showToast("Vehicle updated successfully!");
          loadVehiclesData(); // Refresh the table
          modal.remove();
        } else {
          alert(
            "Error updating vehicle: " + (result.message || "Unknown error")
          );
        }
      } catch (error) {
        console.error("Error updating vehicle:", error);
        alert("Error updating vehicle: " + error.message);
      }
    });
  }
}

// Add this function to script.js
function showDbUrlEditorModal() {
  // Remove any existing modal
  const existing = document.getElementById("db-url-modal");
  if (existing) existing.remove();

  // Create modal overlay
  const modal = document.createElement("div");
  modal.id = "db-url-modal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0,0,0,0.3)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9998";

  modal.innerHTML = `
    <div style="background: #fff; padding: 40px 32px; border-radius: 12px; min-width: 500px; min-height: 420px; max-width: 95vw; box-shadow: 0 4px 24px rgba(0,0,0,0.18); position: relative; z-index: 10000;">
      <button id="close-db-url-modal" style="position: absolute; top: 14px; right: 14px; background: none; border: none; font-size: 1.7rem; cursor: pointer; color: #888;">&times;</button>
      <h2 style="margin-top:0; margin-bottom: 36px; color: #333; font-weight: 600;">Edit Database URL</h2>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Provider</label>
        <input id="db-provider" type="text" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="e.g., mysql" />
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Username</label>
        <input id="db-username" type="text" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="e.g., root" />
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Password</label>
        <input id="db-password" type="password" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="Enter password" />
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Host</label>
        <input id="db-host" type="text" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="e.g., localhost" />
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Port</label>
        <input id="db-port" type="text" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="e.g., 3306" value="3306" />
      </div>
      
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Database Name</label>
        <input id="db-name" type="text" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="e.g., rfid_tracker" />
      </div>
      
      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button id="test-db-connection-btn-modal" style="padding: 10px 20px; border: 1px solid #28a745; background: #28a745; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;">Test Connection</button>
        <button id="cancel-db-url-btn-modal" style="padding: 10px 20px; border: 1px solid #ddd; background: #f8f9fa; color: #666; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;">Cancel</button>
        <button id="save-db-url-btn-modal" class="btn-primary" style="padding: 10px 20px; border-radius: 6px; font-size: 14px;">Save Settings</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Fetch and display current DB URL, parsing into fields
  ipcRenderer.invoke("get-db-url").then((dbUrl) => {
    try {
      const parsed = new URL(dbUrl);
      document.getElementById("db-provider").value = parsed.protocol.replace(
        ":",
        ""
      );
      document.getElementById("db-username").value = decodeURIComponent(
        parsed.username
      );
      document.getElementById("db-password").value = decodeURIComponent(
        parsed.password
      );
      document.getElementById("db-host").value = parsed.hostname;
      document.getElementById("db-port").value = parsed.port || "3306";
      document.getElementById("db-name").value = parsed.pathname.replace(
        /^\//,
        ""
      );
    } catch (e) {
      // fallback: clear fields
      document.getElementById("db-provider").value = "mysql";
      document.getElementById("db-username").value = "";
      document.getElementById("db-password").value = "";
      document.getElementById("db-host").value = "localhost";
      document.getElementById("db-port").value = "3306";
      document.getElementById("db-name").value = "";
    }
  });

  // Add hover and focus effects for text fields
  const inputs = modal.querySelectorAll("input");
  inputs.forEach((input) => {
    input.addEventListener("focus", function () {
      this.style.borderColor = "#007bff";
      this.style.boxShadow = "0 0 0 3px rgba(0, 123, 255, 0.1)";
    });

    input.addEventListener("blur", function () {
      this.style.borderColor = "#e1e5e9";
      this.style.boxShadow = "none";
    });

    input.addEventListener("mouseenter", function () {
      if (document.activeElement !== this) {
        this.style.borderColor = "#c1c7cd";
      }
    });

    input.addEventListener("mouseleave", function () {
      if (document.activeElement !== this) {
        this.style.borderColor = "#e1e5e9";
      }
    });
  });

  // Save handler: combine fields into a URL and save
  const saveBtn = document.getElementById("save-db-url-btn-modal");
  saveBtn.addEventListener("click", async () => {
    const provider = document.getElementById("db-provider").value.trim();
    const username = encodeURIComponent(
      document.getElementById("db-username").value.trim()
    );
    const password = encodeURIComponent(
      document.getElementById("db-password").value.trim()
    );
    const host = document.getElementById("db-host").value.trim();
    const port = document.getElementById("db-port").value.trim();
    const dbname = document.getElementById("db-name").value.trim();
    const url = `${provider}://${username}:${password}@${host}:${port}/${dbname}`;
    const result = await ipcRenderer.invoke("set-db-url", url);
    if (result.success) {
      const staticField = document.getElementById("admin-db-url-static");
      if (staticField) {
        staticField.value = url;
      }
      // Call the DB INIT handler and await it before closing the modal
      const checkResult = await ipcRenderer.invoke("check-and-init-db", url);
      modal.remove();
      showToast(
        "Database URL saved! Please restart the app for changes to take effect." +
          (checkResult.success
            ? " " + checkResult.message
            : " (DB check failed: " + checkResult.error + ")")
      );
    } else {
      alert("Failed to save: " + result.error);
    }
  });

  // Close handler
  document
    .getElementById("close-db-url-modal")
    .addEventListener("click", () => {
      modal.remove();
    });

  // Cancel button handler
  document
    .getElementById("cancel-db-url-btn-modal")
    .addEventListener("click", () => {
      modal.remove();
    });

  // Test connection button handler
  document
    .getElementById("test-db-connection-btn-modal")
    .addEventListener("click", async () => {
      const provider = document.getElementById("db-provider").value.trim();
      const username = document.getElementById("db-username").value.trim();
      const password = document.getElementById("db-password").value.trim();
      const host = document.getElementById("db-host").value.trim();
      const port = document.getElementById("db-port").value.trim();
      const dbName = document.getElementById("db-name").value.trim();

      if (!provider || !username || !host || !port || !dbName) {
        alert("Please fill in all required fields (password is optional)");
        return;
      }

      // Construct the database URL
      const dbUrl = `${provider}://${username}:${password}@${host}:${port}/${dbName}`;

      // Close the modal immediately
      const modalElem = document.getElementById("db-url-modal");
      if (modalElem) modalElem.remove();

      // Show loading modal
      showLoadingModal("Connecting...");

      try {
        const result = await ipcRenderer.invoke("test-db-connection", dbUrl);
        hideLoadingModal();
        if (result.success) {
          alert("Connection Successful!\n" + (result.message || ""));
        } else {
          alert("Connection Failed:\n" + (result.error || "Unknown error"));
        }
      } catch (error) {
        hideLoadingModal();
        alert("Connection Error:\n" + (error.message || "Unknown error"));
      }
    });
}

// Add RFID Settings Modal function
function showRfidSettingsModal() {
  // Remove any existing modal
  const existing = document.getElementById("rfid-settings-modal");
  if (existing) existing.remove();

  // Create modal overlay
  const modal = document.createElement("div");
  modal.id = "rfid-settings-modal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0,0,0,0.3)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9998";

  modal.innerHTML = `
    <div style="background: #fff; padding: 40px 32px; border-radius: 12px; min-width: 500px; min-height: 280px; max-width: 95vw; box-shadow: 0 4px 24px rgba(0,0,0,0.18); position: relative; z-index: 10000;">
      <button id="close-rfid-settings-modal" style="position: absolute; top: 14px; right: 14px; background: none; border: none; font-size: 1.7rem; cursor: pointer; color: #888;">&times;</button>
      <h2 style="margin-top:0; margin-bottom: 36px; color: #333; font-weight: 600;">Edit RFID Settings</h2>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Reader IP Address</label>
        <input id="rfid-ip" type="text" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="e.g., 10.10.100.254" />
      </div>
      
      <div style="margin-bottom: 24px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 14px;">Reader Port</label>
        <input id="rfid-port" type="number" style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; box-sizing: border-box;" placeholder="e.g., 49152" min="1" max="65535" />
      </div>
      
      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <button id="test-rfid-connection-btn-modal" style="padding: 10px 20px; border: 1px solid #28a745; background: #28a745; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;">Test Connection</button>
        <button id="cancel-rfid-settings-btn-modal" style="padding: 10px 20px; border: 1px solid #ddd; background: #f8f9fa; color: #666; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;">Cancel</button>
        <button id="save-rfid-settings-btn-modal" class="btn-primary" style="padding: 10px 20px; border-radius: 6px; font-size: 14px;">Save Settings</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Fetch and display current RFID settings
  ipcRenderer.invoke("get-rfid-settings").then((result) => {
    if (result.success) {
      document.getElementById("rfid-ip").value = result.settings.ip;
      document.getElementById("rfid-port").value = result.settings.port;
    } else {
      // Set defaults if failed to fetch
      document.getElementById("rfid-ip").value = "10.10.100.254";
      document.getElementById("rfid-port").value = "49152";
    }
  });

  // Add hover and focus effects for text fields
  const inputs = modal.querySelectorAll("input");
  inputs.forEach((input) => {
    input.addEventListener("focus", function () {
      this.style.borderColor = "#007bff";
      this.style.boxShadow = "0 0 0 3px rgba(0, 123, 255, 0.1)";
    });

    input.addEventListener("blur", function () {
      this.style.borderColor = "#e1e5e9";
      this.style.boxShadow = "none";
    });

    input.addEventListener("mouseenter", function () {
      if (document.activeElement !== this) {
        this.style.borderColor = "#c1c7cd";
      }
    });

    input.addEventListener("mouseleave", function () {
      if (document.activeElement !== this) {
        this.style.borderColor = "#e1e5e9";
      }
    });
  });

  // Save handler
  const saveBtn = document.getElementById("save-rfid-settings-btn-modal");
  saveBtn.addEventListener("click", async () => {
    const ip = document.getElementById("rfid-ip").value.trim();
    const port = parseInt(document.getElementById("rfid-port").value.trim());

    if (!ip || !port) {
      alert("Please fill in all fields");
      return;
    }

    const result = await ipcRenderer.invoke("set-rfid-settings", { ip, port });
    if (result.success) {
      // Update the static fields
      const ipField = document.getElementById("rfid-ip-static");
      const portField = document.getElementById("rfid-port-static");
      if (ipField) ipField.value = ip;
      if (portField) portField.value = port;

      modal.remove();
      showToast(
        "RFID settings updated successfully! Please restart the app for changes to take effect."
      );
    } else {
      alert("Failed to save RFID settings: " + result.error);
    }
  });

  // Close handler
  document
    .getElementById("close-rfid-settings-modal")
    .addEventListener("click", () => {
      modal.remove();
    });

  // Cancel button handler
  document
    .getElementById("cancel-rfid-settings-btn-modal")
    .addEventListener("click", () => {
      modal.remove();
    });

  // Test connection button handler
  document
    .getElementById("test-rfid-connection-btn-modal")
    .addEventListener("click", async () => {
      const ip = document.getElementById("rfid-ip").value.trim();
      const port = parseInt(document.getElementById("rfid-port").value.trim());

      if (!ip || !port) {
        alert("Please fill in both IP address and port fields");
        return;
      }

      // Close the modal immediately
      const modalElem = document.getElementById("rfid-settings-modal");
      if (modalElem) modalElem.remove();

      // Show loading modal
      showLoadingModal("Connecting...");

      try {
        const result = await ipcRenderer.invoke("test-rfid-connection", {
          ip,
          port,
        });
        hideLoadingModal();
        if (result.success) {
          alert("Connection Successful!\n" + (result.message || ""));
        } else {
          alert("Connection Failed:\n" + (result.error || "Unknown error"));
        }
      } catch (error) {
        hideLoadingModal();
        alert("Connection Error:\n" + (error.message || "Unknown error"));
      }
    });
}

// Utility: Show/hide custom loading modal
function showLoadingModal(message = "Connecting...") {
  // Remove any existing loading modal
  const existing = document.getElementById("custom-loading-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "custom-loading-modal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.background = "rgba(0,0,0,0.2)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "20000";

  modal.innerHTML = `
    <div style="background: #fff; padding: 32px 40px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4px 24px rgba(0,0,0,0.18);">
      <div class="loader" style="border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; margin-bottom: 18px;"></div>
      <div style="font-size: 18px; color: #333; font-weight: 500;">${message}</div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg);}
        100% { transform: rotate(360deg);}
      }
    </style>
  `;
  document.body.appendChild(modal);
}

function hideLoadingModal() {
  const modal = document.getElementById("custom-loading-modal");
  if (modal) modal.remove();
}

async function loadTimeLogsTable(page = 1) {
  const reportContent = document.getElementById("report-content");
  reportContent.innerHTML = `
    <div class="users-table-container">
      <div class="table-scroll-container">
        <table class="users-table" id="timelogs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vehicle ID</th>
              <th>Vehicle Name</th>
              <th>Time In</th>
              <th>Time Out</th>
            </tr>
          </thead>
          <tbody id="timelogs-tbody"></tbody>
        </table>
      </div>
      <div class="table-divider"></div>
      <div id="timelogs-pagination" class="pagination-container"></div>
    </div>
  `;
  try {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    const result = await ipcRenderer.invoke("get-all-timelogs", {
      startDate,
      endDate,
    });
    if (!result.success) {
      document.getElementById(
        "timelogs-tbody"
      ).innerHTML = `<tr><td colspan='5'>Error: ${result.error}</td></tr>`;
      return;
    }
    timelogsData = result.logs || [];
    timelogsCurrentPage = page;
    renderTimeLogsTable();
    renderTimeLogsPagination(timelogsData.length);
  } catch (err) {
    document.getElementById(
      "timelogs-tbody"
    ).innerHTML = `<tr><td colspan='5'>Error loading time logs: ${err.message}</td></tr>`;
  }
}

function renderTimeLogsTable() {
  const tbody = document.getElementById("timelogs-tbody");
  if (!tbody) return;
  const startIndex = (timelogsCurrentPage - 1) * timelogsRowsPerPage;
  const endIndex = startIndex + timelogsRowsPerPage;
  const paginatedLogs = timelogsData.slice(startIndex, endIndex);
  tbody.innerHTML = paginatedLogs
    .map(
      (log) => `
        <tr>
          <td>${log.id}</td>
          <td>${log.vehicleId || ""}</td>
          <td>${log.vehicle?.vehicleName || ""}</td>
          <td>${log.timeIn ? new Date(log.timeIn).toLocaleString() : ""}</td>
          <td>${log.timeOut ? new Date(log.timeOut).toLocaleString() : ""}</td>
        </tr>
      `
    )
    .join("");
  // Add blank rows if needed
  const blankRows = timelogsRowsPerPage - paginatedLogs.length;
  for (let i = 0; i < blankRows; i++) {
    const emptyRow = document.createElement("tr");
    for (let j = 0; j < 5; j++) {
      // 5 columns
      const emptyCell = document.createElement("td");
      emptyCell.innerHTML = "&nbsp;";
      emptyRow.appendChild(emptyCell);
    }
    tbody.appendChild(emptyRow);
  }
  // Enable export button if there is data
  const exportBtn = document.getElementById("export-excel-btn");
  if (exportBtn) exportBtn.disabled = timelogsData.length === 0;
}

function renderTimeLogsPagination(total) {
  const container = document.getElementById("timelogs-pagination");
  if (!container) return;
  container.className = "pagination-container";
  const totalPages = Math.ceil(total / timelogsRowsPerPage);
  let html = "";
  if (totalPages > 1) {
    html += `<button class="pagination-btn" ${
      timelogsCurrentPage === 1 ? "disabled" : ""
    } onclick="loadTimeLogsTable(${
      timelogsCurrentPage - 1
    })">Previous</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-btn${
        i === timelogsCurrentPage ? " active" : ""
      }" onclick="loadTimeLogsTable(${i})">${i}</button>`;
    }
    html += `<button class="pagination-btn" ${
      timelogsCurrentPage === totalPages ? "disabled" : ""
    } onclick="loadTimeLogsTable(${timelogsCurrentPage + 1})">Next</button>`;
  }
  container.innerHTML = html;
}
