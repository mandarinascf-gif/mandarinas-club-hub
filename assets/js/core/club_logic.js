(function () {
  "use strict";

  const scriptUrl =
    typeof document !== "undefined" && document.currentScript?.src
      ? new URL(document.currentScript.src, window.location.href)
      : null;
  const assetBaseUrl = scriptUrl ? new URL("../../../", scriptUrl) : null;

  const STATUS_LABELS = {
    core: "Core",
    flex: "Flex",
    sub: "Sub",
  };

  const TREND_LABELS = {
    up: "Trending up",
    steady: "Holding",
    down: "Watch list",
  };

  const NATIONALITY_CODE_MAP = {
    argentina: "AR",
    argentine: "AR",
    australian: "AU",
    australia: "AU",
    belgian: "BE",
    belgium: "BE",
    bolivia: "BO",
    bolivian: "BO",
    brazil: "BR",
    brazilian: "BR",
    canadian: "CA",
    canada: "CA",
    chile: "CL",
    chilean: "CL",
    china: "CN",
    chinese: "CN",
    colombia: "CO",
    colombian: "CO",
    "costa rica": "CR",
    costarica: "CR",
    "costa rican": "CR",
    croatia: "HR",
    croatian: "HR",
    cuba: "CU",
    cuban: "CU",
    "dominican republic": "DO",
    dominican: "DO",
    ecuador: "EC",
    ecuadorian: "EC",
    elsalvador: "SV",
    "el salvador": "SV",
    salvadoran: "SV",
    england: "GB",
    english: "GB",
    france: "FR",
    french: "FR",
    germany: "DE",
    german: "DE",
    ghana: "GH",
    ghanaian: "GH",
    guatemala: "GT",
    guatemalan: "GT",
    honduran: "HN",
    honduras: "HN",
    india: "IN",
    indian: "IN",
    ireland: "IE",
    irish: "IE",
    italy: "IT",
    italian: "IT",
    japan: "JP",
    japanese: "JP",
    korea: "KR",
    "south korea": "KR",
    korean: "KR",
    mexico: "MX",
    mexican: "MX",
    morocco: "MA",
    moroccan: "MA",
    netherlands: "NL",
    dutch: "NL",
    nicaragua: "NI",
    nicaraguan: "NI",
    paraguay: "PY",
    paraguayan: "PY",
    peru: "PE",
    peruvian: "PE",
    portugal: "PT",
    portuguese: "PT",
    senegal: "SN",
    senegalese: "SN",
    spain: "ES",
    spanish: "ES",
    "united states": "US",
    usa: "US",
    us: "US",
    american: "US",
    uruguay: "UY",
    uruguayan: "UY",
    venezuela: "VE",
    venezuelan: "VE",
  };
  const FLAG_ASSET_ROOT = "assets/flags";

  const DEFAULT_SCORING_SETTINGS = Object.freeze({
    attendance_points: 2,
    win_points: 2,
    draw_points: 1,
    loss_points: 0,
    goal_keep_points: 1,
    team_goal_points: 1,
  });

  const TEAM_ORDER = Object.freeze(["magenta", "blue", "green", "orange"]);
  const SEASON_NAME_ORDER = Object.freeze([
    "winter",
    "spring",
    "summer",
    "solstice",
    "fall",
    "holiday",
  ]);
  const TIER_SUGGESTION_SLOT_LIMIT = 36;
  const TIER_SUGGESTION_UNIT_LIMIT = TIER_SUGGESTION_SLOT_LIMIT * 2;
  const TIER_SUGGESTION_PRIORITY = Object.freeze({
    core: 0,
    flex: 1,
    sub: 2,
  });
  const TIER_SUGGESTION_UNITS = Object.freeze({
    core: 2,
    flex: 1,
    sub: 0,
  });
  const DEFAULT_TEAM_DISPLAY_CONFIG = Object.freeze({
    magenta: Object.freeze({ label: "Magenta", color: "#ff00ff" }),
    blue: Object.freeze({ label: "Blue", color: "#00bfff" }),
    green: Object.freeze({ label: "Green", color: "#00ff00" }),
    orange: Object.freeze({ label: "Orange", color: "#ffa500" }),
  });
  const TEAM_BALANCE_POSITION_ORDER = Object.freeze(["GK", "DEF", "MID", "ATT"]);
  const TEAM_BALANCE_WEIGHTS = Object.freeze({
    size: 1000,
    strength: 1,
    age: 6,
    position: 14,
    teammate: 8,
  });

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function parseSeasonChronology(season) {
    const normalizedName = normalizeText(season?.name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const yearMatch = normalizedName.match(/\b(19|20)\d{2}\b/);
    const createdAt = season?.created_at ? new Date(season.created_at).getTime() : 0;
    const createdYear = Number.isFinite(createdAt) && createdAt > 0 ? new Date(createdAt).getFullYear() : null;
    const year = yearMatch ? Number(yearMatch[0]) : createdYear;
    const seasonIndex = SEASON_NAME_ORDER.findIndex((token) => normalizedName.includes(token));

    return {
      year: Number.isFinite(year) ? year : null,
      seasonIndex: seasonIndex >= 0 ? seasonIndex : 99,
      createdAt,
      normalizedName,
    };
  }

  function compareSeasonsChronologically(left, right) {
    const leftMeta = parseSeasonChronology(left);
    const rightMeta = parseSeasonChronology(right);

    if (leftMeta.year !== null && rightMeta.year !== null && leftMeta.year !== rightMeta.year) {
      return leftMeta.year - rightMeta.year;
    }

    if (leftMeta.seasonIndex !== rightMeta.seasonIndex) {
      return leftMeta.seasonIndex - rightMeta.seasonIndex;
    }

    if (leftMeta.createdAt !== rightMeta.createdAt) {
      return leftMeta.createdAt - rightMeta.createdAt;
    }

    return leftMeta.normalizedName.localeCompare(rightMeta.normalizedName);
  }

  function sortSeasonsChronologically(seasons) {
    return [...(seasons || [])].sort(compareSeasonsChronologically);
  }

  function normalizeCountryKey(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .trim();
  }

  function countryCodeToFlag(code) {
    const normalized = normalizeText(code).toUpperCase();

    if (!/^[A-Z]{2}$/.test(normalized)) {
      return "";
    }

    return Array.from(normalized)
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join("");
  }

  function nationalityCode(value) {
    const normalized = normalizeText(value);

    if (!normalized || normalized.toLowerCase() === "unknown") {
      return "";
    }

    if (/^[A-Za-z]{2}$/.test(normalized)) {
      return normalized.toUpperCase();
    }

    const compact = normalizeCountryKey(normalized);

    return NATIONALITY_CODE_MAP[compact] || NATIONALITY_CODE_MAP[normalizeText(normalized).toLowerCase()] || "";
  }

  function nationalityFlag(value) {
    return countryCodeToFlag(nationalityCode(value));
  }

  function assetUrl(path) {
    if (!path) {
      return "";
    }

    const normalizedPath = String(path).replace(/^\/+/, "");

    if (assetBaseUrl) {
      return new URL(normalizedPath, assetBaseUrl).href;
    }

    if (typeof window !== "undefined") {
      return new URL(normalizedPath, window.location.href).href;
    }

    return normalizedPath;
  }

  function flagAssetPath(code) {
    const normalized = normalizeText(code).toLowerCase();

    if (!/^[a-z]{2}$/.test(normalized)) {
      return "";
    }

    return assetUrl(`${FLAG_ASSET_ROOT}/${normalized}.png`);
  }

  function flagFallbackCode(value) {
    const resolvedCode = nationalityCode(value);

    if (resolvedCode) {
      return resolvedCode;
    }

    const normalized = normalizeText(value)
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 2)
      .toUpperCase();

    return normalized || "";
  }

  function flagIconMarkup(value, options = {}) {
    const settings = options && typeof options === "object" ? options : {};
    const code = normalizeText(settings.code || nationalityCode(value)).toUpperCase();
    const fallback = normalizeText(settings.fallback || flagFallbackCode(value)).toUpperCase();
    const label = normalizeText(settings.label || value || code || fallback || "Unknown nationality");
    const variant = normalizeText(settings.variant || "table").toLowerCase() || "table";
    const extraClass = normalizeText(settings.className || "");

    if (!code && !fallback) {
      return "";
    }

    const classNames = ["flag-icon", `flag-icon--${variant}`];

    if (settings.glossy) {
      classNames.push("flag-icon--glossy");
    }

    if (!code) {
      classNames.push("flag-icon--fallback");
    }

    if (extraClass) {
      classNames.push(extraClass);
    }

    const src = flagAssetPath(code);
    const accessibility = settings.decorative
      ? `aria-hidden="true" title="${escapeHtml(label)}"`
      : `role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"`;

    return `
      <span class="${escapeHtml(classNames.join(" "))}" data-flag-code="${escapeHtml((code || fallback).toLowerCase())}" ${accessibility}>
        ${
          src
            ? `<img class="flag-icon-image" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true; this.parentElement.classList.add('flag-icon--fallback');" />`
            : ""
        }
        <span class="flag-icon-fallback">${escapeHtml(fallback || code || "??")}</span>
      </span>
    `;
  }

  function normalizeHexColor(value, fallback) {
    const raw = normalizeText(value || fallback).replace(/^#/, "");

    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
      return `#${raw
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
        .toLowerCase()}`;
    }

    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
      return `#${raw.toLowerCase()}`;
    }

    return fallback;
  }

  function rgbaFromHex(hex, alpha) {
    const normalized = normalizeHexColor(hex, "#ffffff").slice(1);
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function normalizeTeamDisplayConfig(rawConfig) {
    const source =
      rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig) ? rawConfig : {};
    const normalized = {};

    TEAM_ORDER.forEach((code) => {
      const fallback = DEFAULT_TEAM_DISPLAY_CONFIG[code];
      const input =
        source[code] && typeof source[code] === "object" && !Array.isArray(source[code])
          ? source[code]
          : {};

      normalized[code] = {
        label: normalizeText(input.label || fallback.label) || fallback.label,
        color: normalizeHexColor(input.color, fallback.color),
      };
    });

    return normalized;
  }

  function teamDisplayLabel(rawConfig, code) {
    const normalized = normalizeTeamDisplayConfig(rawConfig);
    return normalized[code]?.label || normalizeText(code);
  }

  function applyTeamDisplayConfig(rawConfig) {
    const normalized = normalizeTeamDisplayConfig(rawConfig);
    return normalized;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function fullName(player) {
    const first = normalizeText(player?.first_name || "");
    const last = normalizeText(player?.last_name || "");

    if (!last || ["player", "sub"].includes(last.toLowerCase())) {
      return stripSubPrefix(first);
    }

    return stripSubPrefix(normalizeText(`${first} ${last}`));
  }

  function stripSubPrefix(value) {
    return normalizeText(value).replace(/^\(sub\)\s*/i, "");
  }

  function comparableName(value) {
    return stripSubPrefix(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function playerDisplayName(player) {
    const nickname = stripSubPrefix(player.nickname);
    const full = fullName(player);

    if (nickname) {
      return nickname;
    }

    if (normalizeText(player.last_name).toLowerCase() === "player") {
      return normalizeText(player.first_name);
    }

    return full;
  }

  function playerNameParts(player) {
    const nickname = stripSubPrefix(player?.nickname || "");
    const full = fullName(player);
    const hasDistinctNickname =
      nickname && full && comparableName(nickname) !== comparableName(full);

    if (hasDistinctNickname) {
      return {
        primary: nickname,
        secondary: full,
      };
    }

    return {
      primary: full || nickname || "Player",
      secondary: "",
    };
  }

  function calculateAge(birthDateValue, today = new Date()) {
    if (!birthDateValue) {
      return null;
    }

    const birthDate = new Date(birthDateValue);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const birthdayPending =
      monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate());

    if (birthdayPending) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  }

  function formatStatusLabel(status) {
    const normalized = normalizeTierValue(status, "");
    if (STATUS_LABELS[normalized]) {
      return STATUS_LABELS[normalized];
    }

    const text = normalizeText(status);
    if (!text) {
      return "Unknown";
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatTrendLabel(trend) {
    return TREND_LABELS[trend] || "Holding";
  }

  function badgeIconMarkup(kind, options = {}) {
    const normalizedKind = normalizeText(kind).toLowerCase().replace(/\s+/g, "_");
    const className = normalizeText(options.className || "");
    const label = normalizeText(options.label || "");
    const decorative = options.decorative !== false;
    const iconMarkup = {
      winner: `
        <path d="M6 4.75H14V8.05C14 10.7 12.2 12.85 10 12.85C7.8 12.85 6 10.7 6 8.05V4.75Z" />
        <path d="M6 5.9H4.75C4.06 5.9 3.5 6.46 3.5 7.15C3.5 8.67 4.73 9.9 6.25 9.9H6" />
        <path d="M14 5.9H15.25C15.94 5.9 16.5 6.46 16.5 7.15C16.5 8.67 15.27 9.9 13.75 9.9H14" />
        <path d="M10 12.85V15.35" />
        <path d="M7.65 17.25H12.35" />
        <path d="M8.4 15.35H11.6" />
      `,
      core: `
        <path d="M10 2.8L15.65 4.95V9.15C15.65 12.95 13.02 15.62 10 17.2C6.98 15.62 4.35 12.95 4.35 9.15V4.95L10 2.8Z" />
        <path d="M12.45 7.1A3 3 0 1 0 12.45 12.9" />
      `,
      flex: `
        <path d="M14.5 6.35A5.15 5.15 0 0 0 5.35 6.85" />
        <path d="M14.45 3.95V6.7H11.7" />
        <path d="M5.5 13.65A5.15 5.15 0 0 0 14.65 13.15" />
        <path d="M5.55 16.05V13.3H8.3" />
      `,
      sub: `
        <path d="M10 4.2V15.8" />
        <path d="M4.2 10H15.8" />
      `,
      up: `
        <path d="M4.5 13.5L7.5 10.5L10.05 12.55L15.5 7.1" />
        <path d="M12.8 7.1H15.5V9.8" />
      `,
      down: `
        <path d="M4.5 6.5L7.5 9.5L10.05 7.45L15.5 12.9" />
        <path d="M12.8 12.9H15.5V10.2" />
      `,
      steady: `
        <path d="M10 4.1L11.25 8.75L15.9 10L11.25 11.25L10 15.9L8.75 11.25L4.1 10L8.75 8.75L10 4.1Z" />
      `,
      impact: `
        <path d="M10 3.4L11.5 8.5L16.6 10L11.5 11.5L10 16.6L8.5 11.5L3.4 10L8.5 8.5L10 3.4Z" />
      `,
      active: `
        <circle cx="10" cy="10" r="6.3" />
        <path d="M10 4.1L11.8 5.2L11.55 7.35L13.35 8.35L15.35 7.55L16.3 9.5L15 11.25L15.6 13.35L14.05 14.85L11.95 14.25L10 15.55L8.05 14.25L5.95 14.85L4.4 13.35L5 11.25L3.7 9.5L4.65 7.55L6.65 8.35L8.45 7.35L8.2 5.2L10 4.1Z" />
      `,
    }[normalizedKind];

    if (!iconMarkup) {
      return "";
    }

    const classes = ["badge-icon", className].filter(Boolean).join(" ");
    const accessibleAttrs = decorative
      ? 'aria-hidden="true"'
      : `role="img" aria-label="${escapeHtml(label || normalizedKind)}"`;
    const titleMarkup = !decorative && label ? `<title>${escapeHtml(label)}</title>` : "";

    return `
      <span class="${classes}">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          ${accessibleAttrs}
        >
          ${titleMarkup}
          ${iconMarkup}
        </svg>
      </span>
    `;
  }

  function tierIconMarkup(status, options = {}) {
    const normalized = normalizeTierValue(status, "flex");
    return badgeIconMarkup(normalized, {
      label: formatStatusLabel(normalized),
      ...options,
    });
  }

  function trendIconMarkup(trend, options = {}) {
    const normalized = normalizeText(trend).toLowerCase();
    const kind = normalized === "up" || normalized === "down" ? normalized : "steady";
    return badgeIconMarkup(kind, {
      label: formatTrendLabel(kind === "steady" ? "steady" : normalized),
      ...options,
    });
  }

  function normalizeTierValue(value, fallback = "flex") {
    const normalized = normalizeText(value).toLowerCase();
    const compact = normalized.replace(/[\s/-]+/g, "_");
    if (normalized === "core" || normalized === "flex" || normalized === "sub") {
      return normalized;
    }
    // Legacy migration: map old tier names to new ones
    if (compact === "rotation") return "flex";
    if (compact === "flex_sub") return "sub";
    return fallback;
  }

  function playerDesiredTier(player, fallback = "flex") {
    return normalizeTierValue(player?.desired_tier ?? player?.status, fallback);
  }

  function normalizePlayerDesiredTier(player, fallback = "flex") {
    const desiredTier = playerDesiredTier(player, fallback);
    return {
      ...player,
      // FIX: transition the registry toward `desired_tier` without breaking the many older code
      // paths that still read `status`.
      desired_tier: desiredTier,
      status: desiredTier,
    };
  }

  function normalizePositionCode(value, fallback = "ATT") {
    const normalized = normalizeText(value).toUpperCase();

    if (normalized.startsWith("GK")) {
      return "GK";
    }

    if (normalized.startsWith("D")) {
      return "DEF";
    }

    if (normalized.startsWith("M")) {
      return "MID";
    }

    if (normalized.startsWith("A")) {
      return "ATT";
    }

    return fallback;
  }

  function playerPrimaryPosition(player) {
    const positions = Array.isArray(player?.positions) ? player.positions : [];
    return normalizePositionCode(positions[0] || "ATT");
  }

  function createTeammatePairKey(leftPlayerId, rightPlayerId) {
    const leftId = Number(leftPlayerId);
    const rightId = Number(rightPlayerId);

    if (!Number.isFinite(leftId) || !Number.isFinite(rightId) || leftId === rightId) {
      return "";
    }

    return leftId < rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`;
  }

  function teammateRepeatCount(historyMap, leftPlayerId, rightPlayerId) {
    const key = createTeammatePairKey(leftPlayerId, rightPlayerId);
    if (!key) {
      return 0;
    }

    return Number(historyMap?.get(key) || 0);
  }

  function buildTeammateHistoryMap(assignments) {
    const byMatchday = new Map();

    (assignments || []).forEach((assignment) => {
      const matchdayId = Number(assignment?.matchday_id);
      const playerId = Number(assignment?.player_id);
      const teamCode = normalizeText(assignment?.team_code).toLowerCase();

      if (!Number.isFinite(matchdayId) || !Number.isFinite(playerId) || !teamCode) {
        return;
      }

      const matchdayRows = byMatchday.get(matchdayId) || [];
      matchdayRows.push({
        player_id: playerId,
        team_code: teamCode,
      });
      byMatchday.set(matchdayId, matchdayRows);
    });

    const historyMap = new Map();

    byMatchday.forEach((rows) => {
      const byTeam = new Map();

      rows.forEach((row) => {
        const teamRows = byTeam.get(row.team_code) || [];
        teamRows.push(row.player_id);
        byTeam.set(row.team_code, teamRows);
      });

      byTeam.forEach((playerIds) => {
        const uniqueIds = [...new Set(playerIds)].sort((left, right) => left - right);

        for (let index = 0; index < uniqueIds.length; index += 1) {
          for (let offset = index + 1; offset < uniqueIds.length; offset += 1) {
            const key = createTeammatePairKey(uniqueIds[index], uniqueIds[offset]);
            historyMap.set(key, Number(historyMap.get(key) || 0) + 1);
          }
        }
      });
    });

    return historyMap;
  }

  function buildTeamTargetSizes(totalPlayers, teamCodes, maxPlayersByTeam = {}, seed = 0) {
    const normalizedTeamCodes = Array.isArray(teamCodes) && teamCodes.length ? teamCodes : TEAM_ORDER;
    const targets = Object.fromEntries(normalizedTeamCodes.map((teamCode) => [teamCode, 0]));
    const totalCapacity = normalizedTeamCodes.reduce(
      (sum, teamCode) => sum + Math.max(0, Number(maxPlayersByTeam?.[teamCode] ?? totalPlayers)),
      0
    );

    if (Number(totalPlayers) > totalCapacity) {
      return null;
    }

    const teamCount = normalizedTeamCodes.length;
    const normalizedSeed =
      teamCount > 0 ? ((Number(seed) % teamCount) + teamCount) % teamCount : 0;

    for (let slot = 0; slot < Number(totalPlayers || 0); slot += 1) {
      let assigned = false;

      for (let offset = 0; offset < teamCount; offset += 1) {
        const teamCode = normalizedTeamCodes[(normalizedSeed + slot + offset) % teamCount];
        const maxPlayers = Math.max(0, Number(maxPlayersByTeam?.[teamCode] ?? totalPlayers));

        if (targets[teamCode] >= maxPlayers) {
          continue;
        }

        targets[teamCode] += 1;
        assigned = true;
        break;
      }

      if (!assigned) {
        return null;
      }
    }

    return targets;
  }

  function buildTeamBalanceProfile(player) {
    const age = calculateAge(player?.birth_date);
    const strength = Number.isFinite(Number(player?.skill_rating))
      ? Number(player.skill_rating)
      : 78;

    return {
      id: Number(player?.id),
      player,
      name: playerDisplayName(player),
      strength,
      age,
      positions: Array.isArray(player?.positions) && player.positions.length
        ? player.positions.map((position) => normalizePositionCode(position))
        : ["ATT"],
      primaryPosition: playerPrimaryPosition(player),
    };
  }

  function compareTeamBalanceProfiles(left, right, averageStrength, averageAge) {
    const leftIsGoalkeeper = left.primaryPosition === "GK";
    const rightIsGoalkeeper = right.primaryPosition === "GK";

    if (leftIsGoalkeeper !== rightIsGoalkeeper) {
      return leftIsGoalkeeper ? -1 : 1;
    }

    if (left.positions.length !== right.positions.length) {
      return left.positions.length - right.positions.length;
    }

    const leftStrengthGap = Math.abs(left.strength - averageStrength);
    const rightStrengthGap = Math.abs(right.strength - averageStrength);

    if (rightStrengthGap !== leftStrengthGap) {
      return rightStrengthGap - leftStrengthGap;
    }

    if (averageAge !== null) {
      const leftAgeGap = left.age === null ? -1 : Math.abs(left.age - averageAge);
      const rightAgeGap = right.age === null ? -1 : Math.abs(right.age - averageAge);

      if (rightAgeGap !== leftAgeGap) {
        return rightAgeGap - leftAgeGap;
      }
    }

    if (right.strength !== left.strength) {
      return right.strength - left.strength;
    }

    return left.name.localeCompare(right.name);
  }

  function createEmptyTeamBalanceState(teamCode, targetSize) {
    return {
      teamCode,
      targetSize: Number(targetSize || 0),
      playerIds: [],
      strengthSum: 0,
      ageSum: 0,
      ageCount: 0,
      primaryCounts: {
        GK: 0,
        DEF: 0,
        MID: 0,
        ATT: 0,
      },
    };
  }

  function addProfileToTeamState(teamState, profile) {
    teamState.playerIds.push(profile.id);
    teamState.strengthSum += profile.strength;

    if (profile.age !== null) {
      teamState.ageSum += profile.age;
      teamState.ageCount += 1;
    }

    teamState.primaryCounts[profile.primaryPosition] += 1;
  }

  function summarizeTeamBalanceAssignments(players, assignments, options = {}) {
    const teamCodes = Array.isArray(options.teamCodes) && options.teamCodes.length
      ? options.teamCodes
      : TEAM_ORDER;
    const maxPlayersByTeam = options.maxPlayersByTeam || {};
    const profiles = (players || [])
      .map(buildTeamBalanceProfile)
      .filter((profile) => Number.isFinite(profile.id));
    const profileByPlayerId = new Map(profiles.map((profile) => [profile.id, profile]));
    const targetSizes =
      options.targetSizes ||
      buildTeamTargetSizes(profiles.length, teamCodes, maxPlayersByTeam, options.sizeSeed || 0) ||
      Object.fromEntries(teamCodes.map((teamCode) => [teamCode, 0]));
    const teammateHistory =
      options.teammateHistory || buildTeammateHistoryMap(options.historicalAssignments || []);
    const teamStates = new Map(
      teamCodes.map((teamCode) => [
        teamCode,
        createEmptyTeamBalanceState(teamCode, targetSizes[teamCode] || 0),
      ])
    );
    const assignedPlayerIds = new Set();
    const totalStrength = profiles.reduce((sum, profile) => sum + profile.strength, 0);
    const knownAgeProfiles = profiles.filter((profile) => profile.age !== null);
    const averageStrength = profiles.length ? totalStrength / profiles.length : 0;
    const averageAge = knownAgeProfiles.length
      ? knownAgeProfiles.reduce((sum, profile) => sum + profile.age, 0) / knownAgeProfiles.length
      : null;
    const primaryTotals = {
      GK: 0,
      DEF: 0,
      MID: 0,
      ATT: 0,
    };

    profiles.forEach((profile) => {
      primaryTotals[profile.primaryPosition] += 1;
    });

    const primaryTargets = Object.fromEntries(
      TEAM_BALANCE_POSITION_ORDER.map((position) => [
        position,
        teamCodes.length ? primaryTotals[position] / teamCodes.length : 0,
      ])
    );

    (assignments || []).forEach((assignment) => {
      const playerId = Number(assignment?.player_id);
      const teamCode = normalizeText(assignment?.team_code).toLowerCase();
      const profile = profileByPlayerId.get(playerId);
      const teamState = teamStates.get(teamCode);

      if (!profile || !teamState || assignedPlayerIds.has(playerId)) {
        return;
      }

      addProfileToTeamState(teamState, profile);
      assignedPlayerIds.add(playerId);
    });

    const activeTeamStates = [...teamStates.values()].filter(
      (teamState) => teamState.targetSize > 0 || teamState.playerIds.length > 0
    );
    const perTeam = activeTeamStates.map((teamState) => {
      const averageSkill = teamState.playerIds.length
        ? teamState.strengthSum / teamState.playerIds.length
        : null;
      const averageTeamAge = teamState.ageCount
        ? teamState.ageSum / teamState.ageCount
        : null;
      const targetStrength = averageStrength * teamState.targetSize;
      const strengthPenalty =
        teamState.targetSize > 0
          ? ((teamState.strengthSum - targetStrength) ** 2) / teamState.targetSize
          : 0;
      const agePenalty =
        averageAge !== null && averageTeamAge !== null
          ? (averageTeamAge - averageAge) ** 2
          : 0;
      const positionPenalty = TEAM_BALANCE_POSITION_ORDER.reduce(
        (sum, position) =>
          sum +
          Math.abs(
            Number(teamState.primaryCounts[position] || 0) -
            Number(primaryTargets[position] || 0)
          ),
        0
      );

      let teammateRepeatLoad = 0;

      for (let index = 0; index < teamState.playerIds.length; index += 1) {
        for (let offset = index + 1; offset < teamState.playerIds.length; offset += 1) {
          teammateRepeatLoad += teammateRepeatCount(
            teammateHistory,
            teamState.playerIds[index],
            teamState.playerIds[offset]
          );
        }
      }

      return {
        teamCode: teamState.teamCode,
        playerCount: teamState.playerIds.length,
        targetSize: teamState.targetSize,
        playerIds: [...teamState.playerIds],
        strengthSum: teamState.strengthSum,
        ageSum: teamState.ageSum,
        averageSkill,
        averageAge: averageTeamAge,
        ageCount: teamState.ageCount,
        primaryCounts: { ...teamState.primaryCounts },
        strengthPenalty,
        agePenalty,
        positionPenalty,
        teammateRepeatLoad,
      };
    });

    const populatedTeams = perTeam.filter((team) => team.playerCount > 0);
    const skillValues = populatedTeams
      .map((team) => team.averageSkill)
      .filter((value) => Number.isFinite(value));
    const ageValues = populatedTeams
      .map((team) => team.averageAge)
      .filter((value) => Number.isFinite(value));
    const assignedPlayerCount = assignedPlayerIds.size;
    const unassignedPlayerCount = Math.max(profiles.length - assignedPlayerCount, 0);
    const sizePenalty = perTeam.reduce(
      (sum, team) => sum + Math.abs(team.playerCount - team.targetSize),
      0
    );
    const strengthPenalty = perTeam.reduce((sum, team) => sum + team.strengthPenalty, 0);
    const agePenalty = perTeam.reduce((sum, team) => sum + team.agePenalty, 0);
    const positionPenalty = perTeam.reduce((sum, team) => sum + team.positionPenalty, 0);
    const teammatePenalty = perTeam.reduce(
      (sum, team) => sum + team.teammateRepeatLoad,
      0
    );
    const score =
      TEAM_BALANCE_WEIGHTS.size * sizePenalty +
      TEAM_BALANCE_WEIGHTS.strength * strengthPenalty +
      TEAM_BALANCE_WEIGHTS.age * agePenalty +
      TEAM_BALANCE_WEIGHTS.position * positionPenalty +
      TEAM_BALANCE_WEIGHTS.teammate * teammatePenalty;

    return {
      teamCodes,
      targetSizes,
      averageStrength,
      averageAge,
      primaryTargets,
      assignedPlayerCount,
      unassignedPlayerCount,
      skillSpread:
        skillValues.length > 1
          ? Math.max(...skillValues) - Math.min(...skillValues)
          : 0,
      ageSpread:
        ageValues.length > 1
          ? Math.max(...ageValues) - Math.min(...ageValues)
          : ageValues.length
            ? 0
            : null,
      positionMismatch: positionPenalty,
      teammateRepeatLoad: teammatePenalty,
      score,
      perTeam,
      byTeamCode: new Map(perTeam.map((team) => [team.teamCode, team])),
    };
  }

  function teamPlacementScore(teamSummary, profile, balanceContext) {
    const fillRatio =
      teamSummary.targetSize > 0
        ? (teamSummary.playerCount + 1) / teamSummary.targetSize
        : 1;
    const expectedStrength =
      balanceContext.averageStrength * Math.max(teamSummary.playerCount + 1, 1);
    const strengthPenalty = Math.abs(
      teamSummary.strengthSum + profile.strength - expectedStrength
    );
    const agePenalty =
      balanceContext.averageAge !== null && profile.age !== null
        ? Math.abs(
            (teamSummary.ageCount
              ? (teamSummary.ageSum + profile.age) / (teamSummary.ageCount + 1)
              : profile.age) - balanceContext.averageAge
          )
        : 0;
    const positionPenalty = Math.abs(
      Number(teamSummary.primaryCounts[profile.primaryPosition] || 0) + 1 -
      Number(balanceContext.primaryTargets[profile.primaryPosition] || 0) * fillRatio
    );
    const teammatePenalty = teamSummary.playerIds.reduce(
      (sum, teammateId) =>
        sum + teammateRepeatCount(balanceContext.teammateHistory, profile.id, teammateId),
      0
    );

    return (
      strengthPenalty +
      TEAM_BALANCE_WEIGHTS.age * agePenalty +
      TEAM_BALANCE_WEIGHTS.position * positionPenalty +
      TEAM_BALANCE_WEIGHTS.teammate * teammatePenalty +
      fillRatio
    );
  }

  function buildBalancedTeams(players, options = {}) {
    const teamCodes = Array.isArray(options.teamCodes) && options.teamCodes.length
      ? options.teamCodes
      : TEAM_ORDER;
    const maxPlayersByTeam = options.maxPlayersByTeam || {};
    const profiles = (players || [])
      .map(buildTeamBalanceProfile)
      .filter((profile) => Number.isFinite(profile.id));
    const targetSizes = buildTeamTargetSizes(
      profiles.length,
      teamCodes,
      maxPlayersByTeam,
      options.sizeSeed || 0
    );

    if (!targetSizes) {
      return {
        ok: false,
        reason: "The current IN pool is larger than the configured team capacity.",
      };
    }

    if (!profiles.length) {
      return {
        ok: true,
        assignments: [],
        summary: summarizeTeamBalanceAssignments([], [], {
          teamCodes,
          maxPlayersByTeam,
          targetSizes,
          sizeSeed: options.sizeSeed || 0,
          historicalAssignments: options.historicalAssignments || [],
        }),
      };
    }

    const totalStrength = profiles.reduce((sum, profile) => sum + profile.strength, 0);
    const knownAgeProfiles = profiles.filter((profile) => profile.age !== null);
    const averageStrength = profiles.length ? totalStrength / profiles.length : 0;
    const averageAge = knownAgeProfiles.length
      ? knownAgeProfiles.reduce((sum, profile) => sum + profile.age, 0) / knownAgeProfiles.length
      : null;
    const primaryTotals = {
      GK: 0,
      DEF: 0,
      MID: 0,
      ATT: 0,
    };

    profiles.forEach((profile) => {
      primaryTotals[profile.primaryPosition] += 1;
    });

    const primaryTargets = Object.fromEntries(
      TEAM_BALANCE_POSITION_ORDER.map((position) => [
        position,
        teamCodes.length ? primaryTotals[position] / teamCodes.length : 0,
      ])
    );
    const teammateHistory = buildTeammateHistoryMap(options.historicalAssignments || []);
    const balanceContext = {
      averageStrength,
      averageAge,
      primaryTargets,
      teammateHistory,
    };
    const sortedProfiles = [...profiles].sort((left, right) =>
      compareTeamBalanceProfiles(left, right, averageStrength, averageAge)
    );
    const seededAssignments = new Map();

    sortedProfiles.forEach((profile) => {
      const partialSummary = summarizeTeamBalanceAssignments(
        profiles.map((entry) => entry.player),
        [...seededAssignments.entries()].map(([playerId, teamCode]) => ({
          player_id: playerId,
          team_code: teamCode,
        })),
        {
          teamCodes,
          maxPlayersByTeam,
          targetSizes,
          sizeSeed: options.sizeSeed || 0,
          historicalAssignments: options.historicalAssignments || [],
          teammateHistory,
        }
      );
      let bestTeamCode = null;
      let bestScore = Number.POSITIVE_INFINITY;

      partialSummary.perTeam.forEach((teamSummary) => {
        if (teamSummary.playerCount >= teamSummary.targetSize) {
          return;
        }

        const score = teamPlacementScore(teamSummary, profile, balanceContext);

        if (score < bestScore - 0.001) {
          bestScore = score;
          bestTeamCode = teamSummary.teamCode;
          return;
        }

        if (Math.abs(score - bestScore) > 0.001 || !bestTeamCode) {
          return;
        }

        const bestSummary = partialSummary.byTeamCode.get(bestTeamCode);

        if ((teamSummary.playerCount || 0) < (bestSummary?.playerCount || 0)) {
          bestTeamCode = teamSummary.teamCode;
          return;
        }

        if ((teamSummary.strengthSum || 0) < (bestSummary?.strengthSum || 0)) {
          bestTeamCode = teamSummary.teamCode;
        }
      });

      if (!bestTeamCode) {
        bestTeamCode =
          teamCodes.find((teamCode) => {
            const teamSummary = partialSummary.byTeamCode.get(teamCode);
            return teamSummary && teamSummary.playerCount < teamSummary.targetSize;
          }) || teamCodes[0];
      }

      seededAssignments.set(profile.id, bestTeamCode);
    });

    let bestAssignments = new Map(seededAssignments);
    let bestSummary = summarizeTeamBalanceAssignments(
      profiles.map((profile) => profile.player),
      [...bestAssignments.entries()].map(([playerId, teamCode]) => ({
        player_id: playerId,
        team_code: teamCode,
      })),
      {
        teamCodes,
        maxPlayersByTeam,
        targetSizes,
        sizeSeed: options.sizeSeed || 0,
        historicalAssignments: options.historicalAssignments || [],
        teammateHistory,
      }
    );

    for (let pass = 0; pass < 12; pass += 1) {
      let bestSwap = null;

      for (let index = 0; index < profiles.length; index += 1) {
        for (let offset = index + 1; offset < profiles.length; offset += 1) {
          const leftProfile = profiles[index];
          const rightProfile = profiles[offset];
          const leftTeamCode = bestAssignments.get(leftProfile.id);
          const rightTeamCode = bestAssignments.get(rightProfile.id);

          if (!leftTeamCode || !rightTeamCode || leftTeamCode === rightTeamCode) {
            continue;
          }

          const candidateAssignments = new Map(bestAssignments);
          candidateAssignments.set(leftProfile.id, rightTeamCode);
          candidateAssignments.set(rightProfile.id, leftTeamCode);

          const candidateSummary = summarizeTeamBalanceAssignments(
            profiles.map((profile) => profile.player),
            [...candidateAssignments.entries()].map(([playerId, teamCode]) => ({
              player_id: playerId,
              team_code: teamCode,
            })),
            {
              teamCodes,
              maxPlayersByTeam,
              targetSizes,
              sizeSeed: options.sizeSeed || 0,
              historicalAssignments: options.historicalAssignments || [],
              teammateHistory,
            }
          );

          if (candidateSummary.score + 0.001 >= bestSummary.score) {
            continue;
          }

          if (!bestSwap || candidateSummary.score < bestSwap.summary.score) {
            bestSwap = {
              assignments: candidateAssignments,
              summary: candidateSummary,
            };
          }
        }
      }

      if (!bestSwap) {
        break;
      }

      bestAssignments = bestSwap.assignments;
      bestSummary = bestSwap.summary;
    }

    return {
      ok: true,
      assignments: [...bestAssignments.entries()].map(([playerId, teamCode]) => ({
        player_id: playerId,
        team_code: teamCode,
      })),
      summary: bestSummary,
      targetSizes,
    };
  }

  function tierSuggestionWeight(status) {
    return TIER_SUGGESTION_PRIORITY[normalizeTierValue(status, "sub")] ?? 3;
  }

  function tierSuggestionUnits(status) {
    return TIER_SUGGESTION_UNITS[normalizeTierValue(status, "sub")] ?? 0;
  }

  function preliminaryTierSuggestionStatus(row) {
    if (row?.is_eligible === false) {
      return "sub";
    }

    const overallAverage = Number(row?.overall_attendance_average || 0);
    const overallGames = Number(row?.overall_games_attended || 0);
    const overallNoShows = Number(row?.overall_no_shows || 0);
    const seasonGames = Number(row?.games_attended || 0);

    if (overallAverage >= 1.4 && overallGames >= 6 && seasonGames >= 2 && overallNoShows <= 1) {
      return "core";
    }

    if (overallAverage >= 0.75 && overallGames >= 2 && seasonGames >= 1 && overallNoShows <= 2) {
      return "flex";
    }

    return "sub";
  }

  function compareTierSuggestionPriority(left, right) {
    const tierDiff =
      tierSuggestionWeight(left.preliminary_recommended_tier_status) -
      tierSuggestionWeight(right.preliminary_recommended_tier_status);

    if (tierDiff) {
      return tierDiff;
    }

    const overallAverageDiff =
      Number(right.overall_attendance_average || 0) -
      Number(left.overall_attendance_average || 0);
    if (overallAverageDiff) {
      return overallAverageDiff;
    }

    const scoreDiff =
      Number(right.overall_attendance_score || 0) - Number(left.overall_attendance_score || 0);
    if (scoreDiff) {
      return scoreDiff;
    }

    const gamesDiff = Number(right.overall_games_attended || 0) - Number(left.overall_games_attended || 0);
    if (gamesDiff) {
      return gamesDiff;
    }

    const seasonScoreDiff = Number(right.attendance_score || 0) - Number(left.attendance_score || 0);
    if (seasonScoreDiff) {
      return seasonScoreDiff;
    }

    const historicalScoreDiff =
      Number(right.historical_attendance_score || 0) - Number(left.historical_attendance_score || 0);
    if (historicalScoreDiff) {
      return historicalScoreDiff;
    }

    const recentScoreDiff =
      Number(right.recent_attendance_score || 0) - Number(left.recent_attendance_score || 0);
    if (recentScoreDiff) {
      return recentScoreDiff;
    }

    const recentGamesDiff =
      Number(right.recent_games_attended || 0) - Number(left.recent_games_attended || 0);
    if (recentGamesDiff) {
      return recentGamesDiff;
    }

    const noShowsDiff = Number(left.no_shows || 0) - Number(right.no_shows || 0);
    if (noShowsDiff) {
      return noShowsDiff;
    }

    const historicalNoShowsDiff =
      Number(left.historical_no_shows || 0) - Number(right.historical_no_shows || 0);
    if (historicalNoShowsDiff) {
      return historicalNoShowsDiff;
    }

    const lateCancelsDiff = Number(left.late_cancels || 0) - Number(right.late_cancels || 0);
    if (lateCancelsDiff) {
      return lateCancelsDiff;
    }

    return playerDisplayName(left).localeCompare(playerDisplayName(right));
  }

  function compareSeasonPerformancePriority(left, right) {
    const leftPoints = Number(left.total_points || 0);
    const rightPoints = Number(right.total_points || 0);

    if (rightPoints !== leftPoints) {
      return rightPoints - leftPoints;
    }

    const leftPpg = Number(
      left.points_per_game ?? (left.games_played ? left.total_points / left.games_played : 0)
    );
    const rightPpg = Number(
      right.points_per_game ?? (right.games_played ? right.total_points / right.games_played : 0)
    );

    if (rightPpg !== leftPpg) {
      return rightPpg - leftPpg;
    }

    if (Number(right.wins || 0) !== Number(left.wins || 0)) {
      return Number(right.wins || 0) - Number(left.wins || 0);
    }

    if (Number(right.draws || 0) !== Number(left.draws || 0)) {
      return Number(right.draws || 0) - Number(left.draws || 0);
    }

    if (Number(left.losses || 0) !== Number(right.losses || 0)) {
      return Number(left.losses || 0) - Number(right.losses || 0);
    }

    if (Number(right.goals || 0) !== Number(left.goals || 0)) {
      return Number(right.goals || 0) - Number(left.goals || 0);
    }

    const leftGoalkeeping = Number(
      left.goal_keep_points_earned ?? left.goal_keeps ?? left.goalie_points ?? 0
    );
    const rightGoalkeeping = Number(
      right.goal_keep_points_earned ?? right.goal_keeps ?? right.goalie_points ?? 0
    );

    if (rightGoalkeeping !== leftGoalkeeping) {
      return rightGoalkeeping - leftGoalkeeping;
    }

    if (Number(right.clean_sheets || 0) !== Number(left.clean_sheets || 0)) {
      return Number(right.clean_sheets || 0) - Number(left.clean_sheets || 0);
    }

    if (Number(right.attendance_points || 0) !== Number(left.attendance_points || 0)) {
      return Number(right.attendance_points || 0) - Number(left.attendance_points || 0);
    }

    return playerDisplayName(left.player || left).localeCompare(playerDisplayName(right.player || right));
  }

  function flexQueueGoalKeeps(entry) {
    return Number(entry?.goal_keeps ?? entry?.goal_keep_points_earned ?? entry?.goalie_points ?? 0);
  }

  function compareFlexQueueSeasonTotals(left, right) {
    const pointsDiff = Number(right.total_points || 0) - Number(left.total_points || 0);
    if (pointsDiff) {
      return pointsDiff;
    }

    const goalsDiff = Number(right.goals || 0) - Number(left.goals || 0);
    if (goalsDiff) {
      return goalsDiff;
    }

    const goalKeepsDiff = flexQueueGoalKeeps(right) - flexQueueGoalKeeps(left);
    if (goalKeepsDiff) {
      return goalKeepsDiff;
    }

    const cleanSheetsDiff = Number(right.clean_sheets || 0) - Number(left.clean_sheets || 0);
    if (cleanSheetsDiff) {
      return cleanSheetsDiff;
    }

    if (Number(right.wins || 0) !== Number(left.wins || 0)) {
      return Number(right.wins || 0) - Number(left.wins || 0);
    }

    if (Number(right.draws || 0) !== Number(left.draws || 0)) {
      return Number(right.draws || 0) - Number(left.draws || 0);
    }

    if (Number(left.losses || 0) !== Number(right.losses || 0)) {
      return Number(left.losses || 0) - Number(right.losses || 0);
    }

    if (Number(right.attendance_points || 0) !== Number(left.attendance_points || 0)) {
      return Number(right.attendance_points || 0) - Number(left.attendance_points || 0);
    }

    return playerDisplayName(left.player || left).localeCompare(playerDisplayName(right.player || right));
  }

  function compareRotationQueuePriority(left, right, options = {}) {
    const finalMatchday = options.finalMatchday === true;

    if (!finalMatchday) {
      const gamesDiff = Number(left.games_attended || 0) - Number(right.games_attended || 0);
      if (gamesDiff) {
        return gamesDiff;
      }
    }

    const standingsDiff = compareFlexQueueSeasonTotals(left, right);
    if (standingsDiff) {
      return standingsDiff;
    }

    if (finalMatchday) {
      const gamesDiff = Number(left.games_attended || 0) - Number(right.games_attended || 0);
      if (gamesDiff) {
        return gamesDiff;
      }
    }

    const scoreDiff = Number(right.attendance_score || 0) - Number(left.attendance_score || 0);
    if (scoreDiff) {
      return scoreDiff;
    }

    const noShowsDiff = Number(left.no_shows || 0) - Number(right.no_shows || 0);
    if (noShowsDiff) {
      return noShowsDiff;
    }

    const lateCancelsDiff = Number(left.late_cancels || 0) - Number(right.late_cancels || 0);
    if (lateCancelsDiff) {
      return lateCancelsDiff;
    }

    return playerDisplayName(left).localeCompare(playerDisplayName(right));
  }

  function buildStandingsByPlayerId(
    players,
    assignments,
    playerStats,
    matchdays,
    matches,
    scoringSource
  ) {
    const standings = buildStandings(
      players,
      assignments,
      playerStats,
      buildCompletedMatchdays(matchdays, matches),
      scoringSource
    );

    return new Map(
      standings
        .map((entry) => [Number(entry.player_id || entry.player?.id), entry])
        .filter(([playerId]) => Number.isFinite(playerId))
    );
  }

  function finalMatchdayNumber(season, matchdays) {
    const seasonTotal = Number(season?.total_matchdays || 0);
    if (seasonTotal > 0) {
      return seasonTotal;
    }

    return Math.max(
      0,
      ...(matchdays || []).map((matchday) => Number(matchday?.matchday_number || 0)).filter(Number.isFinite)
    );
  }

  function isFinalMatchday(matchday, season, matchdays) {
    const matchdayNumber = Number(matchday?.matchday_number || 0);
    const lastMatchdayNumber = finalMatchdayNumber(season, matchdays);
    return matchdayNumber > 0 && lastMatchdayNumber > 0 && matchdayNumber >= lastMatchdayNumber;
  }

  function findNextOpenMatchday(matchdays, matches) {
    const completedMatchdayIds = new Set(
      buildCompletedMatchdays(matchdays, matches).map((matchday) => Number(matchday.id))
    );

    return [...(matchdays || [])]
      .sort((left, right) => Number(left.matchday_number || 0) - Number(right.matchday_number || 0))
      .find((matchday) => !completedMatchdayIds.has(Number(matchday.id))) || null;
  }

  function rotationQueueMode(season, matchdays, matches, matchday = null) {
    const targetMatchday = matchday || findNextOpenMatchday(matchdays, matches);
    return isFinalMatchday(targetMatchday, season, matchdays) ? "final" : "regular";
  }

  function buildRotationQueueRows(rows, options = {}) {
    const standingsByPlayerId = options.standingsByPlayerId instanceof Map ? options.standingsByPlayerId : null;
    const finalMatchday = options.finalMatchday === true;

    return [...(rows || [])]
      .filter(
        (row) =>
          normalizeTierValue(row.tier_status || row.default_status, "sub") === "flex" &&
          row.is_eligible !== false
      )
      .map((row) => {
        const standings = standingsByPlayerId?.get(Number(row.player_id));

        if (!standings) {
          return {
            ...row,
            rotation_queue_mode: finalMatchday ? "final" : "regular",
          };
        }

        return {
          ...row,
          total_points: Number(standings.total_points || 0),
          points_per_game: Number(standings.points_per_game || 0),
          wins: Number(standings.wins || 0),
          draws: Number(standings.draws || 0),
          losses: Number(standings.losses || 0),
          goals: Number(standings.goals || 0),
          goal_keeps: Number(standings.goal_keeps ?? standings.goalie_points ?? 0),
          goal_keep_points_earned: Number(
            standings.goal_keep_points_earned ?? standings.goal_keeps ?? standings.goalie_points ?? 0
          ),
          clean_sheets: Number(standings.clean_sheets || 0),
          attendance_points: Number(standings.attendance_points || 0),
          rotation_queue_mode: finalMatchday ? "final" : "regular",
        };
      })
      .sort((left, right) => compareRotationQueuePriority(left, right, { finalMatchday }));
  }

  function historicalSeasonIds(seasons, selectedSeasonId) {
    const orderedSeasons = sortSeasonsChronologically(seasons || []);
    const selectedIndex = orderedSeasons.findIndex(
      (season) => Number(season.id) === Number(selectedSeasonId)
    );

    if (selectedIndex <= 0) {
      return [];
    }

    return orderedSeasons
      .slice(0, selectedIndex)
      .map((season) => Number(season.id))
      .filter(Number.isFinite);
  }

  function summarizeHistoricalAttendance(
    rows,
    seasons,
    selectedSeasonId,
    historicalMatchdays,
    historicalMatches,
    historicalPlayerStats
  ) {
    const targetRows = [...(rows || [])];
    if (!targetRows.length) {
      return targetRows;
    }

    const eligibleSeasonIds = new Set(historicalSeasonIds(seasons, selectedSeasonId));
    if (!eligibleSeasonIds.size) {
      return targetRows.map((row) => ({
        ...row,
        historical_games_attended: 0,
        historical_games_available: 0,
        historical_late_cancels: 0,
        historical_no_shows: 0,
        historical_attendance_score: 0,
        overall_games_attended: Number(row.games_attended || 0),
        overall_games_available: Number(row.games_available || 0),
        overall_late_cancels: Number(row.late_cancels || 0),
        overall_no_shows: Number(row.no_shows || 0),
        overall_tracked_matchdays:
          Number(row.games_attended || 0) +
          Number(row.games_available || 0) +
          Number(row.late_cancels || 0) +
          Number(row.no_shows || 0),
        overall_attendance_score: Number(row.attendance_score || 0),
        overall_attendance_average:
          Number(row.games_attended || 0) +
            Number(row.games_available || 0) +
            Number(row.late_cancels || 0) +
            Number(row.no_shows || 0) >
          0
            ? Number(row.attendance_score || 0) /
              (Number(row.games_attended || 0) +
                Number(row.games_available || 0) +
                Number(row.late_cancels || 0) +
                Number(row.no_shows || 0))
            : 0,
      }));
    }

    const completedMatchdays = buildCompletedMatchdays(
      (historicalMatchdays || []).filter((matchday) =>
        eligibleSeasonIds.has(Number(matchday.season_id))
      ),
      historicalMatches || []
    );
    const completedMatchdayIds = new Set(completedMatchdays.map((matchday) => Number(matchday.id)));
    const playerIds = new Set(targetRows.map((row) => Number(row.player_id)));
    const summaryByPlayer = new Map();

    (historicalPlayerStats || []).forEach((stat) => {
      const playerId = Number(stat.player_id);
      if (!playerIds.has(playerId) || !completedMatchdayIds.has(Number(stat.matchday_id))) {
        return;
      }

      const summary = summaryByPlayer.get(playerId) || {
        historical_games_attended: 0,
        historical_games_available: 0,
        historical_late_cancels: 0,
        historical_no_shows: 0,
      };
      const status = attendanceStatus(stat);

      if (status === "in") {
        summary.historical_games_attended += 1;
      } else if (status === "available") {
        summary.historical_games_available += 1;
      } else if (status === "late_cancel") {
        summary.historical_late_cancels += 1;
      } else if (status === "no_show") {
        summary.historical_no_shows += 1;
      }

      summaryByPlayer.set(playerId, summary);
    });

    return targetRows.map((row) => {
      const summary = summaryByPlayer.get(Number(row.player_id)) || {
        historical_games_attended: 0,
        historical_games_available: 0,
        historical_late_cancels: 0,
        historical_no_shows: 0,
      };
      const historicalAttendanceScore =
        summary.historical_games_attended * 2 +
        summary.historical_games_available -
        summary.historical_late_cancels -
        summary.historical_no_shows * 2;
      const overallGamesAttended =
        Number(row.games_attended || 0) + Number(summary.historical_games_attended || 0);
      const overallGamesAvailable =
        Number(row.games_available || 0) + Number(summary.historical_games_available || 0);
      const overallLateCancels =
        Number(row.late_cancels || 0) + Number(summary.historical_late_cancels || 0);
      const overallNoShows =
        Number(row.no_shows || 0) + Number(summary.historical_no_shows || 0);
      const overallTrackedMatchdays =
        overallGamesAttended + overallGamesAvailable + overallLateCancels + overallNoShows;
      const overallAttendanceScore = Number(row.attendance_score || 0) + historicalAttendanceScore;
      const overallAttendanceAverage =
        overallTrackedMatchdays > 0 ? overallAttendanceScore / overallTrackedMatchdays : 0;

      return {
        ...row,
        ...summary,
        historical_attendance_score: historicalAttendanceScore,
        overall_games_attended: overallGamesAttended,
        overall_games_available: overallGamesAvailable,
        overall_late_cancels: overallLateCancels,
        overall_no_shows: overallNoShows,
        overall_tracked_matchdays: overallTrackedMatchdays,
        overall_attendance_score: overallAttendanceScore,
        overall_attendance_average: overallAttendanceAverage,
      };
    });
  }

  function tierSuggestionTrend(currentTier, suggestedTier) {
    if (suggestedTier === "core") {
      return currentTier === "core" ? "steady" : "up";
    }

    if (suggestedTier === "flex") {
      if (currentTier === "core") {
        return "down";
      }

      return currentTier === "flex" ? "steady" : "up";
    }

    return currentTier === "sub" ? "steady" : "down";
  }

  function tierSuggestionMixLabel(slotLimit) {
    const normalizedLimit = Number(slotLimit || TIER_SUGGESTION_SLOT_LIMIT);
    return `${normalizedLimit}-spot mix`;
  }

  function pluralize(value, singular, plural = `${singular}s`) {
    return Number(value) === 1 ? singular : plural;
  }

  function tierSuggestionEvidence(row) {
    const overallGames = Number(row.overall_games_attended || 0);
    const overallTracked = Number(row.overall_tracked_matchdays || 0);
    const overallScore = Number(row.overall_attendance_score || 0);
    const overallAverage = Number(row.overall_attendance_average || 0);
    const recentGames = Number(row.recent_games_attended || 0);
    const recentScore = Number(row.recent_attendance_score || 0);
    const seasonGames = Number(row.games_attended || 0);
    const seasonScore = Number(row.attendance_score || 0);
    const seasonLateCancels = Number(row.late_cancels || 0);
    const seasonNoShows = Number(row.no_shows || 0);
    const historicalGames = Number(row.historical_games_attended || 0);
    const historicalScore = Number(row.historical_attendance_score || 0);
    const historicalLateCancels = Number(row.historical_late_cancels || 0);
    const historicalNoShows = Number(row.historical_no_shows || 0);
    const seasonFlags = [];
    const historyFlags = [];

    if (seasonLateCancels > 0) {
      seasonFlags.push(`${seasonLateCancels} ${pluralize(seasonLateCancels, "late cancel")}`);
    }

    if (seasonNoShows > 0) {
      seasonFlags.push(`${seasonNoShows} ${pluralize(seasonNoShows, "no-show")}`);
    }

    if (historicalLateCancels > 0) {
      historyFlags.push(
        `${historicalLateCancels} ${pluralize(historicalLateCancels, "late cancel")}`
      );
    }

    if (historicalNoShows > 0) {
      historyFlags.push(`${historicalNoShows} ${pluralize(historicalNoShows, "no-show")}`);
    }

    const overallPart = `Overall ${overallGames} attended across ${overallTracked} tracked matchdays, score ${overallScore}, avg ${overallAverage.toFixed(
      2
    )}`;
    const seasonPart = `Season ${seasonGames} attended, score ${seasonScore}${
      seasonFlags.length ? `, ${seasonFlags.join(", ")}` : ""
    }`;
    const historyPart = `History ${historicalGames} attended, score ${historicalScore}${
      historyFlags.length ? `, ${historyFlags.join(", ")}` : ""
    }`;
    const recentPart = `Recent ${recentGames}/8, score ${recentScore}`;

    return `${overallPart} · ${seasonPart} · ${historyPart} · ${recentPart}`;
  }

  function tierSuggestionNote(row, currentTier, slotLimit) {
    const mixLabel = tierSuggestionMixLabel(slotLimit);

    if (row.is_eligible === false) {
      return "Ineligible. Restore eligibility before tier movement.";
    }

    if (row.recommended_tier_status === "core" && currentTier !== "core") {
      return `Promotion case. Overall attendance history is strong enough to claim a full core spot inside the weighted ${mixLabel}.`;
    }

    if (
      row.recommended_tier_status === "flex" &&
      row.preliminary_recommended_tier_status === "sub"
    ) {
      return `Mix hold. The weighted ${mixLabel} still leaves room for this player even though stronger attendance cases are ahead.`;
    }

    if (row.recommended_tier_status === "flex" && currentTier === "sub") {
      return `Upward case. Overall attendance history now supports a flex half-spot in the weighted ${mixLabel}.`;
    }

    if (
      row.recommended_tier_status === "sub" &&
      row.preliminary_recommended_tier_status !== "sub"
    ) {
      return `Borderline case. Attendance is competitive, but stronger overall attendance cases are taking the last weighted ${mixLabel} spots.`;
    }

    if (row.recommended_tier_status === "sub" && currentTier !== "sub") {
      return "Downward case. Overall attendance history is no longer clearing the current tier line.";
    }

    return row.movement_note || "Stable in current tier range.";
  }

  function tierSuggestionNextStep(row, slotLimit) {
    const mixLabel = tierSuggestionMixLabel(slotLimit);

    if (row.is_eligible === false) {
      return "Restore eligibility";
    }

    if (row.recommended_tier_status === "core") {
      return "Keep attendance high and avoid no-shows";
    }

    if (
      row.recommended_tier_status === "flex" &&
      row.preliminary_recommended_tier_status === "sub"
    ) {
      return `Stay inside the weighted ${mixLabel} by keeping attendance steady`;
    }

    if (row.recommended_tier_status === "flex" && Number(row.games_attended || 0) < 3) {
      return "Build a longer attendance record";
    }

    if (row.recommended_tier_status === "flex") {
      return "Keep stacking attendance and push toward core";
    }

    return `Climb back into the weighted ${mixLabel} with stronger attendance`;
  }

  function applyTierSuggestionSlots(rows, slotLimit = TIER_SUGGESTION_SLOT_LIMIT) {
    const normalizedLimit = Math.max(0, Number(slotLimit || 0));
    const unitLimit = normalizedLimit > 0 ? normalizedLimit * 2 : TIER_SUGGESTION_UNIT_LIMIT;
    const normalizedRows = [...(rows || [])].map((row) => ({
      ...row,
      preliminary_recommended_tier_status: preliminaryTierSuggestionStatus(row),
    }));

    const eligibleRows = normalizedRows
      .filter((row) => row.is_eligible !== false)
      .sort(compareTierSuggestionPriority);
    const suggestionRankByPlayerId = new Map();
    const suggestionUnitsByPlayerId = new Map();
    let remainingUnits = unitLimit;

    eligibleRows.forEach((row) => {
      if (remainingUnits <= 0) {
        return;
      }

      const playerId = Number(row.player_id);
      const unitsWanted = tierSuggestionUnits(row.preliminary_recommended_tier_status);

      if (!unitsWanted) {
        return;
      }

      const grantedUnits = Math.min(unitsWanted, remainingUnits);
      if (grantedUnits <= 0) {
        return;
      }

      suggestionUnitsByPlayerId.set(playerId, grantedUnits);
      suggestionRankByPlayerId.set(playerId, suggestionRankByPlayerId.size + 1);
      remainingUnits -= grantedUnits;
    });

    if (remainingUnits > 0) {
      eligibleRows.forEach((row) => {
        if (remainingUnits <= 0) {
          return;
        }

        const playerId = Number(row.player_id);
        if (suggestionUnitsByPlayerId.has(playerId)) {
          return;
        }

        suggestionUnitsByPlayerId.set(playerId, 1);
        suggestionRankByPlayerId.set(playerId, suggestionRankByPlayerId.size + 1);
        remainingUnits -= 1;
      });
    }

    return normalizedRows.map((row) => {
      const currentTier = normalizeTierValue(row.tier_status || row.default_status, "sub");
      const playerId = Number(row.player_id);
      const suggestionSlotRank = suggestionRankByPlayerId.get(playerId) || null;
      const suggestionUnits = suggestionUnitsByPlayerId.get(playerId) || 0;
      let suggestedTier = "sub";

      if (suggestionUnits >= 2) {
        suggestedTier = "core";
      } else if (suggestionUnits === 1) {
        suggestedTier = "flex";
      }

      const nextRow = {
        ...row,
        suggestion_slot_rank: suggestionSlotRank,
        suggestion_spot_units: suggestionUnits,
        suggestion_spot_value: suggestionUnits / 2,
        suggestion_slot_limit: normalizedLimit || TIER_SUGGESTION_SLOT_LIMIT,
        recommended_tier_status: suggestedTier,
        trend: tierSuggestionTrend(currentTier, suggestedTier),
      };

      nextRow.transparency_note = tierSuggestionNote(
        nextRow,
        currentTier,
        normalizedLimit || TIER_SUGGESTION_SLOT_LIMIT
      );
      nextRow.suggestion_evidence = tierSuggestionEvidence(nextRow);
      nextRow.next_step = tierSuggestionNextStep(
        nextRow,
        normalizedLimit || TIER_SUGGESTION_SLOT_LIMIT
      );

      return nextRow;
    });
  }

  function buildScoringSettings(source) {
    return {
      attendance_points: Number(source?.attendance_points ?? DEFAULT_SCORING_SETTINGS.attendance_points),
      win_points: Number(source?.win_points ?? DEFAULT_SCORING_SETTINGS.win_points),
      draw_points: Number(source?.draw_points ?? DEFAULT_SCORING_SETTINGS.draw_points),
      loss_points: Number(source?.loss_points ?? DEFAULT_SCORING_SETTINGS.loss_points),
      goal_keep_points: Number(source?.goal_keep_points ?? DEFAULT_SCORING_SETTINGS.goal_keep_points),
      team_goal_points: Number(source?.team_goal_points ?? DEFAULT_SCORING_SETTINGS.team_goal_points),
    };
  }

  function attendanceStatus(stat) {
    if (!stat) {
      return "out";
    }

    if (stat.attendance_status && stat.attendance_status !== "out") {
      return stat.attendance_status === "attended" ? "in" : stat.attendance_status;
    }

    if (stat.attended) {
      return "in";
    }

    return "out";
  }

  function requiredMatchdayMatches(matchRows) {
    return [
      matchRows.find((match) => match.round_number === 1 && match.match_order === 1),
      matchRows.find((match) => match.round_number === 1 && match.match_order === 2),
      matchRows.find((match) => match.round_number === 2 && match.match_order === 1),
      matchRows.find((match) => match.round_number === 2 && match.match_order === 2),
    ];
  }

  function summarizeMatchdayProgressRows(matchRows) {
    const requiredMatches = requiredMatchdayMatches(matchRows || []);
    const assignedMatchCount = requiredMatches.filter(
      (match) => match && match.home_team_code && match.away_team_code
    ).length;
    const scoredMatchCount = requiredMatches.filter(
      (match) =>
        match &&
        match.home_team_code &&
        match.away_team_code &&
        match.home_score !== null &&
        match.away_score !== null
    ).length;

    return {
      requiredMatches,
      assignedMatchCount,
      scoredMatchCount,
      isComplete: scoredMatchCount === requiredMatches.length,
    };
  }

  function summarizeMatchdayProgress(matchdayOrId, matches) {
    const matchdayId =
      typeof matchdayOrId === "object" ? Number(matchdayOrId?.id) : Number(matchdayOrId);
    const matchRows = (matches || []).filter((match) => Number(match.matchday_id) === matchdayId);

    // FIX: Centralize partial-matchday detection so schedule/standings stop treating half-scored days
    // as fully scheduled while the table silently excludes them from completed results.
    return summarizeMatchdayProgressRows(matchRows);
  }

  function buildCompletedMatchdays(matchdays, matches) {
    const matchdayMap = new Map((matchdays || []).map((matchday) => [matchday.id, matchday]));
    const groupedMatches = new Map();

    (matches || []).forEach((match) => {
      const existing = groupedMatches.get(match.matchday_id) || [];
      existing.push(match);
      groupedMatches.set(match.matchday_id, existing);
    });

    return Array.from(groupedMatches.entries())
      .map(([matchdayId, matchRows]) => {
        const progress = summarizeMatchdayProgressRows(matchRows);

        if (!progress.isComplete) {
          return null;
        }

        return {
          ...matchdayMap.get(matchdayId),
          matches: progress.requiredMatches,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.matchday_number - right.matchday_number);
  }

  function buildResultMapForMatchday(matches) {
    const resultMap = new Map();

    (matches || []).forEach((match) => {
      const homeResult = { wins: 0, draws: 0, losses: 0 };
      const awayResult = { wins: 0, draws: 0, losses: 0 };

      if (match.home_score > match.away_score) {
        homeResult.wins = 1;
        awayResult.losses = 1;
      } else if (match.home_score < match.away_score) {
        awayResult.wins = 1;
        homeResult.losses = 1;
      } else {
        homeResult.draws = 1;
        awayResult.draws = 1;
      }

      resultMap.set(match.home_team_code, {
        wins: (resultMap.get(match.home_team_code)?.wins || 0) + homeResult.wins,
        draws: (resultMap.get(match.home_team_code)?.draws || 0) + homeResult.draws,
        losses: (resultMap.get(match.home_team_code)?.losses || 0) + homeResult.losses,
        goals_for: (resultMap.get(match.home_team_code)?.goals_for || 0) + Number(match.home_score || 0),
      });

      resultMap.set(match.away_team_code, {
        wins: (resultMap.get(match.away_team_code)?.wins || 0) + awayResult.wins,
        draws: (resultMap.get(match.away_team_code)?.draws || 0) + awayResult.draws,
        losses: (resultMap.get(match.away_team_code)?.losses || 0) + awayResult.losses,
        goals_for: (resultMap.get(match.away_team_code)?.goals_for || 0) + Number(match.away_score || 0),
      });
    });

    return resultMap;
  }

  function countTeamCleanSheetGames(matches, teamCode) {
    return (matches || []).filter((match) => {
      if (!teamCode) {
        return false;
      }

      if (match.home_team_code === teamCode) {
        return Number(match.away_score || 0) === 0;
      }

      if (match.away_team_code === teamCode) {
        return Number(match.home_score || 0) === 0;
      }

      return false;
    }).length;
  }

  function compareStandingsPriority(left, right) {
    return compareSeasonPerformancePriority(left, right);
  }

  function compareStandingsByKey(left, right, sortKey, sortDir) {
    const direction = sortDir === "asc" ? 1 : -1;

    if (sortKey === "player_name") {
      const nameDiff =
        playerDisplayName(left.player).localeCompare(playerDisplayName(right.player)) * direction;
      return nameDiff || compareStandingsPriority(left, right);
    }

    if (sortKey === "tier_status") {
      const tierOrder = { core: 0, flex: 1, sub: 2 };
      const leftTier = tierOrder[left.player?.status] ?? 99;
      const rightTier = tierOrder[right.player?.status] ?? 99;
      const tierDiff = (leftTier - rightTier) * direction;
      return tierDiff || compareStandingsPriority(left, right);
    }

    const leftValue = Number(
      sortKey === "points_per_game"
        ? left.points_per_game ?? (left.games_played ? left.total_points / left.games_played : 0)
        : left?.[sortKey] || 0
    );
    const rightValue = Number(
      sortKey === "points_per_game"
        ? right.points_per_game ?? (right.games_played ? right.total_points / right.games_played : 0)
        : right?.[sortKey] || 0
    );

    if (leftValue !== rightValue) {
      return (leftValue - rightValue) * direction;
    }

    return compareStandingsPriority(left, right);
  }

  function sortStandings(entries, sortKey = "total_points", sortDir = "desc") {
    return [...(entries || [])].sort((left, right) =>
      compareStandingsByKey(left, right, sortKey, sortDir)
    );
  }

  function buildStandings(players, assignments, playerStats, completedMatchdays, scoringSource) {
    const scoring = buildScoringSettings(scoringSource);
    const standingsMap = new Map(
      (players || []).map((player) => [
        player.id,
        {
          // FIX: Several consumers keyed standings by player id, but entries never exposed it.
          player_id: player.id,
          player,
          total_points: 0,
          attendance_points: 0,
          days_attended: 0,
          games_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalie_points: 0,
          goal_keeps: 0,
          goal_keep_points_earned: 0,
          team_goals: 0,
          team_goal_points_earned: 0,
          result_points: 0,
          goals: 0,
          clean_sheets: 0,
          no_shows: 0,
          late_cancels: 0,
        },
      ])
    );

    const assignmentsByMatchday = new Map();
    const statsByMatchday = new Map();

    (assignments || []).forEach((assignment) => {
      const existing = assignmentsByMatchday.get(assignment.matchday_id) || [];
      existing.push(assignment);
      assignmentsByMatchday.set(assignment.matchday_id, existing);
    });

    (playerStats || []).forEach((stat) => {
      const existing = statsByMatchday.get(stat.matchday_id) || [];
      existing.push(stat);
      statsByMatchday.set(stat.matchday_id, existing);

      const entry = standingsMap.get(stat.player_id);

      if (!entry) {
        return;
      }

      // FIX: reliability stats were only counted for completed matchdays, which hid real late
      // cancels and no-shows on any in-progress day.
      const status = stat.attendance_status || "";
      if (status === "no_show") entry.no_shows += 1;
      if (status === "late_cancel") entry.late_cancels += 1;
    });

    (completedMatchdays || []).forEach((matchday) => {
      const resultMap = buildResultMapForMatchday(matchday.matches);
      const dayAssignments = assignmentsByMatchday.get(matchday.id) || [];
      const dayStats = new Map(
        (statsByMatchday.get(matchday.id) || []).map((stat) => [stat.player_id, stat])
      );

      dayAssignments.forEach((assignment) => {
        const entry = standingsMap.get(assignment.player_id);
        const stats = dayStats.get(assignment.player_id);
        const teamResult = resultMap.get(assignment.team_code);

        if (!entry || !stats || attendanceStatus(stats) !== "in" || !teamResult) {
          return;
        }

        const goals = Number(stats.goals || 0);
        const attendancePoints = scoring.attendance_points;
        const resultPoints =
          teamResult.wins * scoring.win_points +
          teamResult.draws * scoring.draw_points +
          teamResult.losses * scoring.loss_points;
        const teamGoals = Number(teamResult.goals_for || 0);
        const teamGoalsPoints = matchday.goals_count_as_points
          ? teamGoals * scoring.team_goal_points
          : 0;
        const goalieKeeps = Number(stats.goal_keeps || 0);
        const goalKeepPointsEarned = goalieKeeps * scoring.goal_keep_points;
        const cleanSheets = stats.clean_sheet
          ? Math.max(1, countTeamCleanSheetGames(matchday.matches, assignment.team_code))
          : 0;
        const totalPoints =
          attendancePoints +
          resultPoints +
          teamGoalsPoints +
          goalKeepPointsEarned;

        entry.total_points += totalPoints;
        entry.attendance_points += attendancePoints;
        entry.days_attended += 1;
        entry.games_played += teamResult.wins + teamResult.draws + teamResult.losses;
        entry.wins += teamResult.wins;
        entry.draws += teamResult.draws;
        entry.losses += teamResult.losses;
        // FIX: `goalie_points` was a raw goal-keep count despite the name. Keep it for compatibility
        // and expose explicit count/points fields for accurate labels and point reconciliation.
        entry.goalie_points += goalieKeeps;
        entry.goal_keeps += goalieKeeps;
        entry.goal_keep_points_earned += goalKeepPointsEarned;
        // FIX: Team-goal scoring was contributing to totals without any visible field to explain it.
        entry.team_goals += teamGoals;
        entry.team_goal_points_earned += teamGoalsPoints;
        entry.result_points += resultPoints;
        entry.goals += goals;
        entry.clean_sheets += cleanSheets;
      });
    });

    return sortStandings(
      Array.from(standingsMap.values()).filter((entry) => entry.days_attended > 0),
      "total_points",
      "desc"
    )
      .map((entry, index) => ({
        ...entry,
        points_per_game: entry.games_played
          ? Number((entry.total_points / entry.games_played).toFixed(2))
          : 0,
        rank: index + 1,
      }));
  }

  function buildPlayerMatchdayDetails(players, assignments, playerStats, completedMatchdays) {
    const detailsByPlayer = new Map();
    const assignmentsByMatchday = new Map();
    const statsByMatchday = new Map();

    (players || []).forEach((player) => {
      detailsByPlayer.set(player.id, []);
    });

    (assignments || []).forEach((assignment) => {
      const existing = assignmentsByMatchday.get(assignment.matchday_id) || [];
      existing.push(assignment);
      assignmentsByMatchday.set(assignment.matchday_id, existing);
    });

    (playerStats || []).forEach((stat) => {
      const existing = statsByMatchday.get(stat.matchday_id) || [];
      existing.push(stat);
      statsByMatchday.set(stat.matchday_id, existing);
    });

    (completedMatchdays || []).forEach((matchday) => {
      const resultMap = buildResultMapForMatchday(matchday.matches);
      const dayAssignments = new Map(
        (assignmentsByMatchday.get(matchday.id) || []).map((assignment) => [assignment.player_id, assignment])
      );
      const dayStats = new Map(
        (statsByMatchday.get(matchday.id) || []).map((stat) => [stat.player_id, stat])
      );
      const playerIds = new Set([...dayAssignments.keys(), ...dayStats.keys()]);

      playerIds.forEach((playerId) => {
        const stat = dayStats.get(playerId) || null;
        const assignment = dayAssignments.get(playerId) || null;
        const status = attendanceStatus(stat);
        const attended = status === "in";
        const teamResult = assignment ? resultMap.get(assignment.team_code) : null;
        const existing = detailsByPlayer.get(playerId) || [];

        existing.push({
          matchday_id: matchday.id,
          matchday_number: matchday.matchday_number,
          attended,
          attendance_status: status,
          goals: Number(stat?.goals || 0),
          goal_keeps: Number(stat?.goal_keeps || 0),
          clean_sheet: Boolean(stat?.clean_sheet),
          wins: attended && teamResult ? teamResult.wins : 0,
          draws: attended && teamResult ? teamResult.draws : 0,
          losses: attended && teamResult ? teamResult.losses : 0,
        });

        detailsByPlayer.set(playerId, existing);
      });
    });

    detailsByPlayer.forEach((details) => {
      details.sort((left, right) => left.matchday_number - right.matchday_number);
    });

    return detailsByPlayer;
  }

  window.MandarinasLogic = {
    normalizeText,
    parseSeasonChronology,
    compareSeasonsChronologically,
    sortSeasonsChronologically,
    nationalityCode,
    nationalityFlag,
    flagAssetPath,
    flagIconMarkup,
    TEAM_ORDER,
    normalizeTeamDisplayConfig,
    teamDisplayLabel,
    applyTeamDisplayConfig,
    escapeHtml,
    fullName,
    stripSubPrefix,
    playerDisplayName,
    playerNameParts,
    calculateAge,
    formatStatusLabel,
    formatTrendLabel,
    badgeIconMarkup,
    tierIconMarkup,
    trendIconMarkup,
    normalizeTierValue,
    playerDesiredTier,
    normalizePlayerDesiredTier,
    normalizePositionCode,
    playerPrimaryPosition,
    buildBalancedTeams,
    summarizeBalancedAssignments: summarizeTeamBalanceAssignments,
    TIER_SUGGESTION_SLOT_LIMIT,
    compareRotationQueuePriority,
    buildRotationQueueRows,
    buildStandingsByPlayerId,
    isFinalMatchday,
    rotationQueueMode,
    historicalSeasonIds,
    summarizeHistoricalAttendance,
    applyTierSuggestionSlots,
    tierSuggestionEvidence,
    buildScoringSettings,
    attendanceStatus,
    buildCompletedMatchdays,
    summarizeMatchdayProgress,
    buildResultMapForMatchday,
    compareStandingsPriority,
    sortStandings,
    buildStandings,
    buildPlayerMatchdayDetails,
  };
})();
