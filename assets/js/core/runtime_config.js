(function () {
  "use strict";

  function normalizeValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  const currentConfig = window.__MANDARINAS_APP_CONFIG__ || {};

  window.__MANDARINAS_APP_CONFIG__ = {
    ...currentConfig,
    siteUrl:
      normalizeValue(currentConfig.siteUrl || currentConfig.SITE_URL || currentConfig.PUBLIC_SITE_URL) || "",
    bussesMagicLinkRedirectUrl:
      normalizeValue(
        currentConfig.bussesMagicLinkRedirectUrl ||
          currentConfig.BUSSES_MAGIC_LINK_REDIRECT_URL
      ) || "",
  };
})();
