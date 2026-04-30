(function () {
  const BALL_ART_PATH = "assets/images/player-badge/reference-ball-full.png";
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

  function formatFlag(player) {
    return normalizeText(player?.flag, "");
  }

  function positionList(player) {
    if (Array.isArray(player?.positions) && player.positions.length) {
      return player.positions
        .slice(0, 3)
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

  function statIconMarkup(kind) {
    const icons = {
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

  function buildBadgeStatCards(stats) {
    const source = stats && typeof stats === "object" ? stats : {};
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

    return cards.map((card) => ({
      ...card,
      value: formatWholeNumber(card.value),
    }));
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

    fitTextBlock(badge.querySelector(".badge-footer-name"), 12);
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
    const statCardsMarkup = model.statCards
      .map(
        (card) => `
          <div class="badge-stat-card" data-stat-key="${escapeHtml(card.key)}">
            ${statIconMarkup(card.icon)}
            <span class="badge-stat-label">${escapeHtml(card.label)}</span>
            <strong class="badge-stat-value">${escapeHtml(card.value)}</strong>
          </div>
        `
      )
      .join("");

    const flagMarkup = model.flag
      ? `<div class="ball-flag" title="${escapeHtml(model.flagTitle)}">${escapeHtml(model.flag)}</div>`
      : "";

    return `
      <div class="game-player-badge">
        <div class="premium-badge-noise" aria-hidden="true"></div>
        <div class="premium-badge-inner-frame" aria-hidden="true"></div>

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

        <div class="badge-ball-stage">
          <div class="badge-ball-halo" aria-hidden="true"></div>
          <div class="badge-ball-crop">
            <img
              class="badge-ball-image"
              src="${ballArtUrl}"
              alt=""
              loading="eager"
            />
          </div>
        </div>

        <div class="premium-badge-identity">
          ${flagMarkup}
          <div class="ball-positions" title="${escapeHtml(model.positionTitle)}">
            ${positionPillsMarkup(model.player)}
          </div>
        </div>

        <div class="premium-badge-footer">
          <img class="premium-badge-footer-crest" src="${crestUrl}" alt="" loading="eager" />
          <span class="badge-footer-name" title="${escapeHtml(model.name)}">${escapeHtml(model.name)}</span>
        </div>

        <div class="premium-badge-stats" data-count="${model.statCards.length}">
          ${statCardsMarkup}
        </div>
      </div>
    `;
  }

  function renderPlayerBadge(player, stats) {
    const data = {
      player,
      overall: formatWholeNumber(
        player?.overall_rating ?? player?.overall ?? player?.skill_rating ?? 0
      ),
      rank: formatRank(player?.rank ?? stats?.rank),
      ppg: formatPpg(stats?.ppg ?? stats?.points_per_game),
      flag: formatFlag(player),
      flagTitle: normalizeText(player?.nationality || player?.country, ""),
      name: normalizeText(player?.name, "N/A"),
      positionTitle: formatPosition(player),
      statCards: buildBadgeStatCards(stats),
    };

    const host = document.createElement("div");
    host.innerHTML = createBadgeMarkup(data).trim();
    const badge = host.firstElementChild;
    const nameNode = badge?.querySelector(".badge-footer-name");

    if (nameNode) {
      if (data.name.length > 24) {
        nameNode.style.setProperty("--badge-footer-name-size", "clamp(0.72rem, 2.2vw, 0.92rem)");
      } else if (data.name.length > 18) {
        nameNode.style.setProperty("--badge-footer-name-size", "clamp(0.8rem, 2.35vw, 0.98rem)");
      } else if (data.name.length > 14) {
        nameNode.style.setProperty("--badge-footer-name-size", "clamp(0.88rem, 2.55vw, 1.08rem)");
      }
    }

    scheduleBadgeFit(badge);
    return badge;
  }

  function mountPlayerBadge(target, player, stats) {
    if (!target) {
      return null;
    }

    const badge = renderPlayerBadge(player, stats);
    target.replaceChildren(badge);
    scheduleBadgeFit(badge);
    return badge;
  }

  observeBadgeMounts();
  window.renderPlayerBadge = renderPlayerBadge;
  window.mountPlayerBadge = mountPlayerBadge;
  window.createPlayerBadgeMarkup = createBadgeMarkup;
  window.mcPlayerBadgeExample = {
    player: {
      name: "Alex Meneses",
      nationality: "Peru",
      flag: "🇵🇪",
      overall_rating: 73,
      rank: "291",
      primary_position: "AM",
      position_label: "AM · CM · RW",
      positions: ["AM", "CM", "RW"],
    },
    stats: {
      points: 0,
      apps: 0,
      goals: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goal_keeps: 0,
      clean_sheets: 0,
      points_per_game: 0,
    },
  };
})();
