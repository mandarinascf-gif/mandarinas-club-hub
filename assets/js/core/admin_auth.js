(function () {
  "use strict";

  const ACCESS_CACHE_KEY = "mcfAdminAccess";
  const ACCESS_PAGE = "busses.html";

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
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
      lowerMessage.includes("player_accounts") &&
      (lowerMessage.includes("relation") ||
        lowerMessage.includes("does not exist") ||
        lowerMessage.includes("schema cache"))
    ) {
      return "Admin auth is not ready yet. Apply the latest Supabase auth/RLS SQL first.";
    }

    if (
      lowerMessage.includes("invalid login credentials") ||
      lowerMessage.includes("email not confirmed")
    ) {
      return "Those admin credentials were not accepted.";
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
        account: null,
        isAdmin: false,
      };
    }

    const { data: account, error: accountError } = await supabaseClient
      .from("player_accounts")
      .select("id, player_id, role, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (accountError) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "account_lookup_failed",
        message: accountError.message || "Admin account lookup failed.",
      };
    }

    const isAdmin = account?.role === "admin" && account?.is_active !== false;
    setCachedAdminAccess(isAdmin);

    return {
      ok: true,
      supabaseClient,
      supabaseConfig,
      session,
      user,
      account: account || null,
      isAdmin,
    };
  }

  async function signInWithPassword(email, password) {
    const boot = bootClient();
    if (!boot.ok) {
      setCachedAdminAccess(false);
      return boot;
    }

    const normalizedEmail = normalizeText(email).toLowerCase();
    const normalizedPassword = String(password || "");

    if (!normalizedEmail || !normalizedPassword) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "missing_credentials",
        message: "Enter the admin email and password.",
      };
    }

    const { error } = await boot.supabaseClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (error) {
      setCachedAdminAccess(false);
      return {
        ok: false,
        code: "sign_in_failed",
        message: error.message || "Sign-in failed.",
      };
    }

    return resolveAccess();
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
    signInWithPassword,
    signOut,
  });
})();
