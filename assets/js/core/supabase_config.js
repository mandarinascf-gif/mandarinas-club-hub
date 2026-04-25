(function () {
  "use strict";

  const DEFAULT_SUPABASE_URL = "https://kreryiryoorlmiqqhpcj.supabase.co";
  const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_aJ-TKJ-t1vr4dCit4s3-lQ_ZcYLuCO-";

  function normalizeValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  const runtimeOverrides = window.__MANDARINAS_SUPABASE_CONFIG__ || {};
  const url =
    normalizeValue(runtimeOverrides.url || runtimeOverrides.NEXT_PUBLIC_SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL;
  const publishableKey =
    normalizeValue(
      runtimeOverrides.publishableKey || runtimeOverrides.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  window.MandarinasSupabaseConfig = Object.freeze({
    url,
    publishableKey,
    hasCredentials: Boolean(url && publishableKey),
    createClient() {
      if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
        throw new Error("Supabase JS library did not load.");
      }
      if (!url || !publishableKey) {
        throw new Error("Supabase runtime config is missing.");
      }
      return supabase.createClient(url, publishableKey);
    },
  });
})();

