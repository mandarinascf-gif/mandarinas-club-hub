document.addEventListener("DOMContentLoaded", () => {
  if (!window.MandarinasPublic) {
    document.getElementById("schedule-status-line").textContent =
      "MandarinasPublic failed to load. Check browser console for script errors.";
    console.error("[MandarinasPublic] Fatal: MandarinasPublic is undefined");
    return;
  }

  const {
    TEAM_ORDER,
    calculateAge,
    escapeHtml,
    flagIconMarkup,
    formatDateTime,
    formatTeamLabel,
    teamClassName,
    playerDisplayName,
    readableError,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    buildCompletedMatchdays,
    buildScorersForMatchday,
    buildGoalkeepingForMatchday,
    matchdayState,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const seasonSelect = document.getElementById("season-select");
  const heroCopy = document.getElementById("hero-copy");
  const scheduleStatusLine = document.getElementById("schedule-status-line");
  const totalMatchdays = document.getElementById("total-matchdays");
  const scheduledMatchdays = document.getElementById("scheduled-matchdays");
  const playedMatchdays = document.getElementById("played-matchdays");
  const nextMatchday = document.getElementById("next-matchday");
  const nextMatchdayCopy = document.getElementById("next-matchday-copy");
  const matchdayGrid = document.getElementById("matchday-grid");
  const matchdayDetail = document.getElementById("matchday-detail");
  const weatherApi = window.MandarinasWeather || null;
  const teamOrder = Array.isArray(TEAM_ORDER) && TEAM_ORDER.length ? TEAM_ORDER : ["magenta", "blue", "green", "orange"];
  const lineupStorageKey = "mandarinas:schedule-lineups:v1";
  const lineupFormationStorageKey = "mandarinas:schedule-formations:v1";
  const formationPresets = {
    1: [1],
    2: [1, 1],
    3: [1, 2],
    4: [1, 1, 2],
    5: [1, 2, 2],
    6: [1, 2, 3],
    7: [1, 2, 2, 2],
    8: [1, 2, 3, 2],
    9: [1, 2, 3, 3],
    10: [1, 3, 3, 3],
    11: [1, 3, 3, 4],
    12: [1, 3, 4, 4],
  };
  const ninePlayerFormations = ["1-3-3-2", "1-2-3-3", "1-3-2-3", "1-2-4-2", "1-4-2-2", "1-3-4-1"];

  let seasons = [];
  let activeSeasonId = querySeasonIdFromUrl();
  let activeBundle = null;
  let selectedMatchdayId = null;

  function updateSeasonUrl(seasonId) {
    const url = new URL(window.location.href);
    url.searchParams.set("season_id", seasonId);
    window.history.replaceState({}, "", url);
  }

  function renderSeasonOptions() {
    seasonSelect.innerHTML = seasons
      .map(
        (season) => `
          <option value="${season.id}" ${season.id === activeSeasonId ? "selected" : ""}>
            ${escapeHtml(season.name)}
          </option>
        `
      )
      .join("");
  }

  function matchMarkup(match) {
    const complete = match.home_score !== null && match.away_score !== null;

    return `
      <div class="match-row">
        <div class="match-row-head">
          <div class="match-label">Round ${escapeHtml(match.round_number)} · Match ${escapeHtml(match.match_order)}</div>
        </div>
        <div class="scoreline">
          <span class="team-badge ${escapeHtml(teamClassName(match.home_team_code))}">${escapeHtml(formatTeamLabel(match.home_team_code))}</span>
          <strong>${escapeHtml(complete ? match.home_score : "-")}</strong>
          <span>vs</span>
          <strong>${escapeHtml(complete ? match.away_score : "-")}</strong>
          <span class="team-badge ${escapeHtml(teamClassName(match.away_team_code))}">${escapeHtml(formatTeamLabel(match.away_team_code))}</span>
        </div>
      </div>
    `;
  }

  function playerStatSummary(stat) {
    if (!stat) {
      return "";
    }

    const parts = [];
    const goals = Number(stat.goals || 0);
    const goalKeeps = Number(stat.goal_keeps || 0);

    if (goals > 0) {
      parts.push(`${goals}G`);
    }

    if (goalKeeps > 0) {
      parts.push(`${goalKeeps} GK`);
    }

    if (stat.clean_sheet) {
      parts.push("CS");
    }

    return parts.join(" · ");
  }

  function matchdayResultSummary(matchday) {
    const matches = (matchday.matches || []).filter(
      (entry) => entry.home_score !== null && entry.away_score !== null
    );

    if (!matches.length) {
      return "Results pending.";
    }

    return `${matches.length} saved result${matches.length === 1 ? "" : "s"}.`;
  }

  function matchdayTopPerformerSummary(matchday) {
    const scorersByTeam = buildScorersForMatchday(
      matchday.id,
      activeBundle.assignments || [],
      activeBundle.playerStats || [],
      activeBundle.players || []
    );
    const goalkeepingByTeam = buildGoalkeepingForMatchday(
      matchday.id,
      activeBundle.assignments || [],
      activeBundle.playerStats || [],
      activeBundle.players || []
    );

    const topScorer = Object.values(scorersByTeam || {})
      .flat()
      .sort((left, right) => Number(right.goals || 0) - Number(left.goals || 0))[0];
    const topKeeper = Object.values(goalkeepingByTeam || {})
      .flat()
      .sort((left, right) => {
        if (Number(right.clean_sheet || 0) !== Number(left.clean_sheet || 0)) {
          return Number(right.clean_sheet || 0) - Number(left.clean_sheet || 0);
        }
        return Number(right.goal_keeps || 0) - Number(left.goal_keeps || 0);
      })[0];

    const chips = [];

    if (topScorer && Number(topScorer.goals || 0) > 0) {
      chips.push(
        `<span class="tag-pill">Top scorer: ${escapeHtml(topScorer.name)} · ${escapeHtml(
          topScorer.goals
        )}G</span>`
      );
    }

    if (
      topKeeper &&
      (Number(topKeeper.goal_keeps || 0) > 0 || Boolean(topKeeper.clean_sheet))
    ) {
      chips.push(
        `<span class="tag-pill">Goalkeeping: ${escapeHtml(topKeeper.name)} · ${escapeHtml(
          `${topKeeper.goal_keeps || 0} GK${topKeeper.clean_sheet ? " · CS" : ""}`
        )}</span>`
      );
    }

    return chips.length ? chips.join("") : '<span class="tag-pill">Top performers appear after saved stats.</span>';
  }

  function compareMatchdaysChronologically(left, right) {
    const leftKickoff = left?.kickoff_at ? new Date(left.kickoff_at).getTime() : Number.NaN;
    const rightKickoff = right?.kickoff_at ? new Date(right.kickoff_at).getTime() : Number.NaN;
    const leftHasKickoff = Number.isFinite(leftKickoff);
    const rightHasKickoff = Number.isFinite(rightKickoff);

    if (leftHasKickoff && rightHasKickoff && leftKickoff !== rightKickoff) {
      return leftKickoff - rightKickoff;
    }

    if (leftHasKickoff !== rightHasKickoff) {
      return leftHasKickoff ? -1 : 1;
    }

    return Number(left.matchday_number || 0) - Number(right.matchday_number || 0);
  }

  function buildTimelineGroups(rows) {
    const orderedRows = rows.slice().sort(compareMatchdaysChronologically);
    const states = orderedRows.map((matchday) => matchdayState(matchday, activeBundle.matches || []));
    const now = Date.now();
    let focusIndex = states.findIndex((state) => state.key === "in_progress");

    if (focusIndex === -1) {
      focusIndex = orderedRows.findIndex((matchday, index) => {
        const kickoffTime = matchday.kickoff_at ? new Date(matchday.kickoff_at).getTime() : Number.NaN;
        if (Number.isFinite(kickoffTime)) {
          return kickoffTime >= now;
        }

        return states[index].key === "scheduled" || states[index].key === "pending";
      });
    }

    if (focusIndex === -1) {
      focusIndex = orderedRows.length - 1;
    }

    return {
      focus: orderedRows[focusIndex] || null,
      future: orderedRows.slice(focusIndex + 1),
      past: orderedRows.slice(0, focusIndex).reverse(),
    };
  }

  function timelineFocusLabel(matchday) {
    const state = matchdayState(matchday, activeBundle.matches || []);

    if (state.key === "in_progress") {
      return "Now";
    }

    if (state.key === "scheduled") {
      return "Up next";
    }

    if (state.key === "pending") {
      return "Soon";
    }

    return "Latest";
  }

  function timelineRangeLabel(rows) {
    const matchdayNumbers = rows
      .map((row) => Number(row.matchday_number))
      .filter((value) => Number.isFinite(value));

    if (!matchdayNumbers.length) {
      return "";
    }

    const first = Math.min(...matchdayNumbers);
    const last = Math.max(...matchdayNumbers);
    return first === last ? `MD ${first}` : `MD ${first} to MD ${last}`;
  }

  function timelineDisclosureLabel(kind, rows) {
    const count = rows.length;
    const noun = count === 1 ? "matchday" : "matchdays";

    return kind === "future"
      ? `See ${count} future ${noun}`
      : `See ${count} past ${noun}`;
  }

  function timelineDisclosureNote(kind, rows) {
    const range = timelineRangeLabel(rows);
    if (!range) {
      return "";
    }

    return kind === "future"
      ? `${range} stay tucked away until you need them.`
      : `${range} stay tucked away below the current night.`;
  }

  function defaultTimelineMatchdayId(rows) {
    return buildTimelineGroups(rows).focus?.id || null;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function lineupLayoutStorageId(matchdayId, teamCode) {
    return `${activeBundle?.season?.id || "season"}:${matchdayId}:${teamCode}`;
  }

  function lineupFormationStorageId(matchdayId, teamCode) {
    return `${activeBundle?.season?.id || "season"}:${matchdayId}:${teamCode}`;
  }

  function compactLineupName(name) {
    return String(name || "").trim().replace(/\s+/g, " ");
  }

  function normalizeLineupPositionCode(value) {
    const normalized = String(value || "").trim().toUpperCase();

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

    return "";
  }

  function lineupPreferredPositions(player) {
    if (!Array.isArray(player?.positions) || !player.positions.length) {
      return "";
    }

    const normalized = player.positions
      .map((position) => normalizeLineupPositionCode(position))
      .filter(Boolean);

    return [...new Set(normalized)].slice(0, 3).join(" · ");
  }

  function lineupPreferredPositionsLabel(value) {
    const parts = String(value || "")
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.slice(0, 2).join(" / ");
  }

  function lineupNationalityBadge(value) {
    return flagIconMarkup(value, {
      variant: "mini",
      className: "lineup-player-name-flag",
      decorative: true,
      label: value || "Unknown nationality",
    });
  }

  function lineupAverageValue(values, digits = 0) {
    const numericValues = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (!numericValues.length) {
      return null;
    }

    const average = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;

    return digits > 0 ? Number(average.toFixed(digits)) : Math.round(average);
  }

  function lineupTeamSummary(rows) {
    return {
      rating: lineupAverageValue(rows.map((row) => row.skillRating), 0),
      age: lineupAverageValue(rows.map((row) => row.age), 1),
    };
  }

  function lineupTeamStatsMarkup(summary) {
    if (!summary || (summary.rating === null && summary.age === null)) {
      return "";
    }

    return `
      <div class="lineup-team-stats" aria-label="Team averages">
        <span class="lineup-team-stat">
          <span class="lineup-team-stat-label">Avg rtg</span>
          <span class="lineup-team-stat-value">${escapeHtml(summary.rating ?? "—")}</span>
        </span>
        <span class="lineup-team-stat">
          <span class="lineup-team-stat-label">Avg age</span>
          <span class="lineup-team-stat-value">${escapeHtml(summary.age ?? "—")}</span>
        </span>
      </div>
    `;
  }

  function lineupFormationLabel(value) {
    const normalized = String(value || "").trim();
    return normalized.startsWith("1-") ? normalized.slice(2) : normalized;
  }

  function normalizeNinePlayerFormation(value) {
    return ninePlayerFormations.includes(value) ? value : ninePlayerFormations[0];
  }

  function defaultFormationForPlayerCount(playerCount) {
    return playerCount === 9 ? ninePlayerFormations[0] : null;
  }

  function parseFormation(value) {
    const normalized = normalizeNinePlayerFormation(value);
    const rows = normalized
      .split("-")
      .map((part) => Number(part))
      .filter((part) => Number.isInteger(part) && part > 0);

    return rows.length && rows.reduce((sum, count) => sum + count, 0) === 9
      ? rows
      : formationPresets[9].slice();
  }

  function readLineupLayouts() {
    try {
      const raw = window.localStorage?.getItem(lineupStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn("[Schedule] Unable to read saved lineup layouts:", error);
      return {};
    }
  }

  function writeLineupLayouts(layouts) {
    try {
      window.localStorage?.setItem(lineupStorageKey, JSON.stringify(layouts));
    } catch (error) {
      console.warn("[Schedule] Unable to save lineup layouts:", error);
    }
  }

  function loadSavedLineupLayout(matchdayId, teamCode) {
    const layouts = readLineupLayouts();
    const saved = layouts[lineupLayoutStorageId(matchdayId, teamCode)];
    return saved && typeof saved === "object" ? saved : {};
  }

  function saveLineupLayout(matchdayId, teamCode, positions) {
    const layouts = readLineupLayouts();
    layouts[lineupLayoutStorageId(matchdayId, teamCode)] = positions;
    writeLineupLayouts(layouts);
  }

  function readLineupFormations() {
    try {
      const raw = window.localStorage?.getItem(lineupFormationStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn("[Schedule] Unable to read saved lineup formations:", error);
      return {};
    }
  }

  function writeLineupFormations(formations) {
    try {
      window.localStorage?.setItem(lineupFormationStorageKey, JSON.stringify(formations));
    } catch (error) {
      console.warn("[Schedule] Unable to save lineup formations:", error);
    }
  }

  function loadSavedLineupFormation(matchdayId, teamCode, playerCount) {
    const defaultFormation = defaultFormationForPlayerCount(playerCount);

    if (!defaultFormation) {
      return null;
    }

    const formations = readLineupFormations();
    return normalizeNinePlayerFormation(
      formations[lineupFormationStorageId(matchdayId, teamCode)] || defaultFormation
    );
  }

  function saveLineupFormation(matchdayId, teamCode, formation) {
    const formations = readLineupFormations();
    formations[lineupFormationStorageId(matchdayId, teamCode)] =
      normalizeNinePlayerFormation(formation);
    writeLineupFormations(formations);
  }

  function formationRowsForCount(playerCount) {
    if (formationPresets[playerCount]) {
      return formationPresets[playerCount].slice();
    }

    if (playerCount <= 1) {
      return [playerCount];
    }

    const rows = [1];
    let remaining = playerCount - 1;
    const outfieldRows = remaining > 8 ? 4 : remaining > 4 ? 3 : 2;

    for (let rowIndex = 0; rowIndex < outfieldRows; rowIndex += 1) {
      const rowsLeft = outfieldRows - rowIndex;
      const rowCount = Math.ceil(remaining / rowsLeft);
      rows.push(rowCount);
      remaining -= rowCount;
    }

    return rows.filter(Boolean);
  }

  function lineupRowSlotX(rowCount, slotIndex) {
    const slotMap = {
      1: [50],
      2: [33, 67],
      3: [22, 50, 78],
      4: [16, 39, 61, 84],
      5: [13, 31.5, 50, 68.5, 87],
    };

    const slots = slotMap[rowCount];

    if (slots && Number.isFinite(slots[slotIndex])) {
      return slots[slotIndex];
    }

    return rowCount === 1 ? 50 : 12 + ((slotIndex + 1) * 76) / (rowCount + 1);
  }

  function defaultLineupPositions(players, formation = null) {
    const positions = {};
    const rowCounts =
      formation && players.length === 9
        ? parseFormation(formation)
        : formationRowsForCount(players.length);
    const startY = formation && players.length === 9 ? 84 : 83;
    const endY = formation && players.length === 9 ? 28 : 20;
    const yStep = rowCounts.length > 1 ? (startY - endY) / (rowCounts.length - 1) : 0;
    let playerIndex = 0;

    rowCounts.forEach((rowCount, rowIndex) => {
      const top = startY - rowIndex * yStep;

      for (let slotIndex = 0; slotIndex < rowCount; slotIndex += 1) {
        const player = players[playerIndex];

        if (!player) {
          return;
        }

        const left = lineupRowSlotX(rowCount, slotIndex);
        positions[player.playerId] = { x: left, y: top };
        playerIndex += 1;
      }
    });

    return positions;
  }

  function resolveLineupPositions(players, matchdayId, teamCode, formation = null) {
    const defaults = defaultLineupPositions(players, formation);
    const saved = loadSavedLineupLayout(matchdayId, teamCode);
    const resolved = {};

    players.forEach((player) => {
      const savedPosition = saved[player.playerId];

      if (
        savedPosition &&
        Number.isFinite(Number(savedPosition.x)) &&
        Number.isFinite(Number(savedPosition.y))
      ) {
        resolved[player.playerId] = {
          x: clamp(Number(savedPosition.x), 8, 92),
          y: clamp(Number(savedPosition.y), 24, 90),
        };
        return;
      }

      resolved[player.playerId] = defaults[player.playerId] || { x: 50, y: 50 };
    });

    return resolved;
  }

  function lineupFormationControls(teamCode, matchdayId, playerCount, activeFormation) {
    if (playerCount !== 9) {
      return "";
    }

    return `
      <div class="lineup-formation-pill">
        <select
          class="lineup-formation-select"
          id="lineup-formation-${escapeHtml(matchdayId)}-${escapeHtml(teamCode)}"
          data-lineup-formation-select="true"
          data-team-code="${escapeHtml(teamCode)}"
          data-matchday-id="${escapeHtml(matchdayId)}"
          aria-label="${escapeHtml(formatTeamLabel(teamCode))} formation"
        >
          ${ninePlayerFormations
            .map(
              (formation) => `
                <option value="${escapeHtml(formation)}" ${formation === activeFormation ? "selected" : ""}>
                  ${escapeHtml(lineupFormationLabel(formation))}
                </option>
              `
            )
            .join("")}
        </select>
      </div>
    `;
  }

  function lineupPitchMarkup(teamCode, rows, matchdayId, formation = null) {
    const positions = resolveLineupPositions(rows, matchdayId, teamCode, formation);

    return `
      <div class="lineup-pitch-shell">
        <div
          class="lineup-pitch ${escapeHtml(teamClassName(teamCode))}"
          data-lineup-pitch="${escapeHtml(teamCode)}"
          data-matchday-id="${escapeHtml(matchdayId)}"
          data-lineup-formation="${escapeHtml(formation || "")}"
        >
          <svg class="lineup-pitch-markings" viewBox="0 0 100 140" aria-hidden="true" focusable="false">
            <rect x="2" y="2" width="96" height="136" rx="5" />
            <line x1="2" y1="70" x2="98" y2="70" />
            <circle cx="50" cy="70" r="15" />
            <circle cx="50" cy="70" r="1.2" />
            <rect x="18" y="2" width="64" height="20" rx="1" />
            <rect x="30" y="2" width="40" height="8" rx="1" />
            <circle cx="50" cy="16" r="1.2" />
            <rect x="18" y="118" width="64" height="20" rx="1" />
            <rect x="30" y="130" width="40" height="8" rx="1" />
            <circle cx="50" cy="124" r="1.2" />
          </svg>
          ${rows
            .map((row, index) => {
              const position = positions[row.playerId] || { x: 50, y: 50 };
              const tooltip = row.summary ? `${row.name} - ${row.summary}` : row.name;
              const nationalityBadge = lineupNationalityBadge(row.nationality);
              return `
                <button
                  class="lineup-player-token ${escapeHtml(teamClassName(teamCode))}"
                  type="button"
                  data-lineup-player="${escapeHtml(row.playerId)}"
                  data-position-x="${escapeHtml(position.x.toFixed(2))}"
                  data-position-y="${escapeHtml(position.y.toFixed(2))}"
                  style="left:${escapeHtml(position.x.toFixed(2))}%; top:${escapeHtml(position.y.toFixed(2))}%"
                  title="${escapeHtml(tooltip)}"
                  aria-label="Move ${escapeHtml(row.name)} on the ${escapeHtml(formatTeamLabel(teamCode))} field"
                >
                  <span class="lineup-player-shirt">
                    <span class="lineup-player-shirt-glow" aria-hidden="true"></span>
                    <span class="lineup-player-shirt-art" aria-hidden="true"></span>
                    <span class="lineup-player-shirt-number">${escapeHtml(index + 1)}</span>
                  </span>
                  <span class="lineup-player-meta">
                    <span class="lineup-player-name">
                      ${nationalityBadge || ""}
                      <span class="lineup-player-name-text">${escapeHtml(compactLineupName(row.name))}</span>
                    </span>
                    ${
                      row.positions
                        ? `<span class="lineup-player-preferred">${escapeHtml(lineupPreferredPositionsLabel(row.positions))}</span>`
                        : ""
                    }
                  </span>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="lineup-pitch-footer">
          <span class="mini-sub">
            ${formation ? `Drag shirts to tweak ${escapeHtml(lineupFormationLabel(formation))}.` : "Drag shirts to move the shape."}
          </span>
        </div>
      </div>
    `;
  }

  function applyLineupTokenPosition(token, x, y) {
    const nextX = clamp(Number(x), 8, 92);
    const nextY = clamp(Number(y), 24, 90);

    token.dataset.positionX = nextX.toFixed(2);
    token.dataset.positionY = nextY.toFixed(2);
    token.style.left = `${nextX.toFixed(2)}%`;
    token.style.top = `${nextY.toFixed(2)}%`;
  }

  function lineupPitchPositionsFromDom(pitch) {
    const positions = {};

    pitch.querySelectorAll("[data-lineup-player]").forEach((token) => {
      positions[token.dataset.lineupPlayer] = {
        x: Number(token.dataset.positionX || 50),
        y: Number(token.dataset.positionY || 50),
      };
    });

    return positions;
  }

  function resetLineupPitch(matchdayId, teamCode) {
    const pitch = matchdayDetail.querySelector(
      `[data-lineup-pitch="${teamCode}"][data-matchday-id="${matchdayId}"]`
    );

    if (!pitch) {
      return;
    }

    const players = Array.from(pitch.querySelectorAll("[data-lineup-player]")).map((token) => ({
      playerId: Number(token.dataset.lineupPlayer),
    }));
    const formation = pitch.dataset.lineupFormation || null;
    const defaults = defaultLineupPositions(players, formation);

    pitch.querySelectorAll("[data-lineup-player]").forEach((token) => {
      const position = defaults[Number(token.dataset.lineupPlayer)] || { x: 50, y: 50 };
      applyLineupTokenPosition(token, position.x, position.y);
    });

    saveLineupLayout(matchdayId, teamCode, defaults);
  }

  function setLineupFormation(matchdayId, teamCode, formation) {
    const pitch = matchdayDetail.querySelector(
      `[data-lineup-pitch="${teamCode}"][data-matchday-id="${matchdayId}"]`
    );

    if (!pitch) {
      return;
    }

    const players = Array.from(pitch.querySelectorAll("[data-lineup-player]")).map((token) => ({
      playerId: Number(token.dataset.lineupPlayer),
    }));

    if (players.length !== 9) {
      return;
    }

    const normalizedFormation = normalizeNinePlayerFormation(formation);
    const defaults = defaultLineupPositions(players, normalizedFormation);

    pitch.dataset.lineupFormation = normalizedFormation;
    pitch.querySelectorAll("[data-lineup-player]").forEach((token) => {
      const position = defaults[Number(token.dataset.lineupPlayer)] || { x: 50, y: 50 };
      applyLineupTokenPosition(token, position.x, position.y);
    });

    const teamSheet = pitch.closest(".team-sheet");
    teamSheet?.querySelectorAll("[data-lineup-formation-select]").forEach((select) => {
      select.value = normalizedFormation;
    });

    const footerCopy = pitch.parentElement?.querySelector(".lineup-pitch-footer .mini-sub");
    if (footerCopy) {
      footerCopy.textContent = `Drag shirts to tweak ${normalizedFormation}.`;
    }

    saveLineupFormation(matchdayId, teamCode, normalizedFormation);
    saveLineupLayout(matchdayId, teamCode, defaults);
  }

  function initializeLineupPitches() {
    matchdayDetail.querySelectorAll("[data-lineup-pitch]").forEach((pitch) => {
      const matchdayId = Number(pitch.dataset.matchdayId);
      const teamCode = pitch.dataset.lineupPitch;

      pitch.querySelectorAll("[data-lineup-player]").forEach((token) => {
        if (token.dataset.dragReady === "true") {
          return;
        }

        token.dataset.dragReady = "true";
        applyLineupTokenPosition(
          token,
          Number(token.dataset.positionX || 50),
          Number(token.dataset.positionY || 50)
        );

        let dragState = null;

        token.addEventListener("pointerdown", (event) => {
          if (event.button !== undefined && event.button !== 0) {
            return;
          }

          const tokenBounds = token.getBoundingClientRect();
          dragState = {
            pointerId: event.pointerId,
            offsetX: event.clientX - (tokenBounds.left + tokenBounds.width / 2),
            offsetY: event.clientY - (tokenBounds.top + tokenBounds.height / 2),
          };

          token.setPointerCapture(event.pointerId);
          token.classList.add("dragging");
          pitch.classList.add("is-arranging");
          event.preventDefault();
        });

        token.addEventListener("pointermove", (event) => {
          if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
          }

          const pitchBounds = pitch.getBoundingClientRect();
          const x = ((event.clientX - pitchBounds.left - dragState.offsetX) / pitchBounds.width) * 100;
          const y = ((event.clientY - pitchBounds.top - dragState.offsetY) / pitchBounds.height) * 100;

          applyLineupTokenPosition(token, x, y);
        });

        const finishDrag = (event) => {
          if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
          }

          if (token.hasPointerCapture?.(event.pointerId)) {
            token.releasePointerCapture(event.pointerId);
          }

          token.classList.remove("dragging");
          pitch.classList.remove("is-arranging");
          saveLineupLayout(matchdayId, teamCode, lineupPitchPositionsFromDom(pitch));
          dragState = null;
        };

        token.addEventListener("pointerup", finishDrag);
        token.addEventListener("pointercancel", finishDrag);
      });
    });
  }

  function buildLineupView(matchdayId) {
    const playerMap = new Map((activeBundle.players || []).map((player) => [player.id, player]));
    const matchday = (activeBundle.matchdays || []).find((entry) => Number(entry.id) === Number(matchdayId));
    const ageReferenceDate = matchday?.kickoff_at ? new Date(matchday.kickoff_at) : new Date();
    const statMap = new Map(
      (activeBundle.playerStats || [])
        .filter((stat) => stat.matchday_id === matchdayId)
        .map((stat) => [stat.player_id, stat])
    );
    const grouped = { blue: [], magenta: [], green: [], orange: [] };

    (activeBundle.assignments || [])
      .filter((assignment) => assignment.matchday_id === matchdayId)
      .forEach((assignment) => {
        const player = playerMap.get(assignment.player_id);

        if (!player || !grouped[assignment.team_code]) {
          return;
        }

        grouped[assignment.team_code].push({
          playerId: assignment.player_id,
          name: playerDisplayName(player),
          nationality: player.nationality || "",
          positions: lineupPreferredPositions(player),
          age: calculateAge(player.birth_date, ageReferenceDate),
          skillRating: Number.isFinite(Number(player.skill_rating)) ? Number(player.skill_rating) : null,
          summary: playerStatSummary(statMap.get(assignment.player_id)),
        });
      });

    const hasLineups = teamOrder.some((teamCode) => grouped[teamCode].length);

    if (!hasLineups) {
      return '<div class="empty-state">No team assignments were saved for this matchday.</div>';
    }

    return `
      <div class="team-sheet-grid">
        ${teamOrder
          .map((teamCode) => {
            const rows = grouped[teamCode].sort((left, right) => left.name.localeCompare(right.name));
            const formation = loadSavedLineupFormation(matchdayId, teamCode, rows.length);
            const summary = lineupTeamSummary(rows);
            return `
              <section class="team-sheet team-sheet-lineup">
                <div class="team-sheet-head">
                  <span class="team-badge ${escapeHtml(teamClassName(teamCode))}">${escapeHtml(formatTeamLabel(teamCode))}</span>
                  <div class="team-sheet-tools">
                    <span class="mini-sub">${escapeHtml(rows.length)} players</span>
                    ${
                      rows.length
                        ? `
                          <div class="lineup-team-actions">
                            ${lineupTeamStatsMarkup(summary)}
                            ${lineupFormationControls(teamCode, matchdayId, rows.length, formation)}
                            <button
                              class="chip-button lineup-reset-button"
                              type="button"
                              data-lineup-reset="${escapeHtml(teamCode)}"
                              data-matchday-id="${escapeHtml(matchdayId)}"
                            >
                              Reset shape
                            </button>
                          </div>
                        `
                        : ""
                    }
                  </div>
                </div>
                ${
                  rows.length
                    ? lineupPitchMarkup(teamCode, rows, matchdayId, formation)
                    : '<div class="mini-sub">No players recorded.</div>'
                }
              </section>
            `;
          })
          .join("")}
      </div>
    `;
  }

  async function renderDetail() {
    const matchday = (activeBundle?.matchdays || []).find(
      (entry) => Number(entry.id) === Number(selectedMatchdayId)
    );

    if (!matchday) {
      matchdayDetail.innerHTML = '<div class="empty-state">Select a matchday from the list.</div>';
      return;
    }

    const matches = (matchday.matches || []).slice().sort((left, right) => {
      if (left.round_number !== right.round_number) {
        return left.round_number - right.round_number;
      }

      return left.match_order - right.match_order;
    });
    const state = matchdayState(matchday, activeBundle.matches || []);
    const playerReportHref = `./submissions.html?season_id=${activeBundle.season.id}&matchday_id=${matchday.id}`;
    const kickoffAt = matchday.kickoff_at ? new Date(matchday.kickoff_at).getTime() : null;
    const reportEntryOpen = Number.isFinite(kickoffAt) && kickoffAt <= Date.now();
    const playerReportLabel = reportEntryOpen ? "Open report" : "Report opens after kickoff";
    const playerReportCopy = reportEntryOpen
      ? "Players choose their own name, confirm the match context, save their own stats, then unlock ratings from the same report."
      : matchday.kickoff_at
        ? "This report opens from here after the matchday is in play."
        : "This report appears here once the matchday kickoff is scheduled.";
    const playerReportAction = reportEntryOpen
      ? `<a class="primary-button" href="${escapeHtml(playerReportHref)}">${escapeHtml(playerReportLabel)}</a>`
      : `<button class="secondary-button" type="button" disabled>${escapeHtml(playerReportLabel)}</button>`;
    let weatherCopy = "Weather appears once kickoff is scheduled.";

    if (matchday.kickoff_at && weatherApi) {
      try {
        const snapshot = await weatherApi.loadSingleMatchdayWeather(matchday);
        const description = weatherApi.describeMatchdayWeather(snapshot, { includeVenue: true });
        weatherCopy = `${description.headline}${description.detail ? ` · ${description.detail}` : ""}`;
      } catch (error) {
        console.error("[Schedule] Weather load failed:", error);
        weatherCopy = "Forecast unavailable.";
      }
    }

    matchdayDetail.innerHTML = `
      <div class="detail-card">
        <div class="section-label">Summary</div>
        <h3>Matchday ${escapeHtml(matchday.matchday_number)}</h3>
        <ul>
          <li>Status: <strong>${escapeHtml(state.label)}</strong></li>
          <li>Kickoff: <strong>${escapeHtml(matchday.kickoff_at ? formatDateTime(matchday.kickoff_at) : "Not scheduled")}</strong></li>
          <li>Weather: <strong>${escapeHtml(weatherCopy)}</strong></li>
          <li>Goal rule: <strong>${escapeHtml(matchday.goals_count_as_points ? "Goals count" : "Tiebreak only")}</strong></li>
        </ul>
      </div>
      <div class="detail-card">
        <div class="section-label">Matches</div>
        <div class="score-list">
          ${matches.length ? matches.map((match) => matchMarkup(match)).join("") : '<div class="empty-state">No bracket saved yet.</div>'}
        </div>
      </div>
      <div class="detail-card detail-card-teams">
        <div class="section-label">Teams</div>
        ${buildLineupView(matchday.id)}
      </div>
      <div class="detail-card">
        <div class="section-label">Player report</div>
        <h3>Post-match flow</h3>
        <p>${escapeHtml(playerReportCopy)}</p>
        <div class="actions">
          ${playerReportAction}
        </div>
      </div>
    `;

    initializeLineupPitches();
  }

  function matchdayCardMarkup(matchday, options = {}) {
    const state = matchdayState(matchday, activeBundle.matches || []);
    const reportHref = `./submissions.html?season_id=${activeBundle.season.id}&matchday_id=${matchday.id}`;
    const focusLabel = options.focusLabel || "";

    return `
      <article class="matchday-card list-item ${Number(matchday.id) === Number(selectedMatchdayId) ? "active" : ""}" data-matchday-id="${matchday.id}">
        <div class="matchday-head">
          <div>
            <div class="list-item-title">Matchday ${escapeHtml(matchday.matchday_number)}</div>
            <div class="compact-row-copy">
              ${escapeHtml(matchday.kickoff_at ? formatDateTime(matchday.kickoff_at) : "Kickoff not scheduled")}
            </div>
            <p class="matchday-copy">${escapeHtml(matchdayResultSummary(matchday))}</p>
          </div>
          <div class="matchday-tags">
            ${focusLabel ? `<span class="tag-pill timeline-focus-pill">${escapeHtml(focusLabel)}</span>` : ""}
            <span class="state-pill ${escapeHtml(state.key)}">${escapeHtml(state.label)}</span>
            <span class="tag-pill">${escapeHtml(matchday.goals_count_as_points ? "Goals count" : "Tiebreak only")}</span>
          </div>
        </div>
        <div class="compact-badges">
          ${matchdayTopPerformerSummary(matchday)}
        </div>
        <div class="actions">
          <a class="primary-button" href="#matchday-detail">Open match centre</a>
          <a class="secondary-button" href="./videos.html?season_id=${activeBundle.season.id}">Watch video</a>
          <a class="secondary-button" href="${escapeHtml(reportHref)}">Submit report</a>
        </div>
      </article>
    `;
  }

  function matchdayCardListMarkup(rows, options = {}) {
    return rows.map((matchday) => matchdayCardMarkup(matchday, options)).join("");
  }

  function matchdayDisclosureMarkup(kind, rows) {
    if (!rows.length) {
      return "";
    }

    const disclosureOpen = rows.some((matchday) => Number(matchday.id) === Number(selectedMatchdayId));

    return `
      <details class="disclosure-card timeline-disclosure"${disclosureOpen ? " open" : ""}>
        <summary class="timeline-disclosure-summary">
          <span class="timeline-disclosure-pill">${escapeHtml(timelineDisclosureLabel(kind, rows))}</span>
          <span class="timeline-disclosure-note">${escapeHtml(timelineDisclosureNote(kind, rows))}</span>
        </summary>
        <div class="disclosure-body">
          <div class="matchday-grid timeline-disclosure-grid">
            ${matchdayCardListMarkup(rows)}
          </div>
        </div>
      </details>
    `;
  }

  function renderMatchdayList() {
    const rows = activeBundle?.matchdays || [];

    if (!rows.length) {
      matchdayGrid.innerHTML = '<div class="empty-state">No matchdays found for this season.</div>';
      return;
    }

    const { focus, future, past } = buildTimelineGroups(rows);

    if (!focus) {
      matchdayGrid.innerHTML = '<div class="empty-state">No matchdays found for this season.</div>';
      return;
    }

    matchdayGrid.innerHTML = `
      <div class="timeline-focus-shell">
        ${matchdayCardMarkup(focus, { focusLabel: timelineFocusLabel(focus) })}
      </div>
      ${matchdayDisclosureMarkup("future", future)}
      ${matchdayDisclosureMarkup("past", past)}
    `;
  }

  function updateSummary(completedMatchdays) {
    const allMatchdays = activeBundle?.matchdays || [];
    const now = Date.now();
    const upcoming = allMatchdays
      .filter((matchday) => matchday.kickoff_at && new Date(matchday.kickoff_at).getTime() >= now)
      .sort((left, right) => new Date(left.kickoff_at) - new Date(right.kickoff_at))[0];

    totalMatchdays.textContent = String(allMatchdays.length);
    playedMatchdays.textContent = String(completedMatchdays.length);
    scheduledMatchdays.textContent = String(
      allMatchdays.filter((matchday) => matchday.kickoff_at && !completedMatchdays.some((entry) => entry.id === matchday.id)).length
    );
    nextMatchday.textContent = upcoming ? `MD ${upcoming.matchday_number}` : "None";
    nextMatchdayCopy.textContent = upcoming
      ? formatDateTime(upcoming.kickoff_at)
      : "No future kickoff scheduled.";
  }

  async function loadSeason() {
    scheduleStatusLine.textContent = "Loading the schedule...";

    try {
      activeBundle = await fetchSeasonBundle(activeSeasonId);
      const completedMatchdays = buildCompletedMatchdays(activeBundle.matchdays, activeBundle.matches);

      if (!(activeBundle.matchdays || []).some((entry) => Number(entry.id) === Number(selectedMatchdayId))) {
        selectedMatchdayId = defaultTimelineMatchdayId(activeBundle.matchdays || []);
      }

      heroCopy.textContent = `${activeBundle.season.name} keeps the current or next matchday on top, with past and future groups tucked away until you need them.`;
      updateSummary(completedMatchdays);
      renderMatchdayList();
      await renderDetail();
      scheduleStatusLine.textContent = "Fixtures loaded.";
    } catch (error) {
      const message = readableError(error);
      scheduleStatusLine.textContent = message;
      matchdayGrid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      matchdayDetail.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  matchdayGrid.addEventListener("click", async (event) => {
    const row = event.target.closest("[data-matchday-id]");
    if (!row) {
      return;
    }

    selectedMatchdayId = Number(row.dataset.matchdayId);
    renderMatchdayList();
    await renderDetail();
  });

  seasonSelect.addEventListener("change", async () => {
    activeSeasonId = Number(seasonSelect.value);
    updateSeasonUrl(activeSeasonId);
    selectedMatchdayId = null;
    await loadSeason();
  });

  matchdayDetail.addEventListener("click", (event) => {
    const resetButton = event.target.closest("[data-lineup-reset]");

    if (!resetButton) {
      return;
    }

    resetLineupPitch(Number(resetButton.dataset.matchdayId), resetButton.dataset.lineupReset);
  });

  matchdayDetail.addEventListener("change", (event) => {
    const formationSelect = event.target.closest("[data-lineup-formation-select]");

    if (!formationSelect) {
      return;
    }

    setLineupFormation(
      Number(formationSelect.dataset.matchdayId),
      formationSelect.dataset.teamCode,
      formationSelect.value
    );
  });

  async function init() {
    try {
      seasons = await fetchSeasons();
      const selectedSeason = pickSeason(seasons, activeSeasonId);

      if (!selectedSeason) {
        scheduleStatusLine.textContent = "No seasons have been created yet.";
        matchdayGrid.innerHTML = '<div class="empty-state">The schedule will appear once a season exists.</div>';
        return;
      }

      activeSeasonId = selectedSeason.id;
      renderSeasonOptions();
      updateSeasonUrl(activeSeasonId);
      await loadSeason();
    } catch (error) {
      const message = readableError(error);
      scheduleStatusLine.textContent = message;
      matchdayGrid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      matchdayDetail.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  init();
});
