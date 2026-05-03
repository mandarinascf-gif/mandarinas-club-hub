document.addEventListener("DOMContentLoaded", async () => {
  const adminAuth = window.MandarinasAdminAuth;
  const statusLine = document.getElementById("busses-access-status");
  const accessCopy = document.getElementById("busses-access-copy");
  const quickActions = document.getElementById("busses-quick-actions");
  const signInForm = document.getElementById("busses-sign-in-form");
  const emailInput = document.getElementById("busses-email");
  const passwordInput = document.getElementById("busses-password");
  const signInButton = document.getElementById("busses-sign-in-button");
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

  function setSignedInState(isSignedIn, isAdmin = false) {
    if (quickActions) {
      quickActions.hidden = !isAdmin;
    }

    if (signInForm) {
      signInForm.hidden = isSignedIn && isAdmin;
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
    if (passwordInput) {
      passwordInput.disabled = isBusy;
    }
    if (signInButton) {
      signInButton.disabled = isBusy;
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
    setStatus("Shared admin auth failed to load on this page.", "error");
    if (signInButton) {
      signInButton.disabled = true;
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
      accessCopy.textContent =
        "Sign in with an active Busses admin account to open the protected workspace.";
      setStatus("Busses tools stay separate until an admin account signs in.", "");
      return access;
    }

    if (!access.isAdmin) {
      setSignedInState(true, false);
      accessCopy.textContent =
        "This session is signed in, but the linked account does not have active Busses admin access.";
      setStatus("This account is not authorized for the Busses workspace.", "error");
      return access;
    }

    setSignedInState(true, true);
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

    if (signInForm) {
      signInForm.reset();
    }
    await syncAccessState();
  });

  signInForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    setBusy(true);
    setStatus("Checking Busses access...", "");

    const result = await adminAuth.signInWithPassword(emailInput?.value, passwordInput?.value);
    setBusy(false);

    if (!result.ok) {
      setSignedInState(false, false);
      setStatus(adminAuth.readableAccessError(result.message), "error");
      passwordInput?.focus();
      passwordInput?.select();
      return;
    }

    if (!result.isAdmin) {
      setSignedInState(true, false);
      setStatus("This account signed in, but it is not an active Busses admin.", "error");
      return;
    }

    setSignedInState(true, true);
    setStatus("Busses access confirmed. Opening the protected workspace...", "success");
    window.location.href = safeNextHref();
  });

  await syncAccessState();
});
