(function () {
  "use strict";

  const ACCESS_CACHE_KEY = "mcfAdminAccess";
  const ACCESS_PAGE = "busses.html";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeEmail(value) {
    return normalizeText(value).toLowerCase();
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

    if (
      (lowerMessage.includes("admin_allowed_emails") || lowerMessage.includes("is_admin")) &&
      (lowerMessage.includes("relation") ||
        lowerMessage.includes("does not exist") ||
        lowerMessage.includes("schema cache") ||
        lowerMessage.includes("function"))
    ) {
      return "Admin auth is not ready yet. Apply the latest Supabase auth/RLS SQL first.";
    }

    if (
      lowerMessage.includes("email not confirmed")
    ) {
      return "Finish the email confirmation flow from the magic link first.";
    }

    if (
      lowerMessage.includes("security purposes") ||
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("60 seconds")
    ) {
      return "A magic link was already requested recently. Wait a minute, then try again.";
    }

    if (lowerMessage.includes("invalid email")) {
      return "Enter a valid admin email address.";
    }

    if (
      lowerMessage.includes("jwt") ||
      lowerMessage.includes("apikey") ||
      lowerMessage.includes("unauthorized")
    ) {
      return "Busses access could not verify the Supabase session.";
    }

    return message;
  }

  async function resolveAccess() {
    const boot = bootClient();
    if (!boot.ok) {
      setCachedAdminAccess(false);
      return boot;
    }

    const { supabaseClient, supabaseConfig } = boot;
    const {
      data: { session } = {},
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "session_failed",
        message: sessionError.message || "Supabase session lookup failed.",
      };
    }

    const user = session?.user || null;
    if (!user) {
      setCachedAdminAccess(false);
      return {
        ok: true,
        supabaseClient,
        supabaseConfig,
        session: null,
        user: null,
        adminEmail: "",
        isAdmin: false,
      };
    }

    const { data: isAdminData, error: adminCheckError } = await supabaseClient.rpc("is_admin");

    if (adminCheckError) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "admin_check_failed",
        message: adminCheckError.message || "Admin access lookup failed.",
      };
    }

    const adminEmail = normalizeEmail(user.email);
    const isAdmin = isAdminData === true;
    setCachedAdminAccess(isAdmin);

    return {
      ok: true,
      supabaseClient,
      supabaseConfig,
      session,
      user,
      adminEmail,
      isAdmin,
    };
  }

  async function sendMagicLink(email, redirectTo) {
    const boot = bootClient();
    if (!boot.ok) {
      setCachedAdminAccess(false);
      return boot;
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedRedirectTo = normalizeText(redirectTo);

    if (!normalizedEmail) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "missing_email",
        message: "Enter the admin email address first.",
      };
    }

    const options = {
      shouldCreateUser: true,
    };

    if (normalizedRedirectTo) {
      options.emailRedirectTo = normalizedRedirectTo;
    }

    const { error } = await boot.supabaseClient.auth.signInWithOtp({
      email: normalizedEmail,
      options,
    });

    if (error) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "magic_link_failed",
        message: error.message || "Magic-link request failed.",
      };
    }

    return {
      ok: true,
      email: normalizedEmail,
      redirectTo: normalizedRedirectTo || null,
    };
  }

  async function signOut() {
    const boot = bootClient();
    if (!boot.ok) {
      setCachedAdminAccess(false);
      return boot;
    }

    const { error } = await boot.supabaseClient.auth.signOut();
    setCachedAdminAccess(false);

    if (error) {
      return {
        ok: false,
        code: "sign_out_failed",
        message: error.message || "Sign-out failed.",
      };
    }

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
    sendMagicLink,
    signOut,
  });
})();
