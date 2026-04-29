(function () {
  function nextFrame(callback) {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      callback();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback);
    });
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

  function formatBirthYearShort(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return "";
    }

    let fullYear = "";
    if (/^\d{4}$/.test(text)) {
      fullYear = text;
    } else {
      const birthDate = new Date(text);
      if (Number.isNaN(birthDate.getTime())) {
        return "";
      }
      fullYear = String(birthDate.getFullYear());
    }

    return /^\d{4}$/.test(fullYear) ? `\u2019${fullYear.slice(-2)}` : "";
  }

  function formatPpg(value) {
    const numeric = normalizeNumber(value, 0);
    return `${numeric.toFixed(2)} PPG`;
  }

  function formatRank(value) {
    const rank = Number(value);
    return Number.isFinite(rank) && rank > 0 ? String(rank) : "--";
  }

  function formatPosition(player) {
    if (Array.isArray(player?.positions) && player.positions.length) {
      return player.positions
        .slice(0, 3)
        .map((value) => normalizeText(value, "").toUpperCase())
        .filter(Boolean)
        .join(" · ");
    }

    return normalizeText(player?.position_label || player?.primary_position, "N/A").toUpperCase();
  }

  function formatCountryYear(player) {
    const country = normalizeText(player?.nationality || player?.country, "");
    const birthYear = formatBirthYearShort(
      player?.birth_year ?? player?.birthYear ?? player?.birth_date ?? player?.birthDate
    );

    if (country && birthYear) {
      return `${country} \u00b7 ${birthYear}`;
    }
    if (country) {
      return country;
    }
    if (birthYear) {
      return birthYear;
    }
    return "N/A";
  }

  function formatFlag(player) {
    return normalizeText(player?.flag, "");
  }

  function fitSingleLineText(node, minimumSize) {
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

    while (node.scrollWidth > availableWidth + 1 && fontSize > minimumSize) {
      fontSize -= 1;
      node.style.fontSize = `${fontSize}px`;
    }
  }

  function fitBadgeTypography(badge) {
    if (!badge || !badge.isConnected) {
      return;
    }

    const nameNode = badge.querySelector(".ball-name");
    fitSingleLineText(nameNode, 14);
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
      document.addEventListener("DOMContentLoaded", () => {
        scheduleAllBadgeFits();
      }, { once: true });
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

  function createBadgeMarkup() {
    return `
      <div class="game-player-badge">
        <div class="badge-header">
          <div class="badge-title">MANDARINAS</div>
          <div class="badge-subtitle">CALIFORNIA CLUB DE FUTBOL</div>
        </div>

        <div class="badge-side badge-ovr">
          <span>OVR</span>
          <strong data-field="overall">0</strong>
          <small>OVERALL</small>
        </div>

        <div class="badge-side badge-rank">
          <span>RANK</span>
          <strong data-field="rank">--</strong>
          <small data-field="ppg">0.00 PPG</small>
        </div>

        <div class="gold-ball">
          <div class="ball-flag" data-field="flag"></div>
          <div class="ball-name" data-field="name">Player</div>
          <div class="ball-meta" data-field="meta">N/A</div>
          <div class="ball-positions" data-field="position">N/A</div>
        </div>

        <div class="badge-stats">
          <div>
            <span>POINTS</span>
            <strong data-field="points">0</strong>
          </div>
          <div>
            <span>APPS</span>
            <strong data-field="apps">0</strong>
          </div>
          <div>
            <span>GOALS</span>
            <strong data-field="goals">0</strong>
          </div>
        </div>
      </div>
    `;
  }

  function renderPlayerBadge(player, stats) {
    const host = document.createElement("div");
    host.innerHTML = createBadgeMarkup().trim();
    const badge = host.firstElementChild;
    const data = {
      overall: normalizeNumber(player?.overall_rating, normalizeNumber(player?.overall, normalizeNumber(player?.skill_rating, 0))) || 0,
      rank: formatRank(player?.rank ?? stats?.rank),
      ppg: formatPpg(player?.ppg ?? stats?.ppg ?? stats?.points_per_game),
      flag: formatFlag(player),
      meta: formatCountryYear(player),
      name: normalizeText(player?.name, "N/A"),
      position: formatPosition(player),
      points: normalizeNumber(stats?.points ?? stats?.total_points, 0),
      apps: normalizeNumber(stats?.apps ?? stats?.attendance ?? stats?.days_attended, 0),
      goals: normalizeNumber(stats?.goals, 0),
    };

    Object.entries(data).forEach(([field, value]) => {
      badge.querySelectorAll(`[data-field="${field}"]`).forEach((node) => {
        node.textContent = String(value);
      });
    });

    const flagNode = badge.querySelector(".ball-flag");
    const nameNode = badge.querySelector(".ball-name");
    const metaNode = badge.querySelector(".ball-meta");
    const positionNode = badge.querySelector(".ball-positions");
    flagNode?.setAttribute("title", data.flag || "");
    nameNode?.setAttribute("title", data.name);
    metaNode?.setAttribute("title", data.meta);
    positionNode?.setAttribute("title", data.position);

    if (nameNode) {
      if (data.name.length > 22) {
        nameNode.style.setProperty("--badge-name-size", "clamp(16px, 3.8vw, 22px)");
      } else if (data.name.length > 18) {
        nameNode.style.setProperty("--badge-name-size", "clamp(18px, 4.2vw, 24px)");
      } else if (data.name.length > 14) {
        nameNode.style.setProperty("--badge-name-size", "clamp(20px, 4.6vw, 28px)");
      }
    }

    if (metaNode && data.meta.length > 16) {
      metaNode.style.setProperty("--badge-meta-size", "clamp(10px, 2.1vw, 14px)");
    }

    if (positionNode && data.position.length > 12) {
      positionNode.style.setProperty("--badge-position-size", "clamp(11px, 2.8vw, 15px)");
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
      name: "Asdruval Villanueva",
      nationality: "Mexico",
      flag: "🇲🇽",
      birth_date: "1985-06-14",
      overall_rating: 80,
      rank: "--",
      ppg: 0,
      primary_position: "DEF",
      position_label: "DEF · ATT · GK",
      positions: ["DEF", "ATT", "GK"],
    },
    stats: {
      points: 0,
      apps: 0,
      goals: 0,
    },
  };
})();
