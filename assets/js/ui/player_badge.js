/**
 * player_badge.js — v2.1 (2026-04-30)
 *
 * Premium black-and-gold FUT-style player card.
 * Self-contained: injects its own CSS, exposes the same public API
 * as v1 so roster.js, player.js, and badge-preview.html work unchanged.
 *
 * PUBLIC API (all on window):
 *   renderPlayerBadge(player, stats, options) → HTMLElement
 *   mountPlayerBadge(target, player, stats, options) → HTMLElement
 *   createPlayerBadgeMarkup(model) → string (raw HTML)
 *   schedulePlayerBadgeFit(badge) → void
 *   mcPlayerBadgeExample → { player, stats }
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */
  const BALL_ART_PATH = "assets/images/player-badge/reference-ball-full.png";
  const CREST_PATH = "assets/images/brand/mandarinas-crest-clean.png";
  let badgeSerial = 0;

  const scriptUrl =
    typeof document !== "undefined" && document.currentScript?.src
      ? new URL(document.currentScript.src, window.location.href)
      : null;
  const assetBaseUrl = scriptUrl ? new URL("../../../", scriptUrl) : null;

  /* ================================================================== */
  /*  CSS — injected once via <style id="mc-player-badge-css">           */
  /*                                                                     */
  /*  DESIGN RULES:                                                      */
  /*  • Card does NOT try to fill 100svh.  It auto-sizes to content     */
  /*    with a max-height cap so it never overflows the viewport.        */
  /*  • Stat grid uses CSS Grid only.  No absolute / transform hacks.   */
  /*  • Every dimension uses clamp() for fluid scaling.                  */
  /*  • Zero-value stats stay visible but dimmed.                        */
  /* ================================================================== */
  const BADGE_CSS = /* css */ `
/* ---- shell wrappers (roster / player page containers) ---- */
.fut-card-shell,
.badge-preview,
.share-badge-container,
.page-roster .player-badge-share-card {
  width: 100%;
  max-width: none;
  padding-inline: clamp(4px, 1.5vw, 10px);
  box-sizing: border-box;
}

.page-roster .player-badge-share-card {
  margin: 0 auto;
  display: grid;
  gap: 0.5rem;
  padding-block: 6px 4px;
}

.badge-preview,
.page-roster .roster-player-badge {
  width: 100%;
  min-width: 0;
  display: grid;
  justify-items: center;
  margin: 0 auto;
  box-sizing: border-box;
}

.page-roster .player-badge-export-surface {
  position: fixed;
  top: -9999px;
  left: 0;
  width: 900px;
  padding: 0;
  display: grid;
  justify-items: center;
  pointer-events: none;
  z-index: -1;
}

/* ==============================================================
   THE CARD
   Height strategy: auto height, capped by max-height so it
   never scrolls. The grid rows are: header | top-row | hero
   (flexible) | stats.  The hero section shrinks to fit.
   ============================================================== */
@property --fut-card-border-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.fut-card {
  --cw: min(96vw, 460px);
  --pd: clamp(6px, 1.2vh, 14px);
  --gp: clamp(3px, 0.6vh, 8px);
  --fut-card-border-angle: 0deg;

  /* typography tokens */
  --fs-title:    clamp(20px, 4vh, 38px);
  --fs-subtitle: clamp(6px, 1vh, 11px);
  --fs-name:     clamp(15px, 2.4vh, 28px);
  --fs-stat-val: clamp(15px, 2.4vh, 26px);
  --fs-stat-lbl: clamp(6px, 0.9vh, 9px);
  --fs-mini-val: clamp(18px, 3vh, 28px);
  --fs-mini-lbl: clamp(7px, 0.9vh, 10px);
  --fs-mini-met: clamp(6px, 0.8vh, 9px);

  /* component tokens */
  --sz-ball:   clamp(90px, 16vh, 190px);
  --sz-crest:  clamp(60px, 15vw, 100px);
  --sz-trophy: clamp(34px, 5.5vh, 60px);
  --sz-flag:   clamp(28px, 4.5vh, 42px);
  --sz-pill-w: clamp(58px, 15vw, 82px);
  --sz-stat-h: clamp(42px, 6.5vh, 72px);
  --sz-mini-h: clamp(54px, 8vh, 86px);

  width: min(100%, var(--cw));
  max-width: 100%;
  max-height: calc(100svh - 60px - var(--app-tabbar-height, 0px));
  margin-inline: auto;
  padding: var(--pd);
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
  isolation: isolate;

  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: var(--gp);

  border-radius: clamp(18px, 2.5vw, 28px);
  border: 2px solid transparent;
  background:
    radial-gradient(circle at 50% 0%, rgba(220,170,60,.22), transparent 35%),
    linear-gradient(180deg, #1a1207 0%, #090604 100%);
  color: #fff;
  box-shadow:
    inset 0 0 0 1px rgba(255,236,183,.08),
    inset 0 14px 20px rgba(255,219,120,.03),
    0 24px 56px rgba(0,0,0,.38);
  animation: fut-card-halo-pulse 7s ease-in-out infinite;
}

.fut-card::after {
  content: "";
  position: absolute;
  inset: 0;
  padding: 2px;
  border-radius: inherit;
  background: conic-gradient(
    from var(--fut-card-border-angle),
    rgba(255,240,191,.92) 0deg,
    rgba(212,175,55,.22) 52deg,
    rgba(255,164,47,.84) 98deg,
    rgba(255,240,191,.12) 148deg,
    rgba(255,196,82,.82) 214deg,
    rgba(255,240,191,.14) 276deg,
    rgba(212,175,55,.28) 320deg,
    rgba(255,240,191,.92) 360deg
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 0;
  animation: fut-card-border-orbit 10s linear infinite;
}

.fut-card > * {
  position: relative;
  z-index: 1;
}

/* ---- header ---- */
.fut-card-header {
  display: grid;
  gap: clamp(1px, 0.3vh, 3px);
  text-align: center;
}

.fut-card-title {
  color: #fff0bf;
  font-family: "Anton", sans-serif;
  font-size: var(--fs-title);
  letter-spacing: .08em;
  line-height: .92;
  text-transform: uppercase;
}

.fut-card-subtitle {
  color: #d3a83b;
  font-family: "Montserrat", sans-serif;
  font-size: var(--fs-subtitle);
  font-weight: 800;
  letter-spacing: .28em;
  line-height: 1;
  text-transform: uppercase;
}

/* ---- top row: OVR | crest | rank ---- */
.fut-top-row {
  display: grid;
  grid-template-columns: minmax(0,1fr) var(--sz-crest) minmax(0,1fr);
  align-items: center;
  gap: clamp(4px, 0.8vh, 10px);
}

.fut-mini-card {
  min-width: 0;
  min-height: var(--sz-mini-h);
  padding: clamp(4px, 0.7vh, 8px);
  box-sizing: border-box;
  border-radius: clamp(12px, 1.8vw, 18px);
  border: 1px solid rgba(202,159,58,.48);
  background: linear-gradient(180deg, #1a1208, #080503);
  display: grid;
  justify-items: center;
  align-content: center;
  gap: clamp(1px, 0.2vh, 3px);
  text-align: center;
}

.fut-mini-card--rank[role="button"] {
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

.fut-mini-card--rank[role="button"]:focus-visible {
  outline: none;
  border-color: rgba(255,232,165,.96);
  box-shadow:
    inset 0 0 0 1px rgba(255,238,188,.18),
    0 0 0 2px rgba(255,211,91,.26);
}

.fut-mini-label {
  color: #d3a83b;
  font-family: "Montserrat", sans-serif;
  font-size: var(--fs-mini-lbl);
  font-weight: 800;
  letter-spacing: .2em;
  line-height: 1;
  text-transform: uppercase;
}

.fut-mini-value {
  color: #fff8e8;
  font-family: "Cinzel", serif;
  font-size: var(--fs-mini-val);
  font-weight: 900;
  line-height: .95;
}

.fut-mini-meta {
  color: rgba(255,238,195,.84);
  font-family: "Montserrat", sans-serif;
  font-size: var(--fs-mini-met);
  font-weight: 700;
  letter-spacing: .10em;
  line-height: 1;
  text-transform: uppercase;
}

.fut-crest-wrap { display: grid; place-items: center; min-width: 0; }
.fut-crest { width: 100%; max-width: var(--sz-crest); height: auto; display: block; }

/* ---- hero (trophy → ball → pills → name) ---- */
.fut-hero {
  min-height: 0;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: clamp(3px, 0.5vh, 6px);
  overflow: hidden;
}

.fut-trophy-wrap {
  display: grid;
  justify-items: center;
  gap: 1px;
}

.fut-trophy {
  width: var(--sz-trophy);
  height: var(--sz-trophy);
  display: block;
}

.fut-trophy-number {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 46px;
  font-weight: 900;
  fill: #140b02;
  stroke: #fff2a8;
  stroke-width: .7px;
  paint-order: stroke fill;
}

.fut-trophy-label {
  color: #d6a938;
  font-family: "Montserrat", sans-serif;
  font-size: clamp(5px, 0.7vh, 8px);
  font-weight: 900;
  letter-spacing: .16em;
  line-height: 1;
  text-transform: uppercase;
}

.fut-ball-stage {
  width: min(100%, var(--sz-ball));
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  border: 1px solid rgba(196,150,47,.18);
  background: radial-gradient(circle at 35% 26%, rgba(255,223,139,.12), transparent 34%), #0e0906;
}

.fut-ball-image, .fut-hero-overlay { grid-area: 1/1; }

.fut-ball-image {
  width: 100%; height: 100%;
  object-fit: cover; object-position: 50% 46%;
  transform: scale(3.05); transform-origin: 50% 46%;
  filter: brightness(.78) saturate(.8) contrast(1.08);
  z-index: 0;
}

.fut-hero-overlay {
  width: 100%; height: 100%;
  min-width: 0; min-height: 0;
  box-sizing: border-box;
  padding: clamp(6px, 1.1vh, 12px) clamp(10px, 2.5vw, 16px);
  display: grid;
  justify-items: center;
  align-content: start;
  gap: clamp(3px, 0.45vh, 6px);
  transform: translateY(clamp(-3px, -0.4vh, -6px));
  z-index: 1;
}

.fut-flag-wrap {
  display: grid;
  place-items: center;
  margin-top: 0;
}

.fut-player-flag,
.fut-player-flag-image,
.fut-player-name {
  box-shadow: none !important;
  text-shadow: none !important;
  filter: none !important;
}

.fut-player-flag {
  width: var(--sz-flag); height: var(--sz-flag);
  display: inline-grid; place-items: center;
  border-radius: 999px; overflow: hidden;
  border: 1px solid rgba(214,169,56,.76);
  background: #110b05;
}

.fut-player-flag-image { width: 100%; height: 100%; display: block; object-fit: cover; }

.fut-player-flag-fallback {
  color: #fff0c7;
  font-family: "Montserrat", sans-serif;
  font-size: clamp(8px, 1.2vh, 12px);
  font-weight: 800;
  letter-spacing: .06em;
}

.fut-position-pills {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: clamp(4px, 0.5vh, 6px);
  width: min(100%, calc(var(--sz-ball) - 24px));
  max-width: calc(100% - 8px);
  margin-top: 0;
}

.fut-position-pill {
  width: auto;
  min-width: clamp(36px, 9vw, 54px);
  max-width: 100%;
  padding: clamp(3px, 0.4vh, 5px) clamp(8px, 1.8vw, 12px);
  border-radius: 999px;
  border: 1px solid rgba(212,175,55,.46);
  background: linear-gradient(180deg, rgba(26,17,10,.98), rgba(10,7,5,.98));
  color: #f7ebc8;
  font-family: "Montserrat", sans-serif;
  font-size: clamp(8px, 0.95vh, 11px);
  font-weight: 800;
  letter-spacing: .10em;
  line-height: 1;
  text-transform: uppercase;
  text-align: center;
}

.fut-player-name {
  display: block;
  max-inline-size: min(100%, 14ch);
  min-width: 0;
  color: #fff0c7;
  font-family: "Cinzel", serif;
  font-size: var(--fs-name);
  font-weight: 900;
  line-height: .94;
  letter-spacing: .03em;
  text-transform: uppercase;
  text-align: center;
  text-wrap: balance;
  overflow-wrap: anywhere;
  max-height: 2em;
  overflow: hidden;
}

/* ==============================================================
   STATS GRID — CSS Grid only.  2 columns. Direct children.
   FORBIDDEN: position:absolute, transform:translate, neg margins.
   ============================================================== */
.fut-stats-grid {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: var(--sz-stat-h);
  gap: var(--gp);
  align-content: start;
  box-sizing: border-box;
}

.fut-stat-card {
  width: 100%;
  height: var(--sz-stat-h);
  min-width: 0; min-height: 0;
  box-sizing: border-box;
  padding: clamp(3px, 0.5vh, 6px) clamp(4px, 0.8vw, 8px);
  border-radius: clamp(10px, 1.5vw, 16px);
  border: 1px solid rgba(202,159,58,.55);
  background: linear-gradient(180deg, #1a1208, #080503);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(1px, 0.15vh, 2px);
  text-align: center;
  position: static !important;
  inset: auto !important;
  margin: 0 !important;
  transform: none !important;
}

.fut-stat-card--rank-selector {
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

.fut-stat-card--rank-selector[role="button"] {
  cursor: pointer;
}

.fut-stat-card--rank-selector.is-rank-active {
  border-color: rgba(255,224,138,.92);
  background:
    radial-gradient(circle at 50% 0%, rgba(255,216,115,.22), transparent 55%),
    linear-gradient(180deg, #221607, #0b0603);
  box-shadow:
    inset 0 0 0 1px rgba(255,238,188,.14),
    0 0 0 1px rgba(255,211,91,.18);
}

.fut-stat-card--rank-selector[role="button"]:focus-visible {
  outline: none;
  border-color: rgba(255,232,165,.96);
  box-shadow:
    inset 0 0 0 1px rgba(255,238,188,.18),
    0 0 0 2px rgba(255,211,91,.26);
}

.fut-stat-card.is-zero {
  opacity: .42;
  filter: grayscale(.4);
}

.fut-stat-icon {
  width: clamp(10px, 1.4vh, 14px);
  height: clamp(10px, 1.4vh, 14px);
  color: #d7af4b;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}

.fut-stat-icon svg {
  width: 100%; height: 100%;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.fut-stat-label {
  width: 100%; min-width: 0;
  color: #d3a83b;
  font-family: "Montserrat", sans-serif;
  font-size: var(--fs-stat-lbl);
  font-weight: 800;
  letter-spacing: .12em;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fut-stat-value {
  width: 100%; max-width: 100%; min-width: 0;
  color: #fff7e6;
  font-family: "Cinzel", serif;
  font-size: var(--fs-stat-val);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -.02em;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}

.fut-stat-value.record,
.fut-stat-value--record {
  font-size: clamp(12px, 2vh, 20px);
  letter-spacing: -.04em;
}

.fut-stat-value--compact {
  font-size: clamp(14px, 2.2vh, 22px);
}

.fut-stat-value--text {
  font-family: "Montserrat", sans-serif;
  font-size: clamp(9px, 1.4vh, 14px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: .04em;
  white-space: normal;
  text-transform: uppercase;
  text-wrap: balance;
}

.fut-stat-value--long:not(.fut-stat-value--record):not(.fut-stat-value--text) {
  font-size: clamp(13px, 2vh, 22px);
}

@keyframes fut-card-border-orbit {
  from { --fut-card-border-angle: 0deg; }
  to { --fut-card-border-angle: 360deg; }
}

@keyframes fut-card-halo-pulse {
  0%, 100% {
    box-shadow:
      inset 0 0 0 1px rgba(255,236,183,.08),
      inset 0 14px 20px rgba(255,219,120,.03),
      0 24px 56px rgba(0,0,0,.38),
      0 0 0 1px rgba(255,214,107,.10),
      0 0 24px rgba(240,176,55,.10);
  }

  50% {
    box-shadow:
      inset 0 0 0 1px rgba(255,236,183,.12),
      inset 0 18px 24px rgba(255,219,120,.06),
      0 30px 70px rgba(0,0,0,.44),
      0 0 0 1px rgba(255,214,107,.24),
      0 0 40px rgba(240,176,55,.20);
  }
}

/* ============================================================
   EXPORT MODE — fixed large dimensions for html2canvas
   ============================================================ */
.fut-card.export-mode {
  --pd: 28px;
  --gp: 16px;
  --fs-title: 60px;
  --fs-subtitle: 16px;
  --fs-name: 42px;
  --fs-stat-val: 40px;
  --fs-stat-lbl: 13px;
  --fs-mini-val: 36px;
  --fs-mini-lbl: 12px;
  --fs-mini-met: 10px;
  --sz-ball: 280px;
  --sz-crest: 160px;
  --sz-trophy: 88px;
  --sz-flag: 60px;
  --sz-pill-w: 120px;
  --sz-stat-h: 110px;
  --sz-mini-h: 130px;

  width: 900px !important;
  max-width: 900px !important;
  max-height: none !important;
  overflow: visible !important;
  margin: 0 !important;
  border-radius: 42px;
}

.fut-card.export-mode::after {
  content: none;
}

.fut-card.export-mode .fut-top-row {
  grid-template-columns: 1fr 160px 1fr;
  gap: 20px;
}

.fut-card.export-mode .fut-mini-card {
  min-height: 130px;
  border-radius: 24px;
}

.fut-card.export-mode .fut-position-pill { font-size: 16px; }

.fut-card.export-mode .fut-stats-grid {
  gap: 16px !important;
  grid-auto-rows: 110px;
}

.fut-card.export-mode .fut-stat-card {
  height: 110px !important;
  min-height: 110px !important;
  border-radius: 22px;
  padding: 10px;
}

.fut-card.export-mode .fut-stat-value.record,
.fut-card.export-mode .fut-stat-value--record {
  font-size: 34px;
}

@media (prefers-reduced-motion: reduce) {
  .fut-card,
  .fut-card::after {
    animation: none !important;
    transition: none !important;
  }
}
`;

  function injectCSS() {
    if (typeof document === "undefined") return;
    if (document.getElementById("mc-player-badge-css")) return;
    const style = document.createElement("style");
    style.id = "mc-player-badge-css";
    style.textContent = BADGE_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  injectCSS();

  /* ------------------------------------------------------------------ */
  /*  Utilities                                                          */
  /* ------------------------------------------------------------------ */
  function nextFrame(callback) {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      callback();
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value, fallback) {
    if (value == null) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  function normalizeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function assetUrl(path) {
    if (!path) return "";
    if (assetBaseUrl) return new URL(path.replace(/^\/+/, ""), assetBaseUrl).href;
    if (typeof window !== "undefined") return new URL(path.replace(/^\/+/, ""), window.location.href).href;
    return path;
  }

  function formatRank(value) {
    const rank = Number(value);
    return Number.isFinite(rank) && rank > 0 ? String(rank) : "--";
  }

  function formatRankDisplay(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return "--";
    }

    const numericRank = Number(text);
    if (Number.isFinite(numericRank)) {
      return numericRank > 0 ? String(numericRank) : "--";
    }

    return text;
  }

  function formatPpg(value) {
    const ppg = Number(value);
    return Number.isFinite(ppg) ? ppg.toFixed(2) : "0.00";
  }

  function formatWholeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : "0";
  }

  function buildBadgeRankState(player, stats) {
    const ppgRank = formatRankDisplay(
      player?.ppg_rank_display ??
      stats?.ppg_rank_display ??
      player?.ppg_rank ??
      stats?.ppg_rank ??
      player?.rank ??
      stats?.rank
    );
    const pointsRank = formatRankDisplay(
      player?.points_rank_display ??
      stats?.points_rank_display ??
      player?.points_rank ??
      stats?.points_rank
    );
    const ppgRankSummary = normalizeText(
      player?.ppg_rank_label ?? stats?.ppg_rank_label,
      "PPG Rank"
    );
    const pointsRankSummary = normalizeText(
      player?.points_rank_label ?? stats?.points_rank_label,
      "Points Rank"
    );
    const rankModes = [];

    if (ppgRank !== "--") {
      rankModes.push("ppg");
    }

    if (pointsRank !== "--") {
      rankModes.push("points");
    }

    const activeRankMode = rankModes.includes("ppg") ? "ppg" : rankModes[0] || "ppg";
    const activeRank = activeRankMode === "points" ? pointsRank : ppgRank;
    const activeRankSummary = rankModes.length
      ? activeRankMode === "points" ? pointsRankSummary : ppgRankSummary
      : "Ranking unavailable";

    return {
      activeRank,
      activeRankMode,
      activeRankSummary,
      pointsRank,
      pointsRankSummary,
      ppgRank,
      ppgRankSummary,
      rankModes,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Flag resolution                                                    */
  /* ------------------------------------------------------------------ */
  function resolveFlagCode(player) {
    const directCode = normalizeText(player?.flag_code || player?.flagCode, "").toUpperCase();
    if (/^[A-Z]{2}$/.test(directCode)) return directCode;

    const globalCode = window.MandarinasLogic?.nationalityCode?.(
      player?.nationality || player?.country || ""
    );
    const normalizedGlobalCode = normalizeText(globalCode, "").toUpperCase();
    if (/^[A-Z]{2}$/.test(normalizedGlobalCode)) return normalizedGlobalCode;

    const inferred = normalizeText(player?.nationality || player?.country, "").toUpperCase();
    return /^[A-Z]{2}$/.test(inferred) ? inferred : "";
  }

  function flagAssetPath(code) {
    const normalized = normalizeText(code, "").toLowerCase();
    return /^[a-z]{2}$/.test(normalized) ? assetUrl(`assets/flags/${normalized}.png`) : "";
  }

  function fallbackFlagCode(code, label) {
    const normalizedCode = normalizeText(code, "").toUpperCase();
    if (/^[A-Z]{2}$/.test(normalizedCode)) return normalizedCode;
    return normalizeText(label, "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  }

  function badgeFlagMarkup(code, label) {
    const normalizedCode = normalizeText(code, "").toUpperCase();
    const fallback = fallbackFlagCode(normalizedCode, label);
    if (!normalizedCode && !fallback) return "";
    const src = flagAssetPath(normalizedCode);

    return `
      <span class="fut-player-flag" data-flag-code="${escapeHtml((normalizedCode || fallback).toLowerCase())}" title="${escapeHtml(label || fallback)}" aria-hidden="true">
        ${
          src
            ? `
              <span class="fut-player-flag-fallback" hidden>${escapeHtml(fallback || "??")}</span>
              <img
                class="fut-player-flag-image"
                src="${escapeHtml(src)}"
                alt=""
                loading="eager"
                decoding="async"
                onerror="this.hidden=true; if (this.previousElementSibling) this.previousElementSibling.hidden=false;"
              />
            `
            : `<span class="fut-player-flag-fallback">${escapeHtml(fallback || "??")}</span>`
        }
      </span>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Position helpers                                                   */
  /* ------------------------------------------------------------------ */
  function positionList(player) {
    if (Array.isArray(player?.positions) && player.positions.length) {
      return player.positions.slice(0, 4).map((v) => normalizeText(v, "").toUpperCase()).filter(Boolean);
    }
    const fallback = normalizeText(player?.position_label || player?.primary_position, "").toUpperCase();
    return fallback ? [fallback] : [];
  }

  function formatPosition(player) {
    const positions = positionList(player);
    return positions.length ? positions.join(" · ") : "N/A";
  }

  function positionPillsMarkup(player) {
    const positions = positionList(player);
    const values = positions.length ? positions : ["N/A"];
    return values
      .map((v) => `<span class="fut-position-pill" title="${escapeHtml(v)}">${escapeHtml(v)}</span>`)
      .join("");
  }

  /* ------------------------------------------------------------------ */
  /*  Trophy SVG                                                         */
  /* ------------------------------------------------------------------ */
  function trophyMarkup(value, idPrefix) {
    const safeId = normalizeText(idPrefix, `badge-trophy-${++badgeSerial}`).replace(/[^a-zA-Z0-9_-]/g, "");
    const cupGoldId = `${safeId}-cupGold`;
    const darkGoldId = `${safeId}-darkGold`;
    const cupGlowId = `${safeId}-cupGlow`;
    const goldShadowId = `${safeId}-goldShadow`;
    const trophyValue = formatWholeNumber(Math.max(0, normalizeNumber(value, 0)));

    return `
      <div class="fut-trophy-wrap" aria-label="Seasons won">
        <svg class="fut-trophy" viewBox="0 0 180 180" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="${cupGoldId}" x1="35" y1="20" x2="145" y2="165">
              <stop offset="0%" stop-color="#fff3a6"></stop>
              <stop offset="22%" stop-color="#f6c443"></stop>
              <stop offset="48%" stop-color="#b87916"></stop>
              <stop offset="72%" stop-color="#f3c64a"></stop>
              <stop offset="100%" stop-color="#7a470d"></stop>
            </linearGradient>
            <linearGradient id="${darkGoldId}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#7d4a10"></stop>
              <stop offset="50%" stop-color="#f2bf3c"></stop>
              <stop offset="100%" stop-color="#5b3308"></stop>
            </linearGradient>
            <radialGradient id="${cupGlowId}" cx="50%" cy="25%" r="65%">
              <stop offset="0%" stop-color="#fff8bf" stop-opacity=".95"></stop>
              <stop offset="45%" stop-color="#d99b25" stop-opacity=".45"></stop>
              <stop offset="100%" stop-color="#000000" stop-opacity="0"></stop>
            </radialGradient>
            <filter id="${goldShadowId}" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".55"></feDropShadow>
              <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#d9a431" flood-opacity=".45"></feDropShadow>
            </filter>
          </defs>
          <ellipse cx="90" cy="154" rx="44" ry="10" fill="#090604" opacity=".65"></ellipse>
          <g filter="url(#${goldShadowId})">
            <path d="M48 54H25c-5 0-8 4-8 9 0 25 14 43 39 48l4-15c-16-4-26-16-27-28h18z" fill="url(#${cupGoldId})" stroke="#eec24e" stroke-width="1"></path>
            <path d="M132 54h23c5 0 8 4 8 9 0 25-14 43-39 48l-4-15c16-4 26-16 27-28h-18z" fill="url(#${cupGoldId})" stroke="#eec24e" stroke-width="1"></path>
            <path d="M48 34h84c-2 47-15 78-42 78S50 81 48 34z" fill="url(#${cupGoldId})" stroke="#fff0a3" stroke-width="2"></path>
            <path d="M58 43h64c-3 31-11 52-32 52S61 74 58 43z" fill="url(#${cupGlowId})" opacity=".55"></path>
            <path d="M78 111h24v25H78z" fill="url(#${darkGoldId})" stroke="#eec24e" stroke-width="1.5"></path>
            <path d="M59 136h62l8 19H51z" fill="url(#${cupGoldId})" stroke="#eec24e" stroke-width="1.5"></path>
            <path d="M48 155h84v11H48z" fill="#2b1705" stroke="#b98b2b" stroke-width="1.5"></path>
          </g>
          <text class="fut-trophy-number" x="90" y="78" text-anchor="middle" dominant-baseline="middle">${escapeHtml(trophyValue)}</text>
        </svg>
        <div class="fut-trophy-label">Seasons Won</div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Stat icons (stroke-based, 20×20 viewBox)                          */
  /* ------------------------------------------------------------------ */
  function statIconMarkup(kind) {
    const icons = {
      season: `
        <path d="M5.1 3.85H14.9C15.84 3.85 16.6 4.61 16.6 5.55V14.9C16.6 15.84 15.84 16.6 14.9 16.6H5.1C4.16 16.6 3.4 15.84 3.4 14.9V5.55C3.4 4.61 4.16 3.85 5.1 3.85Z" />
        <path d="M6.55 2.35V5.45" />
        <path d="M13.45 2.35V5.45" />
        <path d="M3.4 7.1H16.6" />
        <path d="M6.2 10.05H9.15" />
        <path d="M10.85 10.05H13.8" />
        <path d="M6.2 12.85H9.15" />
      `,
      record: `
        <path d="M4.15 5.1H15.85" />
        <path d="M4.15 10H15.85" />
        <path d="M4.15 14.9H15.85" />
        <path d="M7.2 3.35V16.65" />
        <path d="M12.8 3.35V16.65" />
      `,
      ppg: `
        <path d="M4.35 14.9L8.15 10.45L11.05 12.6L15.65 6.15" />
        <path d="M12.85 6.15H15.65V8.95" />
      `,
      points: `
        <path d="M10 2.25L12.45 7.15L17.85 7.95L13.95 11.7L14.85 17L10 14.45L5.15 17L6.05 11.7L2.15 7.95L7.55 7.15Z" />
      `,
      apps: `
        <path d="M6.1 4.1L8.95 6.1H11.05L13.9 4.1L17 6.45L15.55 10.05L13.8 9.3V16H6.2V9.3L4.45 10.05L3 6.45Z" />
      `,
      goals: `
        <circle cx="10" cy="10" r="7" />
        <path d="M10 5.75L11.9 7.05L11.2 9.35H8.8L8.1 7.05Z" />
        <path d="M8.1 7.05L5.75 7.7L5.3 10.15L7.2 11.95" />
        <path d="M11.9 7.05L14.25 7.7L14.7 10.15L12.8 11.95" />
        <path d="M8.8 9.35L7.2 11.95L8.15 14.15" />
        <path d="M11.2 9.35L12.8 11.95L11.85 14.15" />
        <path d="M8.15 14.15H11.85" />
      `,
      goal_keeps: `
        <path d="M7.1 4.95V9.65" />
        <path d="M9.45 4.2V8.8" />
        <path d="M11.75 4.65V8.6" />
        <path d="M14.05 5.85V9.75" />
        <path d="M7.05 9.2L5.95 8.1C5.15 7.3 3.85 8.4 4.5 9.3L6.8 12.45C7.4 13.3 8.4 13.8 9.45 13.8H13.4C14.95 13.8 16.2 12.55 16.2 11V8.65" />
      `,
      clean_sheets: `
        <path d="M10 2.7L15.4 4.8V8.95C15.4 12.45 13.1 14.9 10 16.5C6.9 14.9 4.6 12.45 4.6 8.95V4.8Z" />
        <path d="M7.35 9.45L9.2 11.3L12.75 7.75" />
      `,
    };

    const icon = icons[kind];
    if (!icon) return "";

    return `
      <span class="fut-stat-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${icon}
        </svg>
      </span>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Stat-card data normalization                                       */
  /* ------------------------------------------------------------------ */
  function normalizeCardKey(value) {
    return normalizeText(value, "stat").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function recordValue(stats) {
    return `${formatWholeNumber(stats?.wins ?? 0)}-${formatWholeNumber(stats?.draws ?? 0)}-${formatWholeNumber(stats?.losses ?? 0)}`;
  }

  function hasStatSource(source, keys) {
    return keys.some((key) => (
      Object.prototype.hasOwnProperty.call(source, key) &&
      source[key] !== undefined &&
      source[key] !== null
    ));
  }

  function normalizeBadgeCard(card) {
    const formattedValue =
      card && Object.prototype.hasOwnProperty.call(card, "formattedValue")
        ? normalizeText(card.formattedValue, "0")
        : typeof card?.value === "string"
          ? normalizeText(card.value, "0")
          : formatWholeNumber(card?.value);
    const normalizedKey = normalizeCardKey(card?.key);
    const normalizedValueKind = normalizeText(card?.valueKind, "numeric")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const numericValue = Number(String(formattedValue).replace(/,/g, ""));
    const zeroLikeValue =
      normalizedKey !== "season" &&
      normalizedKey !== "record" &&
      Number.isFinite(numericValue) &&
      numericValue === 0;

    const valueClassName = [
      "fut-stat-value",
      normalizedKey === "record" ? "record" : "",
      normalizedKey === "season" ? "season" : "",
      `fut-stat-value--${normalizedKey || "stat"}`,
      `fut-stat-value--${normalizedValueKind || "numeric"}`,
      formattedValue.length >= 8 ? "fut-stat-value--long" : "",
    ].filter(Boolean).join(" ");

    const cardClassName = [
      "fut-stat-card",
      zeroLikeValue ? "is-zero" : "",
      `fut-stat-card--${normalizedKey || "stat"}`,
      `fut-stat-card--${normalizedValueKind || "numeric"}`,
    ].filter(Boolean).join(" ");

    return {
      key: normalizeText(card?.key, "stat"),
      label: normalizeText(card?.label, "Stat"),
      icon: normalizeText(card?.icon || card?.key, ""),
      value: formattedValue,
      valueKind: normalizedValueKind || "numeric",
      valueClassName,
      cardClassName,
    };
  }

  function buildBadgeStatCards(stats, options) {
    const source = stats && typeof stats === "object" ? stats : {};
    const summaryCardMap = new Map(
      (Array.isArray(options?.summaryCards) ? options.summaryCards : [])
        .filter(Boolean)
        .map((card) => [normalizeCardKey(card?.key), card])
    );
    const seasonCard = summaryCardMap.get("season");
    const recordCard = summaryCardMap.get("record");
    const ppgCard = summaryCardMap.get("ppg");
    const appsCard = summaryCardMap.get("apps");
    const cards = [];
    const includeSummaryCards = summaryCardMap.size > 0;
    const hasSeasonData = includeSummaryCards || hasStatSource(source, ["seasons_participated"]);
    const hasRecordData = includeSummaryCards || hasStatSource(source, ["wins", "draws", "losses"]);
    const hasPpgData = includeSummaryCards || hasStatSource(source, ["ppg", "points_per_game"]);
    const hasAppsData = includeSummaryCards || hasStatSource(source, ["apps", "attendance", "days_attended"]);
    const hasPointsData = hasStatSource(source, ["points", "total_points"]);
    const hasGoalsData = hasStatSource(source, ["goals"]);
    const hasGoalKeepsData = hasStatSource(source, ["goal_keeps", "goalKeeps", "goal_keep_points_earned"]);
    const hasCleanSheetsData = hasStatSource(source, ["clean_sheets", "cleanSheets"]);

    if (hasSeasonData) {
      cards.push(normalizeBadgeCard({
        key: "season",
        label: seasonCard?.label || "Seasons",
        icon: "season",
        value: seasonCard && Object.prototype.hasOwnProperty.call(seasonCard, "value")
          ? seasonCard.value : source.seasons_participated ?? 0,
        formattedValue: seasonCard && Object.prototype.hasOwnProperty.call(seasonCard, "formattedValue")
          ? seasonCard.formattedValue : formatWholeNumber(source.seasons_participated ?? 0),
        valueKind: seasonCard?.valueKind || "text",
      }));
    }

    if (hasRecordData) {
      cards.push(normalizeBadgeCard({
        key: "record",
        label: recordCard?.label || "Record",
        icon: "record",
        value: recordCard && Object.prototype.hasOwnProperty.call(recordCard, "value")
          ? recordCard.value : recordValue(source),
        formattedValue: recordCard && Object.prototype.hasOwnProperty.call(recordCard, "formattedValue")
          ? recordCard.formattedValue : recordValue(source),
        valueKind: recordCard?.valueKind || "compact",
      }));
    }

    if (hasPpgData) {
      cards.push(normalizeBadgeCard({
        key: "ppg",
        label: ppgCard?.label || "PPG",
        icon: "ppg",
        value: ppgCard && Object.prototype.hasOwnProperty.call(ppgCard, "value")
          ? ppgCard.value : formatPpg(source.ppg ?? source.points_per_game),
        formattedValue: ppgCard && Object.prototype.hasOwnProperty.call(ppgCard, "formattedValue")
          ? ppgCard.formattedValue : formatPpg(source.ppg ?? source.points_per_game),
        valueKind: ppgCard?.valueKind || "compact",
      }));
    }

    if (hasAppsData) {
      cards.push(normalizeBadgeCard({
        key: "apps",
        label: appsCard?.label || "Apps",
        icon: "apps",
        value: appsCard && Object.prototype.hasOwnProperty.call(appsCard, "value")
          ? appsCard.value : source.apps ?? source.attendance ?? source.days_attended ?? 0,
        formattedValue: appsCard && Object.prototype.hasOwnProperty.call(appsCard, "formattedValue")
          ? appsCard.formattedValue
          : formatWholeNumber(source.apps ?? source.attendance ?? source.days_attended ?? 0),
      }));
    }

    if (hasPointsData) {
      cards.push(normalizeBadgeCard({
        key: "points",
        label: "Points",
        icon: "points",
        value: source.points ?? source.total_points ?? 0,
      }));
    }

    if (hasGoalsData) {
      cards.push(normalizeBadgeCard({
        key: "goals",
        label: "Goals",
        icon: "goals",
        value: source.goals ?? 0,
      }));
    }

    if (hasGoalKeepsData) {
      cards.push(normalizeBadgeCard({
        key: "goal-keeps",
        label: "Goal Keeps",
        icon: "goal_keeps",
        value: source.goal_keeps ?? source.goalKeeps ?? source.goal_keep_points_earned ?? 0,
      }));
    }

    if (hasCleanSheetsData) {
      cards.push(normalizeBadgeCard({
        key: "clean-sheets",
        label: "Clean Sheets",
        icon: "clean_sheets",
        value: source.clean_sheets ?? source.cleanSheets ?? 0,
      }));
    }

    return cards;
  }

  function badgeRankModes(badge) {
    return normalizeText(badge?.dataset?.rankModes, "")
      .split(",")
      .map((value) => normalizeText(value, "").toLowerCase())
      .filter(Boolean);
  }

  function badgeRankValue(badge, mode) {
    if (mode === "points") {
      return normalizeText(badge?.dataset?.rankPoints, "--");
    }

    return normalizeText(badge?.dataset?.rankPpg, "--");
  }

  function badgeRankLabel(badge, mode) {
    if (mode === "points") {
      return normalizeText(badge?.dataset?.rankPointsLabel, "Points Rank");
    }

    return normalizeText(badge?.dataset?.rankPpgLabel, "PPG Rank");
  }

  function nextBadgeRankMode(badge) {
    const availableModes = badgeRankModes(badge);
    if (availableModes.length <= 1) {
      return availableModes[0] || "ppg";
    }

    const activeMode = normalizeText(badge?.dataset?.rankMode, availableModes[0] || "ppg").toLowerCase();
    const activeIndex = availableModes.indexOf(activeMode);
    if (activeIndex < 0) {
      return availableModes[0];
    }

    return availableModes[(activeIndex + 1) % availableModes.length];
  }

  function updateBadgeRankSelectorState(badge) {
    const activeMode = normalizeText(badge?.dataset?.rankMode, "ppg").toLowerCase();
    badge.querySelectorAll("[data-rank-select]").forEach((node) => {
      const mode = normalizeText(node.dataset.rankSelect, "").toLowerCase();
      const isActive = mode === activeMode;
      node.classList.toggle("is-rank-active", isActive);

      if (node.getAttribute("role") === "button") {
        node.setAttribute("aria-pressed", isActive ? "true" : "false");
      }

      const label = badgeRankLabel(badge, mode);
      const message = isActive ? `${label} selected` : `Show ${label}`;
      node.setAttribute("aria-label", message);
      node.setAttribute("title", message);
    });

    const toggleNode = badge.querySelector("[data-rank-toggle]");
    if (toggleNode) {
      const nextMode = nextBadgeRankMode(badge);
      const availableModes = badgeRankModes(badge);
      const canToggle = availableModes.length > 1;
      const toggleMessage = canToggle
        ? `Rank box selected. Tap to show ${badgeRankLabel(badge, nextMode)}`
        : `${badgeRankLabel(badge, activeMode)} selected`;
      toggleNode.setAttribute("aria-label", toggleMessage);
      toggleNode.setAttribute("title", toggleMessage);
      if (toggleNode.getAttribute("role") === "button") {
        toggleNode.setAttribute("aria-pressed", canToggle ? "true" : "false");
      }
    }
  }

  function applyBadgeRankMode(badge, mode) {
    if (!badge) return;
    const availableModes = badgeRankModes(badge);
    const normalizedMode = normalizeText(mode, "").toLowerCase();
    const nextMode = availableModes.includes(normalizedMode)
      ? normalizedMode
      : availableModes[0] || "ppg";

    badge.dataset.rankMode = nextMode;

    const valueNode = badge.querySelector("[data-rank-value]");
    if (valueNode) {
      valueNode.textContent = badgeRankValue(badge, nextMode);
    }

    const metaNode = badge.querySelector("[data-rank-meta]");
    if (metaNode) {
      metaNode.textContent = badgeRankLabel(badge, nextMode);
    }

    updateBadgeRankSelectorState(badge);
    scheduleBadgeFit(badge);
  }

  function hydrateBadgeRankSelectors(root) {
    if (!root || typeof root.querySelectorAll !== "function") return;
    const badges = [];

    if (typeof root.matches === "function" && root.matches(".fut-card")) {
      badges.push(root);
    }

    root.querySelectorAll(".fut-card").forEach((badge) => badges.push(badge));

    badges.forEach((badge) => {
      const selectors = Array.from(badge.querySelectorAll("[data-rank-select]"));
      const toggle = badge.querySelector("[data-rank-toggle]");
      if (!selectors.length && !toggle) return;

      applyBadgeRankMode(badge, badge.dataset.rankMode);

      if (badge.dataset.rankSelectorsBound === "true") {
        return;
      }

      badge.dataset.rankSelectorsBound = "true";

      selectors.forEach((selector) => {
        if (selector.getAttribute("role") !== "button") {
          return;
        }

        const activate = () => applyBadgeRankMode(badge, selector.dataset.rankSelect);

        selector.addEventListener("click", activate);
        selector.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          activate();
        });
      });

      if (toggle && toggle.getAttribute("role") === "button") {
        const toggleRankMode = () => applyBadgeRankMode(badge, nextBadgeRankMode(badge));

        toggle.addEventListener("click", toggleRankMode);
        toggle.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          toggleRankMode();
        });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Text fitting (shrink long names / values to fit container)         */
  /* ------------------------------------------------------------------ */
  function fitTextBlock(node, minimumSize) {
    if (!node || typeof window === "undefined" || !node.isConnected) return;
    node.style.removeProperty("font-size");
    const availableWidth = node.clientWidth;
    if (!availableWidth) return;
    let fontSize = Number.parseFloat(window.getComputedStyle(node).fontSize);
    if (!Number.isFinite(fontSize)) return;

    while (
      (node.scrollWidth > availableWidth + 1 || node.scrollHeight > node.clientHeight + 1) &&
      fontSize > minimumSize
    ) {
      fontSize -= 0.5;
      node.style.fontSize = `${fontSize}px`;
    }
  }

  function fitBadgeTypography(badge) {
    if (!badge || !badge.isConnected) return;
    fitTextBlock(badge.querySelector(".fut-player-name"), 9);
    badge.querySelectorAll(".fut-stat-value").forEach((node) => {
      let minimumSize = 10;
      if (node.classList.contains("record") || node.classList.contains("fut-stat-value--compact")) {
        minimumSize = 9;
      } else if (node.classList.contains("fut-stat-value--text")) {
        minimumSize = 8;
      } else if (node.classList.contains("fut-stat-value--long")) {
        minimumSize = 9;
      }
      fitTextBlock(node, minimumSize);
    });
  }

  function scheduleBadgeFit(badge) {
    if (!badge || badge.dataset.badgeFitScheduled === "true") return;
    badge.dataset.badgeFitScheduled = "true";
    nextFrame(() => {
      delete badge.dataset.badgeFitScheduled;
      fitBadgeTypography(badge);
    });
  }

  function scheduleAllBadgeFits(root) {
    if (typeof document === "undefined") return;
    const scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(".fut-card")) scheduleBadgeFit(scope);
    scope.querySelectorAll(".fut-card").forEach((badge) => scheduleBadgeFit(badge));
  }

  /* ------------------------------------------------------------------ */
  /*  Auto-observer (DOM mutations, fonts, resize)                       */
  /* ------------------------------------------------------------------ */
  function observeBadgeMounts() {
    if (typeof window === "undefined" || typeof document === "undefined" || window.__mcPlayerBadgeObserverReady) return;
    window.__mcPlayerBadgeObserverReady = true;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        hydrateBadgeRankSelectors(document);
        scheduleAllBadgeFits();
      }, { once: true });
    } else {
      hydrateBadgeRankSelectors(document);
      scheduleAllBadgeFits();
    }

    if (typeof MutationObserver === "function") {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              hydrateBadgeRankSelectors(node);
              scheduleAllBadgeFits(node);
            }
          });
        });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.fonts?.ready?.then) {
      document.fonts.ready.then(() => scheduleAllBadgeFits());
    }

    window.addEventListener("resize", () => scheduleAllBadgeFits());
  }

  /* ------------------------------------------------------------------ */
  /*  Markup builder                                                     */
  /* ------------------------------------------------------------------ */
  function createBadgeMarkup(model) {
    const crestUrl = escapeHtml(assetUrl(CREST_PATH));
    const ballArtUrl = escapeHtml(assetUrl(BALL_ART_PATH));
    const positions = positionList(model.player);
    const positionCount = Math.min(Math.max(positions.length, 1), 4);
    const rankModeSet = new Set(model.rankModes);
    const rankSwitchingEnabled = model.rankModes.length > 1;
    const flagMarkup =
      model.flagCode || model.flagTitle
        ? `<div class="fut-flag-wrap">${badgeFlagMarkup(model.flagCode, model.flagTitle)}</div>`
        : "";

    const statCardsMarkup = model.statCards
      .map((card) => {
        const normalizedCardKey = normalizeCardKey(card.key);
        const isRankSelector = rankModeSet.has(normalizedCardKey);
        const cardClassName = [
          card.cardClassName,
          isRankSelector ? "fut-stat-card--rank-selector" : "",
          isRankSelector && model.activeRankMode === normalizedCardKey ? "is-rank-active" : "",
        ].filter(Boolean).join(" ");
        const selectorAttrs = isRankSelector
          ? ` data-rank-select="${escapeHtml(normalizedCardKey)}"`
          : "";
        const interactiveAttrs =
          rankSwitchingEnabled && isRankSelector
            ? ` role="button" tabindex="0" aria-pressed="${model.activeRankMode === normalizedCardKey ? "true" : "false"}"`
            : "";

        return `
          <article class="${escapeHtml(cardClassName)}" data-stat-key="${escapeHtml(card.key)}" data-value-kind="${escapeHtml(card.valueKind)}"${selectorAttrs}${interactiveAttrs}>
            ${statIconMarkup(card.icon)}
            <div class="fut-stat-label">${escapeHtml(card.label)}</div>
            <strong class="${escapeHtml(card.valueClassName)}" title="${escapeHtml(card.value)}">${escapeHtml(card.value)}</strong>
          </article>
        `;
      })
      .join("");

    return `
      <section
        class="fut-card"
        aria-label="${escapeHtml(model.name)} player badge"
        data-rank-mode="${escapeHtml(model.activeRankMode)}"
        data-rank-modes="${escapeHtml(model.rankModes.join(","))}"
        data-rank-ppg="${escapeHtml(model.ppgRank)}"
        data-rank-ppg-label="${escapeHtml(model.ppgRankSummary)}"
        data-rank-points="${escapeHtml(model.pointsRank)}"
        data-rank-points-label="${escapeHtml(model.pointsRankSummary)}"
      >
        <header class="fut-card-header">
          <div class="fut-card-title">Mandarinas CF</div>
          <div class="fut-card-subtitle">California Club de Futbol</div>
        </header>

        <section class="fut-top-row" aria-label="Club badge summary">
          <article class="fut-mini-card fut-mini-card--overall">
            <span class="fut-mini-label">OVR</span>
            <strong class="fut-mini-value">${escapeHtml(model.overall)}</strong>
            <small class="fut-mini-meta">Overall Rating</small>
          </article>

          <div class="fut-crest-wrap">
            <img class="fut-crest" src="${crestUrl}" alt="Mandarinas CF crest" loading="eager" decoding="async" />
          </div>

          <article
            class="fut-mini-card fut-mini-card--rank"
            data-rank-toggle
            ${rankSwitchingEnabled ? 'role="button" tabindex="0"' : ""}
          >
            <span class="fut-mini-label">Rank</span>
            <strong class="fut-mini-value" data-rank-value>${escapeHtml(model.activeRank)}</strong>
            <small class="fut-mini-meta" data-rank-meta>${escapeHtml(model.activeRankSummary)}</small>
          </article>
        </section>

        <section class="fut-hero" aria-label="Player identity">
          ${model.showTrophy ? trophyMarkup(model.seasonsWon, model.trophyId) : ""}

          <div class="fut-ball-stage">
            <img class="fut-ball-image" src="${ballArtUrl}" alt="" loading="eager" decoding="async" />
            <div class="fut-hero-overlay">
              ${flagMarkup}
              <div class="fut-position-pills" data-count="${positionCount}" title="${escapeHtml(model.positionTitle)}">
                ${positionPillsMarkup(model.player)}
              </div>
            </div>
          </div>

          <div class="fut-player-name" title="${escapeHtml(model.name)}">${escapeHtml(model.name)}</div>
        </section>

        <section class="fut-stats-grid" aria-label="Player stats">
          ${statCardsMarkup}
        </section>
      </section>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */
  function renderPlayerBadge(player, stats, options) {
    const ppgSource = stats && typeof stats === "object" ? stats : {};
    const hasPpgData = hasStatSource(ppgSource, ["ppg", "points_per_game"]);
    const ppgValue = hasPpgData ? formatPpg(stats?.ppg ?? stats?.points_per_game) : "--";
    const rankState = buildBadgeRankState(player, stats);
    const data = {
      player,
      overall: formatWholeNumber(player?.overall_rating ?? player?.overall ?? player?.skill_rating ?? 0),
      activeRank: rankState.activeRank,
      activeRankMode: rankState.activeRankMode,
      activeRankSummary: rankState.activeRankSummary,
      ppg: ppgValue,
      ppgRank: rankState.ppgRank,
      ppgRankSummary: rankState.ppgRankSummary,
      pointsRank: rankState.pointsRank,
      pointsRankSummary: rankState.pointsRankSummary,
      rankModes: rankState.rankModes,
      flagCode: resolveFlagCode(player),
      flagTitle: normalizeText(player?.nationality || player?.country, ""),
      name: normalizeText(player?.name, "N/A"),
      positionTitle: formatPosition(player),
      seasonsWon: stats?.seasons_won ?? player?.seasons_won ?? 0,
      showTrophy:
        (options?.showTrophy !== false) &&
        normalizeNumber(stats?.seasons_won ?? player?.seasons_won, 0) > 0,
      trophyId: `mc-badge-trophy-${++badgeSerial}`,
      statCards: buildBadgeStatCards(stats, options),
    };

    const host = document.createElement("div");
    host.innerHTML = createBadgeMarkup(data).trim();
    const badge = host.firstElementChild;
    hydrateBadgeRankSelectors(badge);
    scheduleBadgeFit(badge);
    return badge;
  }

  function mountPlayerBadge(target, player, stats, options) {
    if (!target) return null;
    const badge = renderPlayerBadge(player, stats, options);
    target.replaceChildren(badge);
    fitBadgeTypography(badge);
    scheduleBadgeFit(badge);
    return badge;
  }

  /* ------------------------------------------------------------------ */
  /*  Bootstrap                                                          */
  /* ------------------------------------------------------------------ */
  observeBadgeMounts();

  window.renderPlayerBadge = renderPlayerBadge;
  window.mountPlayerBadge = mountPlayerBadge;
  window.createPlayerBadgeMarkup = createBadgeMarkup;
  window.schedulePlayerBadgeFit = scheduleBadgeFit;
  window.mcPlayerBadgeExample = {
    player: {
      name: "Asdruval Villanueva",
      nationality: "Mexico",
      flag_code: "MX",
      overall_rating: 80,
      rank: "19",
      ppg_rank: "19",
      points_rank: "14",
      primary_position: "DEF",
      position_label: "DEF · ATT · GK",
      positions: ["DEF", "ATT", "GK"],
      seasons_won: 8,
    },
    stats: {
      points: 298,
      apps: 54,
      goals: 6,
      wins: 40,
      draws: 21,
      losses: 47,
      goal_keeps: 5,
      clean_sheets: 0,
      points_per_game: 5.52,
      ppg_rank: "19",
      points_rank: "14",
      seasons_won: 8,
      seasons_participated: 8,
    },
  };
})();
