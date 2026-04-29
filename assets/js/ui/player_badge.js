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

  function formatPpg(value) {
    const numeric = normalizeNumber(value, 0);
    return `${numeric.toFixed(2)} PPG`;
  }

  function formatRank(value) {
    const rank = Number(value);
    return Number.isFinite(rank) && rank > 0 ? String(rank) : "--";
  }

  function formatTier(value) {
    const tier = normalizeText(value, "N/A").toLowerCase();
    if (tier === "flex_sub") {
      return "Flex/Sub";
    }
    if (tier === "core" || tier === "rotation") {
      return tier.charAt(0).toUpperCase() + tier.slice(1);
    }
    return tier === "n/a" ? "N/A" : normalizeText(value, "N/A");
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

  function calculateAgeFromBirthDate(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return null;
    }

    const birthDate = new Date(text);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  }

  function formatFootShort(value) {
    const normalized = normalizeText(value, "").toLowerCase();
    if (normalized === "right" || normalized === "rf") {
      return "RF";
    }
    if (normalized === "left" || normalized === "lf") {
      return "LF";
    }
    if (normalized === "both" || normalized === "bf") {
      return "BF";
    }
    return "";
  }

  function formatMeta(player) {
    const segments = [];
    const nationality = normalizeText(player?.nationality, "");
    const flag = normalizeText(player?.flag, "");
    const age = calculateAgeFromBirthDate(player?.birth_date ?? player?.birthDate);
    const foot = formatFootShort(player?.dominant_foot ?? player?.dominantFoot);

    if (nationality) {
      segments.push(flag ? `${flag} ${nationality}` : nationality);
    }
    if (age != null) {
      segments.push(`${age} yrs`);
    }
    if (foot) {
      segments.push(foot);
    }

    return segments.length ? segments.join(" · ") : "N/A";
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

          <div class="badge-overlay badge-tier" data-field="tier">N/A</div>

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
            <strong data-field="points">0</strong>
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
      meta: formatMeta(player),
      name: normalizeText(player?.name, "N/A"),
      position: formatPosition(player),
      tier: formatTier(player?.tier ?? player?.status),
      points: normalizeNumber(stats?.points ?? stats?.total_points, 0),
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
      if (data.name.length > 16) {
        nameNode.style.setProperty("--badge-name-size", "clamp(20px, 5vw, 30px)");
      } else if (data.name.length > 12) {
        nameNode.style.setProperty("--badge-name-size", "clamp(22px, 5.5vw, 33px)");
      }
    }

    if (metaNode && data.meta.length > 24) {
      metaNode.style.setProperty("--badge-meta-size", "clamp(8px, 1.8vw, 11px)");
      metaNode.style.setProperty("--badge-meta-width", "66%");
    }

    if (positionNode && data.position.length > 18) {
      positionNode.style.setProperty("--badge-position-size", "clamp(10px, 2.4vw, 13px)");
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
      birth_date: "1996-05-18",
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
