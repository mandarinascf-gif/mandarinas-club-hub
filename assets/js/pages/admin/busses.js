document.addEventListener("DOMContentLoaded", async () => {
  const adminAuth = window.MandarinasAdminAuth;
  const statusLine = document.getElementById("busses-access-status");
  const accessCopy = document.getElementById("busses-access-copy");
  const quickActions = document.getElementById("busses-quick-actions");
  const signInForm = document.getElementById("busses-sign-in-form");
  const codeInput = document.getElementById("busses-code");
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

  function setUnlockedState(isUnlocked) {
    if (quickActions) {
      quickActions.hidden = !isUnlocked;
    }

    if (signInForm) {
      signInForm.hidden = isUnlocked;
    }

    if (continueButton) {
      continueButton.hidden = !isUnlocked;
    }

    if (signOutButton) {
      signOutButton.hidden = !isUnlocked;
    }
  }

  function setBusy(isBusy) {
    if (codeInput) {
      codeInput.disabled = isBusy;
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
    setUnlockedState(false);
    setStatus("Shared Busses gate failed to load on this page.", "error");
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
      setUnlockedState(false);
      setStatus(adminAuth.readableAccessError(access.message), "error");
      return { ok: false };
    }

    if (!access.isAdmin) {
      setUnlockedState(false);
      accessCopy.textContent =
        "Use the shared Busses code here, and if you came from a protected page, this tab will return there after access is confirmed.";
      setStatus("Busses tools stay separate until the shared access code is entered.", "");
      return access;
    }

    setUnlockedState(true);
    accessCopy.textContent =
      "This browser tab already has active Busses access. Continue into the protected workspace or open a quick action below.";
    setStatus("Busses access is active for this browser tab.", "success");
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

    if (signInForm) {
      signInForm.reset();
    }
    await syncAccessState();
  });

  signInForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("Checking Busses code...", "");

    const result = await adminAuth.verifyAccessCode(codeInput?.value);
    setBusy(false);

    if (!result.ok) {
      setStatus(adminAuth.readableAccessError(result.message), "error");
      codeInput?.focus();
      codeInput?.select();
      return;
    }

    codeInput.value = "";
    await syncAccessState();
    setStatus("Busses access confirmed. Opening the protected workspace...", "success");
    window.setTimeout(() => {
      window.location.href = safeNextHref();
    }, 160);
  });

  await syncAccessState();
});
