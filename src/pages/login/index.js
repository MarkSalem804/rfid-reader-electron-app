const { ipcRenderer } = require("electron");

// Home button click handler
document.getElementById("home-btn").addEventListener("click", () => {
  window.location.href = "../../../index.html";
});

// Get form elements
const loginForm = document.getElementById("login-form");
const loginBtn = document.querySelector(".login-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// Add loading state function
function setLoadingState(isLoading) {
  if (isLoading) {
    loginBtn.textContent = "Logging in...";
    loginBtn.disabled = true;
    loginBtn.style.opacity = "0.7";
  } else {
    loginBtn.textContent = "Login";
    loginBtn.disabled = false;
    loginBtn.style.opacity = "1";
  }
}

// Add error message display
function showError(message) {
  // Remove existing error message
  const existingError = document.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }

  // Create and display new error message
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;

  // Insert error message before the form
  loginForm.insertBefore(errorDiv, loginForm.firstChild);
}

// Clear error message
function clearError() {
  const existingError = document.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }
}

// Form submission handler
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Clear any previous errors
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Basic validation
  if (!email || !password) {
    showError("Please enter both email and password");
    return;
  }

  // Set loading state
  setLoadingState(true);

  try {
    // Send login request to main process
    const result = await ipcRenderer.invoke("admin-login", {
      email,
      password,
    });

    if (result.success) {
      // Show success message briefly before redirecting
      loginBtn.textContent = "Login Successful!";
      loginBtn.style.backgroundColor = "#10b981";

      // Redirect to admin panel after a short delay
      setTimeout(() => {
        window.location.href = "../admin/index.html";
      }, 1000);
    } else {
      showError(result.message || "Invalid email or password");
      setLoadingState(false);
    }
  } catch (error) {
    console.error("Login error:", error);
    showError("Login failed: " + error.message);
    setLoadingState(false);
  }
});

// Clear error when user starts typing
emailInput.addEventListener("input", clearError);
passwordInput.addEventListener("input", clearError);

// Focus on email field when page loads
window.addEventListener("load", () => {
  emailInput.focus();
});
