(function () {
  const badgeBackgroundUrl = document.currentScript?.src
    ? new URL("../../images/player-badge/player-badge-template-blank-v2-cropped.png", document.currentScript.src).href
    : "./assets/images/player-badge/player-badge-template-blank-v2-cropped.png";

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

  function formatBirthYear(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return "";
    }

    let fullYear = "";

    if (/^\d{4}$/.test(text)) {
      fullYear = text;
    } else {
      const date = new Date(text);
      if (Number.isNaN(date.getTime())) {
        return "";
      }

      fullYear = String(date.getFullYear());
    }

    if (!/^\d{4}$/.test(fullYear)) {
      return "";
    }

    return `'${fullYear.slice(-2)}`;
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

    return normalizeText(player?.position_label || player?.primary_position, "N/A");
  }

  function formatMeta(player) {
    const birthYear = formatBirthYear(player?.birth_year ?? player?.birthYear ?? player?.birth_date);
    return birthYear || "N/A";
  }

  function createBadgeMarkup() {
    return `
      <div class="badge-stage">
        <div class="player-badge-shell">
          <img class="player-badge-bg" src="${badgeBackgroundUrl}" alt="" />

          <div class="badge-bottom-mask"></div>

          <div class="badge-ball-readable-overlay"></div>

          <div class="badge-overlay badge-meta" data-field="meta">N/A</div>

          <div class="badge-overlay badge-name" data-field="name">Player</div>

          <div class="badge-overlay badge-positions" data-field="position">N/A</div>

          <div class="badge-overlay badge-ovr">
            <span>OVR</span>
            <strong data-field="overall">0</strong>
            <small>OVERALL</small>
          </div>

          <div class="badge-overlay badge-rank">
            <span>RANK</span>
            <strong data-field="rank">--</strong>
            <small data-field="ppg">0.00 PPG</small>
          </div>

          <div class="badge-overlay badge-points">
            <span class="badge-flag" data-field="flag">—</span>
          </div>

          <div class="badge-overlay badge-apps">
            <strong data-field="apps">0</strong>
          </div>

          <div class="badge-overlay badge-goals">
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
      flag: normalizeText(player?.flag, "—"),
      meta: formatMeta(player),
      name: normalizeText(player?.name, "N/A"),
      position: formatPosition(player),
      apps: normalizeNumber(stats?.apps ?? stats?.attendance ?? stats?.days_attended, 0),
      goals: normalizeNumber(stats?.goals, 0),
    };

    Object.entries(data).forEach(([field, value]) => {
      badge.querySelectorAll(`[data-field="${field}"]`).forEach((node) => {
        node.textContent = String(value);
      });
    });

    const nameNode = badge.querySelector(".badge-name");
    const metaNode = badge.querySelector(".badge-meta");
    const positionNode = badge.querySelector(".badge-positions");
    nameNode?.setAttribute("title", data.name);
    metaNode?.setAttribute("title", data.meta);
    positionNode?.setAttribute("title", data.position);

    if (nameNode) {
      if (data.name.length > 14) {
        nameNode.style.setProperty("--badge-name-size", "clamp(20px, 5.4vw, 32px)");
        nameNode.style.setProperty("--badge-name-width", "62%");
      } else if (data.name.length > 10) {
        nameNode.style.setProperty("--badge-name-size", "clamp(22px, 6.1vw, 36px)");
        nameNode.style.setProperty("--badge-name-width", "59%");
      }
    }

    if (metaNode && data.meta.length > 24) {
      metaNode.style.setProperty("--badge-meta-size", "clamp(15px, 3.8vw, 22px)");
      metaNode.style.setProperty("--badge-meta-width", "62%");
    }

    if (positionNode && data.position.length > 18) {
      positionNode.style.setProperty("--badge-position-size", "clamp(10px, 2.5vw, 14px)");
      positionNode.style.setProperty("--badge-position-width", "60%");
    }

    return badge;
  }

  function mountPlayerBadge(target, player, stats) {
    if (!target) {
      return null;
    }

    const badge = renderPlayerBadge(player, stats);
    target.replaceChildren(badge);
    return badge;
  }

  window.renderPlayerBadge = renderPlayerBadge;
  window.mountPlayerBadge = mountPlayerBadge;
  window.createPlayerBadgeMarkup = createBadgeMarkup;
  window.mcPlayerBadgeExample = {
    player: {
      name: "Mateo Alvarez",
      nationality: "Argentina",
      flag: "🇦🇷",
      age: 29,
      dominant_foot: "Right",
      overall_rating: 82,
      rank: 14,
      ppg: 1.75,
      primary_position: "AM",
      position_label: "DEF · MID · ATT",
      tier: "Core",
    },
    stats: {
      points: 21,
      apps: 12,
      goals: 8,
    },
  };
})();
