(function () {
  "use strict";

  const BUSSES_ACCESS_PAGE = "busses.html";
  const SEASON_CONTEXT_PAGES = new Set([
    "schedule.html",
    "public_standings.html",
    "roster.html",
    "submissions.html",
    "tier_system.html",
    "tier_watch.html",
    "videos.html",
  ]);
  const BUSSES_PREVIEW_PAGES = new Set(["submissions.html", "ratings.html"]);
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
    "squad.html",
    "player.html",
    "matchday.html",
    "standings.html",
    "tiers.html",
    "seasons.html",
    "setup.html",
  ]);
  const ADMIN_ACCESS_CACHE_KEY = "mcfAdminAccess";
  const scrollHintRefs = new WeakMap();
  const mobileNavPortalRefs = new WeakMap();
  let historyListenersInstalled = false;
  let mobileNavListenersInstalled = false;

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

  function isBussesPreviewUrl(urlLike) {
    const url = resolveUrl(urlLike);
    if (!url) {
      return false;
    }

    const pageName = url.pathname.split("/").pop() || "index.html";
    return BUSSES_PREVIEW_PAGES.has(pageName) && url.searchParams.get("preview") === "1";
  }

  function isProtectedUrl(urlLike) {
    const url = resolveUrl(urlLike);
    if (!url || url.origin !== window.location.origin) {
      return false;
    }

    const pageName = url.pathname.split("/").pop() || "index.html";
    return ADMIN_PAGES.has(pageName) || isBussesPreviewUrl(url);
  }

  function bussesAccessHref(nextHref = window.location.href) {
    const accessUrl = resolveUrl(`./${BUSSES_ACCESS_PAGE}`);
    const targetUrl = resolveUrl(nextHref);

    if (!accessUrl || !targetUrl) {
      return `./${BUSSES_ACCESS_PAGE}`;
    }

    accessUrl.searchParams.set("next", relativeHrefFromUrl(targetUrl));
    return relativeHrefFromUrl(accessUrl);
  }

  function hasAdminAccess() {
    if (window.MandarinasAdminAuth?.hasCachedAdminAccess) {
      return window.MandarinasAdminAuth.hasCachedAdminAccess();
    }

    try {
      return window.sessionStorage.getItem(ADMIN_ACCESS_CACHE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function requestAdminAccess(onSuccess) {
    if (hasAdminAccess()) {
      if (typeof onSuccess === "function") {
        onSuccess();
      }
      return;
    }

    window.location.href = bussesAccessHref(window.location.href);
  }

  function ensureSiteIcon() {
    if (!document.head || document.head.querySelector('link[rel="icon"]')) {
      return;
    }

    const iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.type = "image/png";
    iconLink.href = "./assets/icons/icon-192.png";
    document.head.appendChild(iconLink);
  }

  function ensureMetaTag(name, content) {
    if (!document.head || document.head.querySelector(`meta[name="${name}"]`)) {
      return;
    }

    const metaTag = document.createElement("meta");
    metaTag.name = name;
    metaTag.content = content;
    document.head.appendChild(metaTag);
  }

  function ensureLinkTag(rel, href) {
    if (!document.head || document.head.querySelector(`link[rel="${rel}"]`)) {
      return;
    }

    const linkTag = document.createElement("link");
    linkTag.rel = rel;
    linkTag.href = href;
    document.head.appendChild(linkTag);
  }

  function supportsWebManifest() {
    return window.location.protocol !== "file:";
  }

  function ensureInstallMetadata() {
    ensureMetaTag("theme-color", "#8bd4a1");
    ensureMetaTag("mobile-web-app-capable", "yes");
    ensureMetaTag("apple-mobile-web-app-capable", "yes");
    ensureMetaTag("apple-mobile-web-app-title", "Mandarinas CF");
    ensureMetaTag("apple-mobile-web-app-status-bar-style", "black-translucent");
    if (supportsWebManifest()) {
      ensureLinkTag("manifest", "./site.webmanifest");
    }
    ensureLinkTag("apple-touch-icon", "./assets/icons/apple-touch-icon.png");
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

      const refs = scrollHintRefs.get(target);
      if (refs?.hint && refs.hint.previousElementSibling !== target) {
        target.insertAdjacentElement("afterend", refs.hint);
      }

      updateHorizontalScrollHint(target);
    });
  }

  function shouldUseBottomTabbar() {
    return window.matchMedia("(max-width: 959px)").matches;
  }

  function ensureMobileNavPortal(navLinks) {
    let state = mobileNavPortalRefs.get(navLinks);
    if (state) {
      return state;
    }

    const anchor = document.createComment("mcf-nav-links-anchor");
    navLinks.parentNode?.insertBefore(anchor, navLinks);
    state = { anchor };
    mobileNavPortalRefs.set(navLinks, state);
    return state;
  }

  function syncMobileTabBarPlacement() {
    const useBottomTabbar = shouldUseBottomTabbar();

    document.querySelectorAll(".nav-links").forEach((navLinks) => {
      const { anchor } = ensureMobileNavPortal(navLinks);

      if (useBottomTabbar) {
        if (navLinks.parentNode !== document.body) {
          document.body.appendChild(navLinks);
        }
        return;
      }

      const parent = anchor.parentNode;
      if (!parent) {
        return;
      }

      if (navLinks.parentNode !== parent || navLinks.previousSibling !== anchor) {
        parent.insertBefore(navLinks, anchor.nextSibling);
      }
    });
  }

  function installMobileNavListeners() {
    if (mobileNavListenersInstalled) {
      return;
    }

    mobileNavListenersInstalled = true;

    window.addEventListener("resize", () => {
      syncMobileTabBarPlacement();
      ensureHorizontalScrollHints();
      ensureActiveNavLinkVisible();
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

  function initAdminAccess() {
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
        window.location.href = bussesAccessHref(href);
      });
    });
  }

  function init() {
    ensureSiteIcon();
    ensureFooterSocialLinks();
    installUrlChangeListeners();
    installMobileNavListeners();
    syncSeasonAwareLinks();
    initAdminAccess();
    syncMobileTabBarPlacement();
    ensureHorizontalScrollHints();
    window.requestAnimationFrame(() => {
      syncMobileTabBarPlacement();
      ensureActiveNavLinkVisible();
      ensureHorizontalScrollHints();
    });
  }

  window.MandarinasShell = Object.freeze({
    hasAdminAccess,
    requestAdminAccess,
    currentSeasonIdFromUrl,
    syncSeasonAwareLinks,
    bussesAccessHref,
  });

  ensureInstallMetadata();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
