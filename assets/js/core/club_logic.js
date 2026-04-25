(function () {
  "use strict";

  const STATUS_LABELS = {
    core: "Core",
    rotation: "Rotation",
    flex_sub: "Flex/Sub",
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
    rotation: 1,
    flex_sub: 2,
  });
  const TIER_SUGGESTION_UNITS = Object.freeze({
    core: 2,
    rotation: 1,
    flex_sub: 0,
  });
  const DEFAULT_TEAM_DISPLAY_CONFIG = Object.freeze({
    magenta: Object.freeze({ label: "Magenta", color: "#f472b6" }),
    blue: Object.freeze({ label: "Blue", color: "#60a5fa" }),
    green: Object.freeze({ label: "Green", color: "#4ade80" }),
    orange: Object.freeze({ label: "Orange", color: "#fb923c" }),
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
    return STATUS_LABELS[status] || "Core";
  }

  function formatTrendLabel(trend) {
    return TREND_LABELS[trend] || "Holding";
  }

  function normalizeTierValue(value, fallback = "rotation") {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === "core" || normalized === "rotation" || normalized === "flex_sub") {
      return normalized;
    }
    return fallback;
  }

  function playerDesiredTier(player, fallback = "rotation") {
    return normalizeTierValue(player?.desired_tier ?? player?.status, fallback);
  }

  function normalizePlayerDesiredTier(player, fallback = "rotation") {
    const desiredTier = playerDesiredTier(player, fallback);
    return {
      ...player,
      // FIX: transition the registry toward `desired_tier` without breaking the many older code
      // paths that still read `status`.
      desired_tier: desiredTier,
      status: desiredTier,
    };
  }

  function tierSuggestionWeight(status) {
    return TIER_SUGGESTION_PRIORITY[normalizeTierValue(status, "flex_sub")] ?? 3;
  }

  function tierSuggestionUnits(status) {
    return TIER_SUGGESTION_UNITS[normalizeTierValue(status, "flex_sub")] ?? 0;
  }

  function compareTierSuggestionPriority(left, right) {
    const tierDiff =
      tierSuggestionWeight(left.preliminary_recommended_tier_status) -
      tierSuggestionWeight(right.preliminary_recommended_tier_status);

    if (tierDiff) {
      return tierDiff;
    }

    const recentScoreDiff =
      Number(right.recent_attendance_score || 0) - Number(left.recent_attendance_score || 0);
    if (recentScoreDiff) {
      return recentScoreDiff;
    }

    const scoreDiff = Number(right.attendance_score || 0) - Number(left.attendance_score || 0);
    if (scoreDiff) {
      return scoreDiff;
    }

    const historicalScoreDiff =
      Number(right.historical_attendance_score || 0) - Number(left.historical_attendance_score || 0);
    if (historicalScoreDiff) {
      return historicalScoreDiff;
    }

    const recentGamesDiff =
      Number(right.recent_games_attended || 0) - Number(left.recent_games_attended || 0);
    if (recentGamesDiff) {
      return recentGamesDiff;
    }

    const gamesDiff = Number(right.games_attended || 0) - Number(left.games_attended || 0);
    if (gamesDiff) {
      return gamesDiff;
    }

    const historicalGamesDiff =
      Number(right.historical_games_attended || 0) - Number(left.historical_games_attended || 0);
    if (historicalGamesDiff) {
      return historicalGamesDiff;
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

  function compareRotationQueuePriority(left, right) {
    const gamesDiff = Number(left.games_attended || 0) - Number(right.games_attended || 0);
    if (gamesDiff) {
      return gamesDiff;
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

  function buildRotationQueueRows(rows) {
    return [...(rows || [])]
      .filter(
        (row) =>
          normalizeTierValue(row.tier_status || row.default_status, "flex_sub") === "rotation" &&
          row.is_eligible !== false
      )
      .sort(compareRotationQueuePriority);
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

      return {
        ...row,
        ...summary,
        historical_attendance_score: historicalAttendanceScore,
      };
    });
  }

  function tierSuggestionTrend(currentTier, suggestedTier) {
    if (suggestedTier === "core") {
      return currentTier === "core" ? "steady" : "up";
    }

    if (suggestedTier === "rotation") {
      if (currentTier === "core") {
        return "down";
      }

      return currentTier === "rotation" ? "steady" : "up";
    }

    return currentTier === "flex_sub" ? "steady" : "down";
  }

  function tierSuggestionMixLabel(slotLimit) {
    const normalizedLimit = Number(slotLimit || TIER_SUGGESTION_SLOT_LIMIT);
    return `${normalizedLimit}-spot mix`;
  }

  function pluralize(value, singular, plural = `${singular}s`) {
    return Number(value) === 1 ? singular : plural;
  }

  function tierSuggestionEvidence(row) {
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
    const recentPart = `Recent ${recentGames}/8, score ${recentScore}`;
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

    const seasonPart = `Season ${seasonGames} attended, score ${seasonScore}${
      seasonFlags.length ? `, ${seasonFlags.join(", ")}` : ""
    }`;
    const historyPart = `History ${historicalGames} attended, score ${historicalScore}${
      historyFlags.length ? `, ${historyFlags.join(", ")}` : ""
    }`;

    return `${recentPart} · ${seasonPart} · ${historyPart}`;
  }

  function tierSuggestionNote(row, currentTier, slotLimit) {
    const mixLabel = tierSuggestionMixLabel(slotLimit);

    if (row.is_eligible === false) {
      return "Ineligible. Restore eligibility before tier movement.";
    }

    if (row.recommended_tier_status === "core" && currentTier !== "core") {
      return `Promotion case. Recent form is strong enough to claim a full core spot inside the weighted ${mixLabel}.`;
    }

    if (
      row.recommended_tier_status === "rotation" &&
      row.preliminary_recommended_tier_status === "flex_sub"
    ) {
      return `Mix hold. Season-to-date work still keeps this player inside the weighted ${mixLabel} even with a lighter recent run.`;
    }

    if (row.recommended_tier_status === "rotation" && currentTier === "flex_sub") {
      return `Upward case. The recent 8-match run now supports a rotation half-spot in the weighted ${mixLabel}.`;
    }

    if (
      row.recommended_tier_status === "flex_sub" &&
      row.preliminary_recommended_tier_status !== "flex_sub"
    ) {
      return `Borderline case. The recent run is competitive, but stronger mix cases are taking the last weighted ${mixLabel} spots.`;
    }

    if (row.recommended_tier_status === "flex_sub" && currentTier !== "flex_sub") {
      return "Downward case. Recent form is no longer clearing the current tier line once season totals are folded in.";
    }

    return row.movement_note || "Stable in current tier range.";
  }

  function tierSuggestionNextStep(row, slotLimit) {
    const mixLabel = tierSuggestionMixLabel(slotLimit);

    if (row.is_eligible === false) {
      return "Restore eligibility";
    }

    if (row.recommended_tier_status === "core") {
      return "Keep the recent run strong and avoid no-shows";
    }

    if (
      row.recommended_tier_status === "rotation" &&
      row.preliminary_recommended_tier_status === "flex_sub"
    ) {
      return `Stay inside the weighted ${mixLabel} and strengthen the recent 8-match run`;
    }

    if (row.recommended_tier_status === "rotation" && Number(row.recent_games_attended || 0) < 3) {
      return "Turn the recent run into a longer stretch of availability";
    }

    if (row.recommended_tier_status === "rotation") {
      return "Keep stacking recent attendance and push toward core";
    }

    return `Climb back into the weighted ${mixLabel} with a stronger recent 8-match run`;
  }

  function applyTierSuggestionSlots(rows, slotLimit = TIER_SUGGESTION_SLOT_LIMIT) {
    const normalizedLimit = Math.max(0, Number(slotLimit || 0));
    const unitLimit = normalizedLimit > 0 ? normalizedLimit * 2 : TIER_SUGGESTION_UNIT_LIMIT;
    const normalizedRows = [...(rows || [])].map((row) => ({
      ...row,
      preliminary_recommended_tier_status: normalizeTierValue(
        row.preliminary_recommended_tier_status || row.recommended_tier_status,
        "flex_sub"
      ),
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
      const currentTier = normalizeTierValue(row.tier_status || row.default_status, "flex_sub");
      const playerId = Number(row.player_id);
      const suggestionSlotRank = suggestionRankByPlayerId.get(playerId) || null;
      const suggestionUnits = suggestionUnitsByPlayerId.get(playerId) || 0;
      let suggestedTier = "flex_sub";

      if (suggestionUnits >= 2) {
        suggestedTier = "core";
      } else if (suggestionUnits === 1) {
        suggestedTier = "rotation";
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
    if (right.total_points !== left.total_points) {
      return right.total_points - left.total_points;
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

    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }

    if (right.draws !== left.draws) {
      return right.draws - left.draws;
    }

    if (left.losses !== right.losses) {
      return left.losses - right.losses;
    }

    if (right.goals !== left.goals) {
      return right.goals - left.goals;
    }

    const leftGoalkeeping = Number(left.goal_keep_points_earned ?? left.goal_keeps ?? left.goalie_points ?? 0);
    const rightGoalkeeping = Number(right.goal_keep_points_earned ?? right.goal_keeps ?? right.goalie_points ?? 0);

    if (rightGoalkeeping !== leftGoalkeeping) {
      return rightGoalkeeping - leftGoalkeeping;
    }

    if (right.clean_sheets !== left.clean_sheets) {
      return right.clean_sheets - left.clean_sheets;
    }

    if (right.attendance_points !== left.attendance_points) {
      return right.attendance_points - left.attendance_points;
    }

    return playerDisplayName(left.player).localeCompare(playerDisplayName(right.player));
  }

  function compareStandingsByKey(left, right, sortKey, sortDir) {
    const direction = sortDir === "asc" ? 1 : -1;

    if (sortKey === "player_name") {
      const nameDiff =
        playerDisplayName(left.player).localeCompare(playerDisplayName(right.player)) * direction;
      return nameDiff || compareStandingsPriority(left, right);
    }

    if (sortKey === "tier_status") {
      const tierOrder = { core: 0, rotation: 1, flex_sub: 2 };
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
    normalizeTierValue,
    playerDesiredTier,
    normalizePlayerDesiredTier,
    TIER_SUGGESTION_SLOT_LIMIT,
    buildRotationQueueRows,
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
