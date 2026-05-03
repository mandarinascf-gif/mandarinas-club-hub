document.addEventListener("DOMContentLoaded", async () => {
  const adminAuth = window.MandarinasAdminAuth;
  const PENDING_EMAIL_KEY = "mcfPendingAdminOtpEmail";
  const statusLine = document.getElementById("busses-access-status");
  const accessCopy = document.getElementById("busses-access-copy");
  const quickActions = document.getElementById("busses-quick-actions");
  const signInForm = document.getElementById("busses-sign-in-form");
  const emailInput = document.getElementById("busses-email");
  const codeInput = document.getElementById("busses-code");
  const codeField = document.getElementById("busses-code-field");
  const codeHelp = document.getElementById("busses-code-help");
  const sendCodeButton = document.getElementById("busses-send-code-button");
  const verifyCodeButton = document.getElementById("busses-verify-code-button");
  const continueButton = document.getElementById("busses-continue-button");
  const signOutButton = document.getElementById("busses-sign-out-button");

  function safeNextHref() {
    const params = new URLSearchParams(window.location.search);
    const rawNext = params.get("next") || "./seasons.html";

    try {
      const nextUrl = new URL(rawNext, window.location.href);
      if (nextUrl.origin !== window.location.origin) {
        return "./seasons.html";
      }

      const pageName = nextUrl.pathname.split("/").pop() || "seasons.html";
      if (pageName === "busses.html") {
        return "./seasons.html";
      }

      return `./${pageName}${nextUrl.search || ""}${nextUrl.hash || ""}`;
    } catch (error) {
      return "./seasons.html";
    }
  }

  function setStatus(message, tone = "") {
    statusLine.textContent = message;
    statusLine.className = tone ? `status-line ${tone}` : "status-line";
  }

  function getPendingEmail() {
    try {
      return window.sessionStorage.getItem(PENDING_EMAIL_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setPendingEmail(value) {
    try {
      const normalizedValue = String(value || "").trim().toLowerCase();
      if (normalizedValue) {
        window.sessionStorage.setItem(PENDING_EMAIL_KEY, normalizedValue);
        return;
      }

      window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
    } catch (error) {
      console.warn("[MandarinasBusses] Could not store pending admin email.", error);
    }
  }

  function showCodeStep(email = "") {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (normalizedEmail && emailInput) {
      emailInput.value = normalizedEmail;
    }

    if (codeField) {
      codeField.hidden = false;
    }
    if (codeHelp) {
      codeHelp.hidden = false;
    }
    if (verifyCodeButton) {
      verifyCodeButton.hidden = false;
    }
    if (sendCodeButton) {
      sendCodeButton.textContent = "Send a new code";
    }
  }

  function hideCodeStep() {
    if (codeInput) {
      codeInput.value = "";
    }
    if (codeField) {
      codeField.hidden = true;
    }
    if (codeHelp) {
      codeHelp.hidden = true;
    }
    if (verifyCodeButton) {
      verifyCodeButton.hidden = true;
    }
    if (sendCodeButton) {
      sendCodeButton.textContent = "Email me a code";
    }
  }

  function codeValue() {
    return String(codeInput?.value || "").trim().replace(/\s+/g, "");
  }

  function initializeCodeStep() {
    const pendingEmail = getPendingEmail();
    if (!pendingEmail) {
      hideCodeStep();
      return;
    }

    showCodeStep(pendingEmail);
  }

  function resetSignInFlow() {
    setPendingEmail("");
    if (signInForm) {
      signInForm.reset();
    }
    hideCodeStep();
  }

  function setSignedInState(isSignedIn, isAdmin = false) {
    if (quickActions) {
      quickActions.hidden = !isAdmin;
    }

    if (signInForm) {
      signInForm.hidden = isSignedIn;
    }

    if (continueButton) {
      continueButton.hidden = !isAdmin;
    }

    if (signOutButton) {
      signOutButton.hidden = !isSignedIn;
    }
  }

  function setBusy(isBusy) {
    if (emailInput) {
      emailInput.disabled = isBusy;
    }
    if (codeInput) {
      codeInput.disabled = isBusy;
    }
    if (sendCodeButton) {
      sendCodeButton.disabled = isBusy;
    }
    if (verifyCodeButton) {
      verifyCodeButton.disabled = isBusy;
    }
    if (continueButton) {
      continueButton.disabled = isBusy;
    }
    if (signOutButton) {
      signOutButton.disabled = isBusy;
    }
  }

  if (!adminAuth) {
    setSignedInState(false, false);
    initializeCodeStep();
    setStatus("Shared admin auth failed to load on this page.", "error");
    if (sendCodeButton) {
      sendCodeButton.disabled = true;
    }
    if (verifyCodeButton) {
      verifyCodeButton.disabled = true;
    }
    return;
  }

  async function syncAccessState() {
    setBusy(true);
    const access = await adminAuth.resolveAccess();
    setBusy(false);

    if (!access.ok) {
      setSignedInState(false, false);
      setStatus(adminAuth.readableAccessError(access.message), "error");
      return { ok: false };
    }

    if (!access.session?.user) {
      setSignedInState(false, false);
      initializeCodeStep();
      accessCopy.textContent =
        "Use an authorized Busses admin email to receive a 6-digit code and open the protected workspace.";
      setStatus(
        getPendingEmail()
          ? "Enter the email code to finish Busses access."
          : "Busses tools stay separate until an authorized admin email completes the email-code sign-in.",
        ""
      );
      return access;
    }

    if (!access.isAdmin) {
      setSignedInState(true, false);
      setPendingEmail("");
      hideCodeStep();
      accessCopy.textContent =
        "This browser session is signed in, but that email is not attached to a player with Busses access turned on.";
      setStatus(
        access.adminEmail
          ? `${access.adminEmail} is signed in, but it is not linked to a Busses-enabled player record.`
          : "This signed-in account is not linked to a Busses-enabled player record.",
        "error"
      );
      return access;
    }

    setSignedInState(true, true);
    setPendingEmail("");
    hideCodeStep();
    accessCopy.textContent =
      "This browser session already has active Busses access. Continue into the protected workspace or open a quick action below.";
    setStatus("Busses access is active for this browser session.", "success");
    return access;
  }

  continueButton?.addEventListener("click", () => {
    window.location.href = safeNextHref();
  });

  signOutButton?.addEventListener("click", async () => {
    setBusy(true);
    const result = await adminAuth.signOut();
    setBusy(false);

    if (!result.ok) {
      setStatus(adminAuth.readableAccessError(result.message), "error");
      return;
    }

    resetSignInFlow();
    await syncAccessState();
  });

  sendCodeButton?.addEventListener("click", async () => {
    setBusy(true);
    setStatus("Sending Busses email code...", "");

    const result = await adminAuth.sendEmailOtp(emailInput?.value);
    setBusy(false);

    if (!result.ok) {
      setStatus(adminAuth.readableAccessError(result.message), "error");
      emailInput?.focus();
      emailInput?.select();
      return;
    }

    setPendingEmail(result.email);
    showCodeStep(result.email);
    setStatus(`Code sent to ${result.email}. Enter the 6-digit code to finish Busses access.`, "success");
    codeInput?.focus();
    codeInput?.select();
  });

  signInForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const pendingEmail = getPendingEmail() || String(emailInput?.value || "").trim().toLowerCase();
    if (!pendingEmail) {
      setStatus("Enter the admin email first, then request a code.", "error");
      emailInput?.focus();
      return;
    }

    if (!codeValue()) {
      setStatus("Enter the code from the email.", "error");
      codeInput?.focus();
      codeInput?.select();
      return;
    }

    setBusy(true);
    setStatus("Checking Busses email code...", "");

    const result = await adminAuth.verifyEmailOtp(pendingEmail, codeValue());
    setBusy(false);

    if (!result.ok) {
      setStatus(adminAuth.readableAccessError(result.message), "error");
      codeInput?.focus();
      codeInput?.select();
      return;
    }

    setPendingEmail("");

    if (!result.isAdmin) {
      hideCodeStep();
      setSignedInState(true, false);
      setStatus("This code worked, but that signed-in email is not authorized for the Busses workspace.", "error");
      return;
    }

    hideCodeStep();
    setSignedInState(true, true);
    setStatus("Busses access confirmed. Opening the protected workspace...", "success");
    window.location.href = safeNextHref();
  });

  initializeCodeStep();
  await syncAccessState();
});
