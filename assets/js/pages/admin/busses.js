document.addEventListener("DOMContentLoaded", async () => {
  const adminAuth = window.MandarinasAdminAuth;
  const statusLine = document.getElementById("busses-access-status");
  const accessCopy = document.getElementById("busses-access-copy");
  const quickActions = document.getElementById("busses-quick-actions");
  const signInForm = document.getElementById("busses-sign-in-form");
  const emailInput = document.getElementById("busses-email");
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

  function magicLinkRedirectHref() {
    const appConfig = window.__MANDARINAS_APP_CONFIG__ || {};
    const configuredRedirect = String(appConfig.bussesMagicLinkRedirectUrl || "").trim();
    if (configuredRedirect) {
      return configuredRedirect;
    }

    const configuredSiteUrl = String(appConfig.siteUrl || "").trim();

    try {
      if (configuredSiteUrl) {
        const siteUrl = new URL(configuredSiteUrl);
        const currentUrl = new URL(window.location.href);
        siteUrl.pathname = currentUrl.pathname;
        siteUrl.search = currentUrl.search;
        siteUrl.hash = "";
        return siteUrl.toString();
      }

      const redirectUrl = new URL(window.location.href);
      redirectUrl.hash = "";
      return redirectUrl.toString();
    } catch (error) {
      return window.location.href;
    }
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
        "Use an authorized Busses admin email to receive a magic link and open the protected workspace.";
      setStatus("Busses tools stay separate until an authorized admin email completes the magic-link sign-in.", "");
      return access;
    }

    if (!access.isAdmin) {
      setSignedInState(true, false);
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
    setStatus("Sending Busses magic link...", "");

    const result = await adminAuth.sendMagicLink(emailInput?.value, magicLinkRedirectHref());
    setBusy(false);

    if (!result.ok) {
      setStatus(adminAuth.readableAccessError(result.message), "error");
      emailInput?.focus();
      emailInput?.select();
      return;
    }

    setStatus(
      `Magic link sent to ${result.email}. Open that email on this device to finish Busses access.`,
      "success"
    );
  });

  await syncAccessState();
});
