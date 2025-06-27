// Admin Panel Script
const { ipcRenderer } = require("electron");
const vehicleTracker = require("../../backend/vehicleTracker-service");
const { getAllUsers } = require("../../backend/Users/auth");

// Global variables
let currentPage = "dashboard";
let currentReport = null;

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
      // Reports page is already loaded
      break;
    case "vehicles":
      loadVehiclesData();
      break;
    case "users":
      loadUsersData();
      break;
    case "settings":
      // Settings page is static
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
async function loadVehiclesData() {
  try {
    const vehicles = await vehicleTracker.getAllVehiclesWithStats();
    const tbody = document.getElementById("vehicles-tbody");

    if (!tbody) return;

    tbody.innerHTML = vehicles
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
  } catch (error) {
    console.error("Error loading vehicles data:", error);
  }
}

// Load users data
async function loadUsersData() {
  try {
    const users = await getAllUsers();
    const tbody = document.getElementById("users-tbody");

    if (!tbody) return;

    if (users && users.length > 0) {
      tbody.innerHTML = users
        .map(
          (user) => `
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
        `
        )
        .join("");
    } else {
      tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    <p>No users found or functionality coming soon...</p>
                </td>
            </tr>
        `;
    }
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
            <p>Generated on: ${new Date(
              report.generatedAt
            ).toLocaleString()}</p>
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

// Export report function
async function exportReport(format) {
  if (!currentReport) {
    alert("No report to export. Please generate a report first.");
    return;
  }

  try {
    const exportedData = await vehicleTracker.exportReport(
      currentReport,
      format
    );

    // Create download link
    const blob = new Blob([exportedData], {
      type: format === "csv" ? "text/csv" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${new Date().toISOString().split("T")[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(`Error exporting report: ${error.message}`);
  }
}

// Helper functions
function getReportTitle(type) {
  const titles = {
    daily: "Daily Activity Report",
    vehicle: "Vehicle Statistics Report",
    parking: "Parking Status Report",
    comprehensive: "Comprehensive Report",
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
function editVehicle(vehicleId) {
  // TODO: Implement vehicle editing
  alert(`Edit vehicle ${vehicleId} - Functionality coming soon`);
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
          <div class="current-tags">
            ${
              currentTags.length > 0
                ? currentTags
                    .map(
                      (tag) => `
                <div class="tag-item">
                  <span class="tag-badge ${
                    tag.tagType?.toLowerCase() || "default"
                  }">
                    ${tag.tagType || "Unknown"} - ${tag.epc}
                  </span>
                  <button class="remove-tag-btn" onclick="removeTagFromVehicle(${
                    vehicle.id
                  }, '${tag.epc}')">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `
                    )
                    .join("")
                : "<p>No tags assigned to this vehicle.</p>"
            }
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
