(function () {
  "use strict";

  const loginPanel = document.getElementById("loginPanel");
  const exportPanel = document.getElementById("exportPanel");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("adminPassword");
  const loginStatus = document.getElementById("loginStatus");
  const signOutButton = document.getElementById("signOutButton");

  function showExportPanel() {
    loginPanel.hidden = true;
    exportPanel.hidden = false;
  }

  function showLoginPanel() {
    loginPanel.hidden = false;
    exportPanel.hidden = true;
    passwordInput.value = "";
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginStatus.textContent = "Signing in...";
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password: passwordInput.value }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Login failed.");
      loginStatus.textContent = "";
      showExportPanel();
    } catch (error) {
      loginStatus.textContent = error.message;
    }
  });

  signOutButton.addEventListener("click", () => {
    document.cookie = "genvoucher_admin=; Max-Age=0; Path=/api/admin";
    showLoginPanel();
  });
})();
