(function () {
  "use strict";

  const ADMIN_CODE = "1234";
  const ADMIN_STATE_KEY = "mcfAdminUnlocked";
  const PUBLIC_FALLBACK = "./home.html";
  const STAFF_ACCESS_PAGE = "staff.html";
  const SEASON_CONTEXT_PAGES = new Set([
    "schedule.html",
    "public_standings.html",
    "roster.html",
    "tier_watch.html",
  ]);
  const STAFF_PREVIEW_PAGES = new Set(["submissions.html", "ratings.html"]);
  const SOCIAL_LINKS = [
    {
      label: "Instagram",
      href: "https://www.instagram.com/mandarinas_fc/",
    },
    {
      label: "TikTok",
      href: "https://www.tiktok.com/@mandagctv26",
    },
    {
      label: "YouTube",
      href: "https://www.youtube.com/@MandarinasCF",
    },
  ];
  const ADMIN_PAGES = new Set([
    "index.html",
    "player.html",
    "matchday.html",
    "standings.html",
    "tiers.html",
    "seasons.html",
    "setup.html",
  ]);
  let adminAccessModalRefs = null;
  let pendingAdminAccess = null;
  const scrollHintRefs = new WeakMap();
  let historyListenersInstalled = false;

  function currentPageName() {
    const path = window.location.pathname || "";
    const name = path.split("/").pop();
    return name || "index.html";
  }

  function resolveUrl(href) {
    try {
      return new URL(href, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function relativeHrefFromUrl(url) {
    if (!url) {
      return "";
    }

    const pageName = url.pathname.split("/").pop() || "index.html";
    return `./${pageName}${url.search || ""}${url.hash || ""}`;
  }

  function currentSeasonIdFromUrl() {
    const url = resolveUrl(window.location.href);
    const seasonId = Number(url?.searchParams.get("season_id"));
    return Number.isFinite(seasonId) && seasonId > 0 ? seasonId : null;
  }

  function isStaffPreviewUrl(urlLike) {
    const url = resolveUrl(urlLike);
    if (!url) {
      return false;
    }

    const pageName = url.pathname.split("/").pop() || "index.html";
    return STAFF_PREVIEW_PAGES.has(pageName) && url.searchParams.get("preview") === "1";
  }

  function isProtectedUrl(urlLike) {
    const url = resolveUrl(urlLike);
    if (!url || url.origin !== window.location.origin) {
      return false;
    }

    const pageName = url.pathname.split("/").pop() || "index.html";
    return ADMIN_PAGES.has(pageName) || isStaffPreviewUrl(url);
  }

  function staffAccessHref(nextHref = window.location.href) {
    const accessUrl = resolveUrl(`./${STAFF_ACCESS_PAGE}`);
    const targetUrl = resolveUrl(nextHref);

    if (!accessUrl || !targetUrl) {
      return `./${STAFF_ACCESS_PAGE}`;
    }

    accessUrl.searchParams.set("next", relativeHrefFromUrl(targetUrl));
    return relativeHrefFromUrl(accessUrl);
  }

  function readWindowState() {
    try {
      const raw = String(window.name || "").trim();
      if (!raw || !raw.startsWith("{")) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeWindowState(nextState) {
    try {
      const current = readWindowState();
      window.name = JSON.stringify({
        ...current,
        ...nextState,
      });
    } catch (error) {
      window.name = JSON.stringify(nextState);
    }
  }

  function hasAdminAccess() {
    return readWindowState()[ADMIN_STATE_KEY] === true;
  }

  function setAdminAccess(value) {
    writeWindowState({
      [ADMIN_STATE_KEY]: Boolean(value),
    });
  }

  function setModalOpen(isOpen) {
    const refs = adminAccessModalRefs;
    if (!refs) {
      return;
    }

    refs.root.hidden = !isOpen;
    document.body.classList.toggle("modal-open", isOpen);

    if (isOpen) {
      refs.form.reset();
      refs.status.hidden = true;
      refs.status.textContent = "";
      window.setTimeout(() => refs.input.focus(), 0);
      return;
    }

    refs.status.hidden = true;
    refs.status.textContent = "";
  }

  function ensureAdminAccessModal() {
    if (adminAccessModalRefs) {
      return adminAccessModalRefs;
    }

    const root = document.createElement("div");
    root.className = "site-modal";
    root.id = "admin-access-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="site-modal-backdrop" data-admin-modal-close></div>
      <div
        class="site-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-access-title"
      >
        <div class="site-modal-head">
          <div>
            <div class="section-label">Staff Access</div>
            <h2 class="site-modal-title" id="admin-access-title">Enter staff code</h2>
            <p class="mini-sub">Use the current staff code to open the staff workspace in this browser tab.</p>
          </div>
          <button class="ghost-button" type="button" data-admin-modal-close>Cancel</button>
        </div>
        <form class="site-modal-body" id="admin-access-form">
          <div class="field">
            <label for="admin-access-input">Staff code</label>
            <input id="admin-access-input" name="admin_code" type="password" autocomplete="off" />
          </div>
          <p class="status-line error" id="admin-access-status" hidden></p>
          <div class="actions">
            <button class="primary-button" type="submit">Open staff workspace</button>
            <button class="secondary-button" type="button" data-admin-modal-close>Stay on current page</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(root);

    const form = root.querySelector("#admin-access-form");
    const input = root.querySelector("#admin-access-input");
    const status = root.querySelector("#admin-access-status");

    function cancelRequest() {
      const request = pendingAdminAccess;
      pendingAdminAccess = null;
      setModalOpen(false);
      if (request?.onCancel) {
        request.onCancel();
      }
    }

    root.querySelectorAll("[data-admin-modal-close]").forEach((element) => {
      element.addEventListener("click", cancelRequest);
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRequest();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const entered = String(input.value || "").trim();
      if (entered !== ADMIN_CODE) {
        status.textContent = "Incorrect staff code.";
        status.hidden = false;
        input.focus();
        input.select();
        return;
      }

      const request = pendingAdminAccess;
      pendingAdminAccess = null;
      setAdminAccess(true);
      setModalOpen(false);
      if (request?.onSuccess) {
        request.onSuccess();
      }
    });

    adminAccessModalRefs = { root, form, input, status };
    return adminAccessModalRefs;
  }

  function ensureSiteIcon() {
    if (!document.head || document.head.querySelector('link[rel="icon"]')) {
      return;
    }

    const iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.type = "image/svg+xml";
    iconLink.href = "./assets/icons/mandarinas-mark.svg";
    document.head.appendChild(iconLink);
  }

  function ensureActiveNavLinkVisible() {
    const activeLink = document.querySelector(".nav-links .nav-link.active");
    const navLinks = activeLink?.closest(".nav-links");

    if (!activeLink || !navLinks) {
      return;
    }

    activeLink.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "auto",
    });
  }

  function ensureFooterSocialLinks() {
    document.querySelectorAll(".club-footer-copy, .mc-footer-copy").forEach((footerCopy) => {
      if (footerCopy.querySelector(".footer-socials")) {
        return;
      }

      const nav = document.createElement("nav");
      nav.className = "footer-socials";
      nav.setAttribute("aria-label", "Mandarinas CF social links");

      SOCIAL_LINKS.forEach(({ label, href }) => {
        const link = document.createElement("a");
        link.className = "footer-social-link";
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;
        nav.appendChild(link);
      });

      footerCopy.appendChild(nav);
    });
  }

  function updateHorizontalScrollHint(target) {
    const refs = scrollHintRefs.get(target);
    if (!refs) {
      return;
    }

    const overflow = target.scrollWidth - target.clientWidth > 24;
    const atStart = target.scrollLeft <= 8;
    const atEnd = target.scrollLeft + target.clientWidth >= target.scrollWidth - 8;
    const isWorkspaceTabs = target.classList.contains("workspace-switcher");

    target.classList.toggle("has-horizontal-overflow", overflow);
    target.classList.toggle("can-scroll-left", overflow && !atStart);
    target.classList.toggle("can-scroll-right", overflow && !atEnd);

    refs.hint.hidden = !overflow;
    refs.hint.textContent = isWorkspaceTabs
      ? "Scroll sideways to see all tabs."
      : "Scroll sideways to see more pages.";
  }

  function ensureHorizontalScrollHints() {
    document.querySelectorAll(".nav-links, .workspace-switcher").forEach((target) => {
      if (!scrollHintRefs.has(target)) {
        const hint = document.createElement("p");
        hint.className = "horizontal-scroll-hint";
        hint.hidden = true;
        hint.setAttribute("aria-hidden", "true");
        hint.textContent = target.classList.contains("workspace-switcher")
          ? "Scroll sideways to see all tabs."
          : "Scroll sideways to see more pages.";
        target.insertAdjacentElement("afterend", hint);

        target.addEventListener("scroll", () => updateHorizontalScrollHint(target), {
          passive: true,
        });

        if (typeof ResizeObserver === "function") {
          const observer = new ResizeObserver(() => updateHorizontalScrollHint(target));
          observer.observe(target);
        } else {
          window.addEventListener("resize", () => updateHorizontalScrollHint(target));
        }

        scrollHintRefs.set(target, { hint });
      }

      updateHorizontalScrollHint(target);
    });
  }

  function syncSeasonAwareLinks() {
    const seasonId = currentSeasonIdFromUrl();

    document.querySelectorAll("a[href]").forEach((link) => {
      const rawHref = link.dataset.baseHref || link.getAttribute("href");
      if (!rawHref) {
        return;
      }

      if (!link.dataset.baseHref) {
        link.dataset.baseHref = rawHref;
      }

      if (
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      const targetUrl = resolveUrl(rawHref);
      if (!targetUrl || targetUrl.origin !== window.location.origin) {
        return;
      }

      const pageName = targetUrl.pathname.split("/").pop() || "index.html";
      if (!SEASON_CONTEXT_PAGES.has(pageName)) {
        return;
      }

      if (seasonId) {
        targetUrl.searchParams.set("season_id", String(seasonId));
      } else {
        targetUrl.searchParams.delete("season_id");
      }

      link.setAttribute("href", relativeHrefFromUrl(targetUrl));
    });
  }

  function installUrlChangeListeners() {
    if (historyListenersInstalled) {
      return;
    }

    historyListenersInstalled = true;

    const originalReplaceState = window.history.replaceState.bind(window.history);
    const originalPushState = window.history.pushState.bind(window.history);

    function notifyUrlChange() {
      window.dispatchEvent(new Event("mcf:urlchange"));
    }

    window.history.replaceState = function replaceState(...args) {
      originalReplaceState(...args);
      notifyUrlChange();
    };

    window.history.pushState = function pushState(...args) {
      originalPushState(...args);
      notifyUrlChange();
    };

    window.addEventListener("popstate", notifyUrlChange);
    window.addEventListener("mcf:urlchange", () => {
      syncSeasonAwareLinks();
      ensureHorizontalScrollHints();
    });
  }

  function requestAdminAccess(onSuccess, onCancel) {
    if (hasAdminAccess()) {
      if (typeof onSuccess === "function") {
        onSuccess();
      }
      return;
    }

    pendingAdminAccess = {
      onSuccess: typeof onSuccess === "function" ? onSuccess : null,
      onCancel: typeof onCancel === "function" ? onCancel : null,
    };
    ensureAdminAccessModal();
    setModalOpen(true);
  }

  function initAdminAccess() {
    const isProtectedPage = isProtectedUrl(window.location.href);

    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) {
        return;
      }

      if (!isProtectedUrl(href)) {
        return;
      }

      link.addEventListener("click", (event) => {
        if (hasAdminAccess()) {
          return;
        }

        event.preventDefault();
        requestAdminAccess(
          () => {
            window.location.href = href;
          },
          () => {}
        );
      });
    });

    if (isProtectedPage && !hasAdminAccess()) {
      window.location.replace(staffAccessHref(window.location.href));
    }
  }

  function init() {
    ensureSiteIcon();
    ensureFooterSocialLinks();
    installUrlChangeListeners();
    syncSeasonAwareLinks();
    initAdminAccess();
    ensureHorizontalScrollHints();
    window.requestAnimationFrame(() => {
      ensureActiveNavLinkVisible();
      ensureHorizontalScrollHints();
    });
  }

  window.MandarinasShell = Object.freeze({
    hasAdminAccess,
    requestAdminAccess,
    currentSeasonIdFromUrl,
    syncSeasonAwareLinks,
    staffAccessHref,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
