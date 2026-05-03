(function () {
  "use strict";

  const ACCESS_CACHE_KEY = "mcfAdminAccess";
  const ACCESS_PAGE = "busses.html";
  const DEFAULT_ACCESS_CODE = "201118";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeCode(value) {
    return normalizeText(value).replace(/\s+/g, "");
  }

  function configuredAccessCode() {
    const runtimeCode = normalizeCode(window.__MANDARINAS_APP_CONFIG__?.bussesAccessCode);
    return runtimeCode || DEFAULT_ACCESS_CODE;
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
      return `./${ACCESS_PAGE}`;
    }

    const pageName = url.pathname.split("/").pop() || "index.html";
    return `./${pageName}${url.search || ""}${url.hash || ""}`;
  }

  function accessPageHref(nextHref = window.location.href) {
    const accessUrl = resolveUrl(`./${ACCESS_PAGE}`);
    const nextUrl = resolveUrl(nextHref);

    if (!accessUrl || !nextUrl) {
      return `./${ACCESS_PAGE}`;
    }

    accessUrl.searchParams.set("next", relativeHrefFromUrl(nextUrl));
    return relativeHrefFromUrl(accessUrl);
  }

  function setCachedAdminAccess(value) {
    try {
      if (value) {
        window.sessionStorage.setItem(ACCESS_CACHE_KEY, "1");
        return;
      }

      window.sessionStorage.removeItem(ACCESS_CACHE_KEY);
    } catch (error) {
      console.warn("[MandarinasAdminAuth] Could not update cached admin access state.", error);
    }
  }

  function hasCachedAdminAccess() {
    try {
      return window.sessionStorage.getItem(ACCESS_CACHE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function bootClient() {
    const supabaseConfig = window.MandarinasSupabaseConfig;

    if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
      return {
        ok: false,
        code: "library_missing",
        message: "Supabase JS library did not load.",
      };
    }

    if (!supabaseConfig?.hasCredentials) {
      return {
        ok: false,
        code: "config_missing",
        message: "Supabase runtime config is missing.",
      };
    }

    try {
      return {
        ok: true,
        supabaseConfig,
        supabaseClient: supabaseConfig.createClient(),
      };
    } catch (error) {
      return {
        ok: false,
        code: "client_create_failed",
        message: error?.message || "Supabase client could not be created.",
      };
    }
  }

  function readableAccessError(error) {
    const message = normalizeText(error?.message || error);
    const lowerMessage = message.toLowerCase();

    if (!message) {
      return "Busses access could not be verified right now.";
    }

    if (lowerMessage.includes("invalid_code")) {
      return "That Busses code did not match.";
    }

    if (lowerMessage.includes("missing_code")) {
      return "Enter the Busses access code first.";
    }

    if (
      lowerMessage.includes("library_missing") ||
      lowerMessage.includes("config_missing") ||
      lowerMessage.includes("client_create_failed")
    ) {
      return message;
    }

    return message;
  }

  async function resolveAccess() {
    return {
      ok: true,
      isAdmin: hasCachedAdminAccess(),
    };
  }

  async function verifyAccessCode(code) {
    const normalizedCode = normalizeCode(code);

    if (!normalizedCode) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "missing_code",
        message: "missing_code",
      };
    }

    if (normalizedCode !== configuredAccessCode()) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "invalid_code",
        message: "invalid_code",
      };
    }

    setCachedAdminAccess(true);
    return resolveAccess();
  }

  async function signOut() {
    setCachedAdminAccess(false);
    return {
      ok: true,
    };
  }

  window.MandarinasAdminAuth = Object.freeze({
    accessPageHref,
    bootClient,
    hasCachedAdminAccess,
    readableAccessError,
    resolveAccess,
    setCachedAdminAccess,
    signOut,
    verifyAccessCode,
  });
})();
