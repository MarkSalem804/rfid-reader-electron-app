const { ipcRenderer } = require("electron");

// Home button click handler
document.getElementById("home-btn").addEventListener("click", () => {
  window.location.href = "../../../index.html";
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    // Send login request to main process
    const result = await ipcRenderer.invoke("admin-login", {
      username,
      password,
    });

    if (result.success) {
      // If login successful, load admin panel
      window.location.href = "../admin/index.html";
    } else {
      alert("Invalid username or password");
    }
  } catch (error) {
    alert("Login failed: " + error.message);
  }
});
