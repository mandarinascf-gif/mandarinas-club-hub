document.addEventListener("DOMContentLoaded", async () => {
  const shell = window.MandarinasShell || {};
  const refreshMotion = shell.refreshMotion || (() => {});
  const pulseSurface = shell.pulseSurface || (() => {});
  const playFeedback = shell.playFeedback || ((element, options = {}) => {
    pulseSurface(element, options.className || "ball-tap");
  });
  const animateNumber = shell.animateNumber || ((element, value) => {
    if (element) {
      element.textContent = String(value);
    }
  });

  if (!window.MandarinasPublic) {
    const msg = "MandarinasPublic failed to load. Check browser console for script errors.";
    document.getElementById("status-text").textContent = msg;
    console.error("[MandarinasPublic] Fatal:", msg);
    return;
  }

  const {
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    normalizeText,
    escapeHtml,
    playerDisplayName,
    playerNameParts,
    calculateAge,
    formatStatusLabel,
    readableError,
    buildCompletedMatchdays,
    buildStandings,
    buildPlayerMatchdayDetails,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const seasonSelect = document.getElementById("season-select");
  const rosterSearch = document.getElementById("roster-search");
  const playerList = document.getElementById("player-list");
  const playerDetail = document.getElementById("player-detail");
  const statusLine = document.getElementById("status-line");
  const statusText = document.getElementById("status-text");
  const totalPlayersEl = document.getElementById("total-players");
  const rotationPlayersEl = document.getElementById("rotation-players");
  const corePlayersEl = document.getElementById("core-players");
  const seasonNameEl = document.getElementById("season-name");

  let seasons = [];
  let activeSeasonId = querySeasonIdFromUrl();
  let allPlayers = [];
  let allStandings = [];
  let playerDetailsMap = new Map();
  let positionFilter = "all";
  let tierFilter = "all";
  let selectedPlayerId = null;

  function updateSeasonUrl() {
    const url = new URL(window.location.href);

    if (activeSeasonId) {
      url.searchParams.set("season_id", String(activeSeasonId));
    } else {
      url.searchParams.delete("season_id");
    }

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

  function buildStandingsMap(standings) {
    const map = new Map();
    (standings || []).forEach((entry) => {
      map.set(entry.player_id || entry.player?.id, entry);
    });
    return map;
  }

  function getPlayerStats(playerId, standingsMap) {
    return standingsMap.get(playerId) || {
      goals: 0,
      goal_keep_points_earned: 0,
      clean_sheets: 0,
      days_attended: 0,
      total_points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points_per_game: 0,
      rank: "-",
    };
  }

  function getPositionCategory(positions) {
    if (!positions || !positions.length) {
      return "ATT";
    }

    const first = String(positions[0]).toUpperCase();
    if (first.startsWith("GK")) {
      return "GK";
    }
    if (first.startsWith("D")) {
      return "DEF";
    }
    if (first.startsWith("M")) {
      return "MID";
    }
    return "ATT";
  }

  function visiblePlayers() {
    const query = normalizeText(rosterSearch.value).toLowerCase();

    return allPlayers
      .filter((player) => {
        if (positionFilter !== "all" && getPositionCategory(player.positions) !== positionFilter) {
          return false;
        }

        if (tierFilter !== "all" && player.status !== tierFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          player.first_name,
          player.last_name,
          player.nickname || "",
          player.nationality || "",
          ...(player.positions || []),
          player.status || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((left, right) => playerDisplayName(left).localeCompare(playerDisplayName(right)));
  }

  function ensureSelectedPlayerStillVisible() {
    const rows = visiblePlayers();

    if (!rows.length) {
      selectedPlayerId = null;
      return;
    }

    if (!rows.some((player) => Number(player.id) === Number(selectedPlayerId))) {
      selectedPlayerId = rows[0].id;
    }
  }

  function renderRoster() {
    const rows = visiblePlayers();

    if (!allPlayers.length) {
      playerList.innerHTML = '<div class="empty-state">No players on this roster yet.</div>';
      return;
    }

    if (!rows.length) {
      playerList.innerHTML = '<div class="empty-state">No players match the current filters.</div>';
      return;
    }

    playerList.innerHTML = rows
      .map((player) => {
        const nameParts = playerNameParts(player);
        const subtitle = [nameParts.secondary, formatStatusLabel(player.status)]
          .filter(Boolean)
          .join(" · ");

        return `
          <article class="list-item ${Number(player.id) === Number(selectedPlayerId) ? "active" : ""}" data-player-id="${player.id}">
            <div>
              <div class="list-item-title">${escapeHtml(nameParts.primary || playerDisplayName(player))}</div>
              <div class="compact-row-copy">${escapeHtml(subtitle || "Club player")}</div>
            </div>
            <div class="list-actions">
              <span class="tier-pill ${escapeHtml(player.status)}">${escapeHtml(formatStatusLabel(player.status))}</span>
              <button class="secondary-button" type="button">View</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderRecentHistory(details) {
    const recent = [...(details || [])].slice(-5).reverse();

    if (!recent.length) {
      return '<div class="empty-state">No completed matchday history yet.</div>';
    }

    return `
      <div class="timeline-list">
        ${recent
          .map(
            (row) => `
              <article class="timeline-item">
                <div class="timeline-head">
                  <div class="timeline-title">Matchday ${escapeHtml(row.matchday_number)}</div>
                  <div class="timeline-copy">${escapeHtml(row.attendance_status || (row.attended ? "in" : "out"))}</div>
                </div>
                <div class="compact-badges">
                  <span class="stat-pill">${escapeHtml(`${row.goals || 0} goals`)}</span>
                  <span class="stat-pill">${escapeHtml(`${row.goal_keeps || 0} GK`)}</span>
                  ${row.clean_sheet ? '<span class="stat-pill">Clean sheet</span>' : ""}
                  <span class="stat-pill">${escapeHtml(`${row.wins}-${row.draws}-${row.losses}`)}</span>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderDetail() {
    const player = allPlayers.find((entry) => Number(entry.id) === Number(selectedPlayerId));

    if (!player) {
      playerDetail.innerHTML = '<div class="empty-state">Select a player from the list.</div>';
      return;
    }

    const standingsMap = buildStandingsMap(allStandings);
    const stats = getPlayerStats(player.id, standingsMap);
    const nameParts = playerNameParts(player);
    const positions =
      Array.isArray(player.positions) && player.positions.length
        ? player.positions.join(", ")
        : "Not set";
    const age = calculateAge(player.birth_date);
    const history = playerDetailsMap.get(player.id) || [];

    playerDetail.innerHTML = `
      <div class="detail-card">
        <div class="section-label">Identity</div>
        <h3>${escapeHtml(nameParts.primary || playerDisplayName(player))}</h3>
        <ul>
          <li>Full name: <strong>${escapeHtml(`${player.first_name || ""} ${player.last_name || ""}`.trim())}</strong></li>
          <li>Nickname: <strong>${escapeHtml(player.nickname || "Not set")}</strong></li>
          <li>Nationality: <strong>${escapeHtml(player.nationality || "Not set")}</strong></li>
          <li>Age: <strong>${escapeHtml(age == null ? "Unknown" : age)}</strong></li>
        </ul>
      </div>
      <div class="detail-card">
        <div class="section-label">Season Profile</div>
        <ul>
          <li>Tier: <strong>${escapeHtml(formatStatusLabel(player.status))}</strong></li>
          <li>Positions: <strong>${escapeHtml(positions)}</strong></li>
          <li>Rank: <strong>${escapeHtml(stats.rank)}</strong></li>
          <li>Points: <strong>${escapeHtml(stats.total_points || 0)}</strong></li>
          <li>Points per game: <strong>${escapeHtml(Number(stats.points_per_game || 0).toFixed(2))}</strong></li>
        </ul>
      </div>
      <div class="detail-card">
        <div class="section-label">Season Totals</div>
        <ul>
          <li>Attendance: <strong>${escapeHtml(stats.days_attended || 0)}</strong></li>
          <li>Goals: <strong>${escapeHtml(stats.goals || 0)}</strong></li>
          <li>Goalkeeping points: <strong>${escapeHtml(stats.goal_keep_points_earned || 0)}</strong></li>
          <li>Clean sheets: <strong>${escapeHtml(stats.clean_sheets || 0)}</strong></li>
          <li>Record: <strong>${escapeHtml(`${stats.wins || 0}-${stats.draws || 0}-${stats.losses || 0}`)}</strong></li>
        </ul>
      </div>
      <div class="detail-card">
        <div class="section-label">Recent Matchdays</div>
        ${renderRecentHistory(history)}
      </div>
    `;
  }

  function updateSummaryStats(animate = false) {
    const updateCount = animate
      ? animateNumber
      : (element, value) => {
          element.textContent = String(value);
        };

    updateCount(totalPlayersEl, allPlayers.length);
    updateCount(corePlayersEl, allPlayers.filter((player) => player.status === "core").length);
    updateCount(rotationPlayersEl, allPlayers.filter((player) => player.status === "rotation").length);
  }

  async function loadSeason() {
    const selectedSeason = pickSeason(seasons, activeSeasonId);

    if (!selectedSeason) {
      seasonSelect.innerHTML = '<option value="">No seasons available</option>';
      seasonSelect.disabled = true;
      seasonNameEl.textContent = "-";
      statusLine.classList.remove("loading", "success", "error");
      statusLine.classList.add("warning");
      statusText.textContent = "No seasons found.";
      playerList.innerHTML = '<div class="empty-state">No seasons are available yet.</div>';
      playerDetail.innerHTML = '<div class="empty-state">Launch a season to view the squad.</div>';
      return;
    }

    activeSeasonId = selectedSeason.id;
    renderSeasonOptions();
    updateSeasonUrl();
    seasonSelect.disabled = false;
    seasonNameEl.textContent = selectedSeason.name;
    statusLine.classList.remove("success", "error", "warning");
    statusLine.classList.add("loading");
    statusText.textContent = "Loading the roster...";

    try {
      const bundle = await fetchSeasonBundle(selectedSeason.id);
      allPlayers = bundle.players || [];

      const completedMatchdays = buildCompletedMatchdays(bundle.matchdays, bundle.matches);
      allStandings = buildStandings(
        bundle.players,
        bundle.assignments,
        bundle.playerStats,
        completedMatchdays,
        selectedSeason
      );
      playerDetailsMap = buildPlayerMatchdayDetails(
        bundle.players,
        bundle.assignments,
        bundle.playerStats,
        completedMatchdays
      );

      ensureSelectedPlayerStillVisible();
      if (!selectedPlayerId) {
        selectedPlayerId = allPlayers[0]?.id || null;
      }

      updateSummaryStats(true);
      renderRoster();
      renderDetail();
      refreshMotion(playerList);
      refreshMotion(playerDetail);
      pulseSurface(playerList, "goal-flash");

      statusLine.classList.remove("loading", "error", "warning");
      statusLine.classList.add("success");
      statusText.textContent = `${selectedSeason.name} · ${allPlayers.length} players loaded`;
      pulseSurface(statusLine);
    } catch (error) {
      const message = readableError(error);
      statusLine.classList.remove("loading", "success", "warning");
      statusLine.classList.add("error");
      statusText.textContent = message;
      playerList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      playerDetail.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", (event) => {
      playFeedback(event.currentTarget, {
        className: "ball-tap",
        vibrationPattern: 8,
      });

      const filterType = event.currentTarget.dataset.filter;
      const filterValue = event.currentTarget.dataset.value;

      document.querySelectorAll(`[data-filter="${filterType}"]`).forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.value === filterValue);
      });

      if (filterType === "position") {
        positionFilter = filterValue;
      } else if (filterType === "tier") {
        tierFilter = filterValue;
      }

      ensureSelectedPlayerStillVisible();
      renderRoster();
      renderDetail();
      refreshMotion(playerList);
      refreshMotion(playerDetail);
    });
  });

  rosterSearch.addEventListener("input", () => {
    ensureSelectedPlayerStillVisible();
    renderRoster();
    renderDetail();
  });

  playerList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-player-id]");
    if (!item) {
      return;
    }

    playFeedback(item, {
      className: "ball-tap",
      vibrationPattern: [10, 22, 12],
    });

    selectedPlayerId = Number(item.dataset.playerId);
    renderRoster();
    renderDetail();
    refreshMotion(playerDetail);
    pulseSurface(playerDetail, "lineup-lock");
  });

  seasonSelect.addEventListener("change", async () => {
    playFeedback(seasonSelect, {
      className: "ball-tap",
      vibrationPattern: 10,
    });

    activeSeasonId = Number(seasonSelect.value) || null;
    await loadSeason();
  });

  try {
    seasons = await fetchSeasons();
    await loadSeason();
  } catch (error) {
    const message = readableError(error);
    seasonSelect.innerHTML = '<option value="">Season unavailable</option>';
    seasonSelect.disabled = true;
    statusLine.classList.remove("loading", "success", "warning");
    statusLine.classList.add("error");
    statusText.textContent = message;
    playerList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    playerDetail.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }
});
