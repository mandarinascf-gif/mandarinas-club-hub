(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderGate(options = {}) {
    const {
      title = "Busses access unavailable",
      body =
        "This page cannot open right now. Return to the Busses entry page and try again.",
      tone = "error",
      primaryHref = "./busses.html",
      primaryLabel = "Open Busses",
      secondaryHref = "./home.html",
      secondaryLabel = "Back to club",
    } = options;

    const main = document.querySelector("main.page");
    if (!main) {
      return;
    }

    main.innerHTML = `
      <section class="panel page-header manager-header-card">
        <div class="page-header-main">
          <div class="section-label">Busses Access</div>
          <h1>${escapeHtml(title)}</h1>
          <p class="status-line ${escapeHtml(tone)}">${escapeHtml(body)}</p>
        </div>
        <div class="actions">
          <a class="primary-button" href="${escapeHtml(primaryHref)}">${escapeHtml(primaryLabel)}</a>
          <a class="secondary-button" href="${escapeHtml(secondaryHref)}">${escapeHtml(
      secondaryLabel
    )}</a>
        </div>
      </section>
    `;
  }

  function readableBootMessage(code, message) {
    if (code === "library_missing") {
      return "Supabase did not load for this page. Refresh once, then retry from Busses if needed.";
    }

    if (code === "config_missing") {
      return "Supabase runtime config is missing for this page.";
    }

    if (code === "client_create_failed") {
      return `Supabase could not start for this page. ${message}`;
    }

    if (code === "session_failed") {
      return "Busses access could not verify the current session.";
    }

    if (code === "account_lookup_failed") {
      return message;
    }

    return message || "This page could not verify Busses access.";
  }

  async function requireAccess(options = {}) {
    const {
      pageTitle = "Busses workspace",
      requireLogic = false,
      nextHref = window.location.href,
      redirectUnauthorized = true,
    } = options;

    const adminAuth = window.MandarinasAdminAuth;
    if (!adminAuth) {
      renderGate({
        title: `${pageTitle} could not start`,
        body: "The shared admin auth helper failed to load for this page.",
      });
      return { ok: false };
    }

    const access = await adminAuth.resolveAccess();
    if (!access.ok) {
      renderGate({
        title: `${pageTitle} could not start`,
        body: readableBootMessage(
          access.code,
          adminAuth.readableAccessError(access.message || "Busses access failed.")
        ),
      });
      return { ok: false };
    }

    if (requireLogic && !window.MandarinasLogic) {
      renderGate({
        title: `${pageTitle} could not start`,
        body: "Core app logic failed to load for this page.",
      });
      return { ok: false };
    }

    if (!access.isAdmin) {
      if (redirectUnauthorized) {
        window.location.replace(adminAuth.accessPageHref(nextHref));
        return { ok: false };
      }

      renderGate({
        title: `${pageTitle} needs Busses access`,
        body: "Sign in with an active admin account to open this page.",
      });
      return { ok: false };
    }

    return {
      ok: true,
      ...access,
      logic: window.MandarinasLogic || null,
    };
  }

  window.MandarinasAdminPage = Object.freeze({
    escapeHtml,
    renderGate,
    requireAccess,
  });
})();
