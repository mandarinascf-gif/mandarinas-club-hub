(function () {
  const BALL_ART_PATH = "assets/images/player-badge/reference-ball-full.png";
  let badgeSerial = 0;
  const scriptUrl =
    typeof document !== "undefined" && document.currentScript?.src
      ? new URL(document.currentScript.src, window.location.href)
      : null;
  const assetBaseUrl = scriptUrl ? new URL("../../../", scriptUrl) : null;

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
    if (value == null) {
      return fallback;
    }

    const text = String(value).trim();
    return text || fallback;
  }

  function normalizeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function assetUrl(path) {
    if (!path) {
      return "";
    }

    if (assetBaseUrl) {
      return new URL(path.replace(/^\/+/, ""), assetBaseUrl).href;
    }

    if (typeof window !== "undefined") {
      return new URL(path.replace(/^\/+/, ""), window.location.href).href;
    }

    return path;
  }

  function formatRank(value) {
    const rank = Number(value);
    return Number.isFinite(rank) && rank > 0 ? String(rank) : "--";
  }

  function formatPpg(value) {
    const ppg = Number(value);
    return Number.isFinite(ppg) ? ppg.toFixed(2) : "0.00";
  }

  function formatWholeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : "0";
  }

  function resolveFlagCode(player) {
    const directCode = normalizeText(player?.flag_code || player?.flagCode, "").toUpperCase();

    if (/^[A-Z]{2}$/.test(directCode)) {
      return directCode;
    }

    const globalCode = window.MandarinasLogic?.nationalityCode?.(
      player?.nationality || player?.country || ""
    );
    const normalizedGlobalCode = normalizeText(globalCode, "").toUpperCase();

    if (/^[A-Z]{2}$/.test(normalizedGlobalCode)) {
      return normalizedGlobalCode;
    }

    const inferred = normalizeText(player?.nationality || player?.country, "").toUpperCase();
    return /^[A-Z]{2}$/.test(inferred) ? inferred : "";
  }

  function flagAssetPath(code) {
    const normalized = normalizeText(code, "").toLowerCase();
    return /^[a-z]{2}$/.test(normalized) ? assetUrl(`assets/flags/${normalized}.png`) : "";
  }

  function fallbackFlagCode(code, label) {
    const normalizedCode = normalizeText(code, "").toUpperCase();

    if (/^[A-Z]{2}$/.test(normalizedCode)) {
      return normalizedCode;
    }

    return normalizeText(label, "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 2)
      .toUpperCase();
  }

  function badgeFlagMarkup(code, label) {
    const normalizedCode = normalizeText(code, "").toUpperCase();
    const fallback = fallbackFlagCode(normalizedCode, label);

    if (!normalizedCode && !fallback) {
      return "";
    }

    const src = flagAssetPath(normalizedCode);

    return `
      <span class="flag-icon flag-icon--badge flag-icon--glossy${normalizedCode ? "" : " flag-icon--fallback"}" data-flag-code="${escapeHtml((normalizedCode || fallback).toLowerCase())}" aria-hidden="true" title="${escapeHtml(label || fallback)}">
        ${
          src
            ? `<img class="flag-icon-image" src="${escapeHtml(src)}" alt="" loading="eager" decoding="async" onerror="this.hidden=true; this.parentElement.classList.add('flag-icon--fallback');" />`
            : ""
        }
        <span class="flag-icon-fallback">${escapeHtml(fallback || "??")}</span>
      </span>
    `;
  }

  function positionList(player) {
    if (Array.isArray(player?.positions) && player.positions.length) {
      return player.positions
        .slice(0, 4)
        .map((value) => normalizeText(value, "").toUpperCase())
        .filter(Boolean);
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
      .map(
        (value) =>
          `<span class="badge-position-pill" title="${escapeHtml(value)}">${escapeHtml(value)}</span>`
      )
      .join("");
  }

  function trophyMarkup(value, idPrefix) {
    const safeId = normalizeText(idPrefix, `badge-trophy-${++badgeSerial}`).replace(/[^a-zA-Z0-9_-]/g, "");
    const cupGoldId = `${safeId}-cupGold`;
    const darkGoldId = `${safeId}-darkGold`;
    const cupGlowId = `${safeId}-cupGlow`;
    const goldShadowId = `${safeId}-goldShadow`;
    const trophyValue = formatWholeNumber(Math.max(0, normalizeNumber(value, 0)));

    return `
      <div class="trophy-wrap" aria-label="Seasons won">
        <svg class="elite-trophy" viewBox="0 0 180 180" role="img" aria-hidden="true">
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
            <path class="trophy-handle" d="M48 54H25c-5 0-8 4-8 9 0 25 14 43 39 48l4-15c-16-4-26-16-27-28h18z"></path>
            <path class="trophy-handle" d="M132 54h23c5 0 8 4 8 9 0 25-14 43-39 48l-4-15c16-4 26-16 27-28h-18z"></path>

            <path
              class="trophy-cup"
              d="M48 34h84c-2 47-15 78-42 78S50 81 48 34z"
              fill="url(#${cupGoldId})"
              stroke="#fff0a3"
              stroke-width="2"
            ></path>

            <path
              d="M58 43h64c-3 31-11 52-32 52S61 74 58 43z"
              fill="url(#${cupGlowId})"
              opacity=".55"
            ></path>

            <path d="M78 111h24v25H78z" fill="url(#${darkGoldId})" stroke="#eec24e" stroke-width="1.5"></path>
            <path d="M59 136h62l8 19H51z" fill="url(#${cupGoldId})" stroke="#eec24e" stroke-width="1.5"></path>
            <path d="M48 155h84v11H48z" fill="#2b1705" stroke="#b98b2b" stroke-width="1.5"></path>
          </g>

          <text class="trophy-number" x="90" y="78" text-anchor="middle" dominant-baseline="middle">${escapeHtml(trophyValue)}</text>
        </svg>
        <div class="trophy-label">Seasons Won</div>
      </div>
    `;
  }

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
      wins: `
        <path d="M6 4.35H14V7.45C14 10.05 12.2 12.2 10 12.2C7.8 12.2 6 10.05 6 7.45Z" />
        <path d="M6 5.45H4.85C4.16 5.45 3.6 6.01 3.6 6.7C3.6 8.17 4.78 9.35 6.25 9.35H6" />
        <path d="M14 5.45H15.15C15.84 5.45 16.4 6.01 16.4 6.7C16.4 8.17 15.22 9.35 13.75 9.35H14" />
        <path d="M10 12.2V15.2" />
        <path d="M7.75 17.1H12.25" />
      `,
      draws: `
        <path d="M4.4 7H15.6" />
        <path d="M4.4 12.85H15.6" />
      `,
      losses: `
        <path d="M6.2 6.2L13.8 13.8" />
        <path d="M13.8 6.2L6.2 13.8" />
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
    if (!icon) {
      return "";
    }

    return `
      <span class="badge-stat-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${icon}
        </svg>
      </span>
    `;
  }

  function normalizeBadgeCard(card) {
    const formattedValue =
      card && Object.prototype.hasOwnProperty.call(card, "formattedValue")
        ? normalizeText(card.formattedValue, "0")
        : typeof card?.value === "string"
          ? normalizeText(card.value, "0")
          : formatWholeNumber(card?.value);
    const normalizedKey = normalizeText(card?.key, "stat")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const normalizedValueKind = normalizeText(card?.valueKind, "numeric")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const valueClassName = [
      "badge-stat-value",
      "stat-value",
      `badge-stat-value--${normalizedKey || "stat"}`,
      `badge-stat-value--${normalizedValueKind || "numeric"}`,
      formattedValue.length >= 8 ? "badge-stat-value--long" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const cardClassName = [
      "badge-stat-card",
      "stat-card",
      `badge-stat-card--${normalizedKey || "stat"}`,
      `badge-stat-card--${normalizedValueKind || "numeric"}`,
    ]
      .filter(Boolean)
      .join(" ");

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

  function isZeroLikeBadgeValue(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value === 0;
    }

    const normalized = normalizeText(value, "");
    if (!normalized) {
      return true;
    }

    const parsed = Number(normalized.replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed === 0;
  }

  function shouldRenderBadgeCard(card) {
    const key = normalizeText(card?.key, "stat")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (key === "season" || key === "record") {
      return true;
    }

    if (Object.prototype.hasOwnProperty.call(card || {}, "value")) {
      return !isZeroLikeBadgeValue(card.value);
    }

    return !isZeroLikeBadgeValue(card?.formattedValue);
  }

  function buildBadgeStatCards(stats, options) {
    const source = stats && typeof stats === "object" ? stats : {};
    const summaryCards = Array.isArray(options?.summaryCards)
      ? options.summaryCards.filter(Boolean).filter(shouldRenderBadgeCard).map(normalizeBadgeCard)
      : [];

    if (summaryCards.length) {
      return [
        ...summaryCards,
        normalizeBadgeCard({
          key: "points",
          label: "Points",
          icon: "points",
          value: source.points ?? source.total_points ?? 0,
        }),
        normalizeBadgeCard({
          key: "goals",
          label: "Goals",
          icon: "goals",
          value: source.goals ?? 0,
        }),
        normalizeBadgeCard({
          key: "goal-keeps",
          label: "Goal Keeps",
          icon: "goal_keeps",
          value: source.goal_keeps ?? source.goalKeeps ?? source.goal_keep_points_earned ?? 0,
        }),
        normalizeBadgeCard({
          key: "clean-sheets",
          label: "Clean Sheets",
          icon: "clean_sheets",
          value: source.clean_sheets ?? source.cleanSheets ?? 0,
        }),
      ].filter((card) => shouldRenderBadgeCard(card));
    }

    const hasFullStandings =
      source.wins != null || source.draws != null || source.losses != null || source.points != null;
    const cards = hasFullStandings
      ? [
          { key: "points", label: "Points", icon: "points", value: source.points ?? source.total_points ?? 0 },
          { key: "apps", label: "Apps", icon: "apps", value: source.apps ?? source.attendance ?? source.days_attended ?? 0 },
          { key: "goals", label: "Goals", icon: "goals", value: source.goals ?? 0 },
          { key: "wins", label: "Wins", icon: "wins", value: source.wins ?? 0 },
          { key: "draws", label: "Draws", icon: "draws", value: source.draws ?? 0 },
          { key: "losses", label: "Losses", icon: "losses", value: source.losses ?? 0 },
          {
            key: "goal-keeps",
            label: "Goal Keeps",
            icon: "goal_keeps",
            value: source.goal_keeps ?? source.goalKeeps ?? source.goal_keep_points_earned ?? 0,
          },
          {
            key: "clean-sheets",
            label: "Clean Sheets",
            icon: "clean_sheets",
            value: source.clean_sheets ?? source.cleanSheets ?? 0,
          },
        ]
      : [
          { key: "apps", label: "Apps", icon: "apps", value: source.apps ?? source.attendance ?? source.days_attended ?? 0 },
          { key: "goals", label: "Goals", icon: "goals", value: source.goals ?? 0 },
          {
            key: "goal-keeps",
            label: "Goal Keeps",
            icon: "goal_keeps",
            value: source.goal_keeps ?? source.goalKeeps ?? source.goal_keep_points_earned ?? 0,
          },
          {
            key: "clean-sheets",
            label: "Clean Sheets",
            icon: "clean_sheets",
            value: source.clean_sheets ?? source.cleanSheets ?? 0,
          },
        ];

    return cards.filter(shouldRenderBadgeCard).map(normalizeBadgeCard);
  }

  function fitTextBlock(node, minimumSize) {
    if (!node || typeof window === "undefined" || !node.isConnected) {
      return;
    }

    node.style.removeProperty("font-size");

    const availableWidth = node.clientWidth;
    if (!availableWidth) {
      return;
    }

    let fontSize = Number.parseFloat(window.getComputedStyle(node).fontSize);
    if (!Number.isFinite(fontSize)) {
      return;
    }

    while (
      (node.scrollWidth > availableWidth + 1 || node.scrollHeight > node.clientHeight + 1) &&
      fontSize > minimumSize
    ) {
      fontSize -= 1;
      node.style.fontSize = `${fontSize}px`;
    }
  }

  function fitBadgeTypography(badge) {
    if (!badge || !badge.isConnected) {
      return;
    }

    fitTextBlock(badge.querySelector(".badge-ball-name"), 10);
    badge.querySelectorAll(".badge-stat-value").forEach((node) => {
      let minimumSize = 20;

      if (node.classList.contains("badge-stat-value--record")) {
        minimumSize = 15;
      } else if (node.classList.contains("badge-stat-value--text")) {
        minimumSize = 10;
      } else if (node.classList.contains("badge-stat-value--compact")) {
        minimumSize = 16;
      }

      fitTextBlock(node, minimumSize);
    });
  }

  function scheduleBadgeFit(badge) {
    if (!badge || badge.dataset.badgeFitScheduled === "true") {
      return;
    }

    badge.dataset.badgeFitScheduled = "true";
    nextFrame(() => {
      delete badge.dataset.badgeFitScheduled;
      fitBadgeTypography(badge);
    });
  }

  function scheduleAllBadgeFits(root) {
    if (typeof document === "undefined") {
      return;
    }

    const scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(".game-player-badge")) {
      scheduleBadgeFit(scope);
    }

    scope.querySelectorAll(".game-player-badge").forEach((badge) => {
      scheduleBadgeFit(badge);
    });
  }

  function observeBadgeMounts() {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      window.__mcPlayerBadgeObserverReady
    ) {
      return;
    }

    window.__mcPlayerBadgeObserverReady = true;

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          scheduleAllBadgeFits();
        },
        { once: true }
      );
    } else {
      scheduleAllBadgeFits();
    }

    if (typeof MutationObserver === "function") {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              scheduleAllBadgeFits(node);
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    if (document.fonts?.ready?.then) {
      document.fonts.ready.then(() => {
        scheduleAllBadgeFits();
      });
    }

    window.addEventListener("resize", () => {
      scheduleAllBadgeFits();
    });
  }

  function createBadgeMarkup(model) {
    const crestUrl = escapeHtml(assetUrl("assets/images/brand/mandarinas-crest-clean.png"));
    const ballArtUrl = escapeHtml(assetUrl(BALL_ART_PATH));
    const positionCount = Math.min(Math.max(positionList(model.player).length, 1), 4);
    const statCardsMarkup = model.statCards
      .map(
        (card) => `
          <div class="${escapeHtml(card.cardClassName)}" data-stat-key="${escapeHtml(card.key)}" data-value-kind="${escapeHtml(card.valueKind)}">
            ${statIconMarkup(card.icon)}
            <span class="badge-stat-label">${escapeHtml(card.label)}</span>
            <strong class="${escapeHtml(card.valueClassName)}" title="${escapeHtml(card.value)}">${escapeHtml(card.value)}</strong>
          </div>
        `
      )
      .join("");

    const flagMarkup = model.flagCode || model.flagTitle
      ? `
          <div class="ball-flag player-flag">
            ${badgeFlagMarkup(model.flagCode, model.flagTitle)}
          </div>
        `
      : "";

    return `
      <div class="game-player-badge player-card" data-stat-count="${model.statCards.length}">
        <div class="premium-badge-wordmark">
          <div class="premium-badge-kicker">Mandarinas CF</div>
          <div class="premium-badge-subkicker">California Club de Futbol</div>
        </div>

        <div class="premium-badge-header">
          <div class="badge-side-panel badge-side-panel-left">
            <span class="badge-side-label">OVR</span>
            <strong>${escapeHtml(model.overall)}</strong>
            <small>Overall</small>
          </div>

          <div class="badge-crest-shell">
            <img class="badge-crest" src="${crestUrl}" alt="Mandarinas CF crest" loading="eager" />
          </div>

          <div class="badge-side-panel badge-side-panel-right">
            <span class="badge-side-label">Rank</span>
            <strong>${escapeHtml(model.rank)}</strong>
            <small>${escapeHtml(model.ppg)} PPG</small>
          </div>
        </div>

        ${model.showTrophy ? trophyMarkup(model.seasonsWon, model.trophyId) : ""}

        <div class="badge-ball-stage">
          <div class="badge-ball-crop">
            <img
              class="badge-ball-image"
              src="${ballArtUrl}"
              alt=""
              loading="eager"
            />
            <div class="badge-ball-overlay badge-ball-overlay--${positionCount}">
              ${flagMarkup}
              <div class="ball-positions ball-positions--${positionCount}" data-count="${positionCount}" title="${escapeHtml(model.positionTitle)}">
                ${positionPillsMarkup(model.player)}
              </div>
              <div class="badge-ball-name player-name" title="${escapeHtml(model.name)}">${escapeHtml(model.name)}</div>
            </div>
          </div>
        </div>

        <div class="premium-badge-stats stats-grid" data-count="${model.statCards.length}">
          ${statCardsMarkup}
        </div>
      </div>
    `;
  }

  function renderPlayerBadge(player, stats, options) {
    const data = {
      player,
      overall: formatWholeNumber(
        player?.overall_rating ?? player?.overall ?? player?.skill_rating ?? 0
      ),
      rank: formatRank(player?.rank ?? stats?.rank),
      ppg: formatPpg(stats?.ppg ?? stats?.points_per_game),
      flagCode: resolveFlagCode(player),
      flagTitle: normalizeText(player?.nationality || player?.country, ""),
      name: normalizeText(player?.name, "N/A"),
      positionTitle: formatPosition(player),
      seasonsWon: stats?.seasons_won ?? player?.seasons_won ?? 0,
      showTrophy:
        Boolean(options?.showTrophy) &&
        normalizeNumber(stats?.seasons_won ?? player?.seasons_won, 0) > 0,
      trophyId: `mc-badge-trophy-${++badgeSerial}`,
      statCards: buildBadgeStatCards(stats, options),
    };

    const host = document.createElement("div");
    host.innerHTML = createBadgeMarkup(data).trim();
    const badge = host.firstElementChild;
    const nameNode = badge?.querySelector(".badge-ball-name");

    if (nameNode) {
      if (data.name.length > 26) {
        nameNode.style.setProperty("--badge-ball-name-size", "clamp(0.68rem, 2vw, 0.86rem)");
      } else if (data.name.length > 20) {
        nameNode.style.setProperty("--badge-ball-name-size", "clamp(0.76rem, 2.2vw, 0.94rem)");
      } else if (data.name.length > 18) {
        nameNode.style.setProperty("--badge-ball-name-size", "clamp(0.82rem, 2.3vw, 0.98rem)");
      } else if (data.name.length > 14) {
        nameNode.style.setProperty("--badge-ball-name-size", "clamp(0.9rem, 2.45vw, 1.04rem)");
      }
    }

    scheduleBadgeFit(badge);
    return badge;
  }

  function mountPlayerBadge(target, player, stats, options) {
    if (!target) {
      return null;
    }

    const badge = renderPlayerBadge(player, stats, options);
    target.replaceChildren(badge);
    scheduleBadgeFit(badge);
    return badge;
  }

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
      seasons_won: 8,
    },
  };
})();
