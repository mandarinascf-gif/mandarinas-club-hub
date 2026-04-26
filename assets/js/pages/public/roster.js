document.addEventListener("DOMContentLoaded", async () => {
  if (!window.MandarinasPublic) {
    const msg = "MandarinasPublic failed to load. Check browser console for script errors.";
    document.getElementById("status-text").textContent = msg;
    console.error("[MandarinasPublic] Fatal:", msg);
    return;
  }

  const supabaseClient = window.MandarinasSupabaseConfig.createClient();
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
  const rosterRequestCopy = document.getElementById("roster-request-copy");
  const rosterRequestStatus = document.getElementById("roster-request-status");
  const existingRequestForm = document.getElementById("roster-existing-request-form");
  const existingDirectoryPlayerSelect = document.getElementById("roster-request-directory-player");
  const existingTierSelect = document.getElementById("roster-request-existing-tier");
  const existingContactInput = document.getElementById("roster-request-existing-contact");
  const existingNoteInput = document.getElementById("roster-request-existing-note");
  const existingRequestButton = document.getElementById("roster-request-existing-button");
  const newRequestForm = document.getElementById("roster-new-request-form");
  const newFirstNameInput = document.getElementById("roster-request-first-name");
  const newLastNameInput = document.getElementById("roster-request-last-name");
  const newNicknameInput = document.getElementById("roster-request-nickname");
  const newNationalityInput = document.getElementById("roster-request-nationality");
  const newPositionSelect = document.getElementById("roster-request-position");
  const newTierSelect = document.getElementById("roster-request-new-tier");
  const newContactInput = document.getElementById("roster-request-contact");
  const newNoteInput = document.getElementById("roster-request-note");
  const newRequestButton = document.getElementById("roster-request-new-button");

  let seasons = [];
  let activeSeasonId = querySeasonIdFromUrl();
  let allPlayers = [];
  let allStandings = [];
  let playerDetailsMap = new Map();
  let directoryPlayers = [];
  let seasonRosterRequests = [];
  let rosterRequestsSupported = true;
  let positionFilter = "all";
  let tierFilter = "all";
  let selectedPlayerId = null;

  function hasMissingDesiredTierColumn(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      (message.includes("column") || message.includes("schema cache")) &&
      message.includes("desired_tier")
    );
  }

  function hasMissingRosterRequestTable(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("season_roster_requests") &&
      (
        message.includes("relation") ||
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find")
      )
    );
  }

  function normalizeDirectoryPlayer(player) {
    const desiredTier = normalizeText(player?.desired_tier || player?.status || "rotation").toLowerCase();
    return {
      ...player,
      desired_tier: desiredTier,
      status: desiredTier,
      positions: Array.isArray(player?.positions) && player.positions.length ? player.positions : ["MID"],
    };
  }

  function normalizeRosterRequestRow(row) {
    return {
      ...row,
      request_type: normalizeText(row?.request_type || "directory").toLowerCase(),
      requester_name: normalizeText(row?.requester_name || ""),
      requester_contact: normalizeText(row?.requester_contact || ""),
      first_name: normalizeText(row?.first_name || ""),
      last_name: normalizeText(row?.last_name || ""),
      nickname: normalizeText(row?.nickname || ""),
      nationality: normalizeText(row?.nationality || ""),
      preferred_positions:
        Array.isArray(row?.preferred_positions) && row.preferred_positions.length
          ? row.preferred_positions.map((value) => normalizeText(value).toUpperCase())
          : ["MID"],
      requested_tier: normalizeText(row?.requested_tier || "rotation").toLowerCase(),
      status: normalizeText(row?.status || "pending").toLowerCase(),
      note: normalizeText(row?.note || ""),
    };
  }

  function setRosterRequestStatus(message, tone = "") {
    if (!rosterRequestStatus) {
      return;
    }

    rosterRequestStatus.hidden = !message;
    rosterRequestStatus.textContent = message || "";
    rosterRequestStatus.className = tone ? `status-line ${tone}` : "status-line";
  }

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

  function tierSortRank(status) {
    if (status === "core") {
      return 0;
    }
    if (status === "rotation") {
      return 1;
    }
    if (status === "flex_sub") {
      return 2;
    }
    return 3;
  }

  function comparePlayersForRoster(left, right) {
    const tierDifference = tierSortRank(left?.status) - tierSortRank(right?.status);
    if (tierDifference !== 0) {
      return tierDifference;
    }

    const displayDifference = playerDisplayName(left).localeCompare(playerDisplayName(right));
    if (displayDifference !== 0) {
      return displayDifference;
    }

    const leftFullName = `${left?.first_name || ""} ${left?.last_name || ""}`.trim();
    const rightFullName = `${right?.first_name || ""} ${right?.last_name || ""}`.trim();
    return leftFullName.localeCompare(rightFullName);
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
      .sort(comparePlayersForRoster);
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
              <a class="secondary-button" href="#player-detail">View</a>
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

  function updateSummaryStats() {
    totalPlayersEl.textContent = String(allPlayers.length);
    corePlayersEl.textContent = String(allPlayers.filter((player) => player.status === "core").length);
    rotationPlayersEl.textContent = String(
      allPlayers.filter((player) => player.status === "rotation").length
    );
  }

  function requestableDirectoryPlayers() {
    const rosterPlayerIds = new Set(allPlayers.map((player) => Number(player.id)));
    return directoryPlayers
      .filter((player) => !rosterPlayerIds.has(Number(player.id)))
      .sort(comparePlayersForRoster);
  }

  function pendingRequestsForSeason() {
    return seasonRosterRequests.filter(
      (row) => Number(row.season_id) === Number(activeSeasonId) && row.status === "pending"
    );
  }

  function findDirectoryPlayerByName(firstName, lastName) {
    const normalizedFirst = normalizeText(firstName).toLowerCase();
    const normalizedLast = normalizeText(lastName).toLowerCase();

    return (
      directoryPlayers.find(
        (player) =>
          normalizeText(player.first_name).toLowerCase() === normalizedFirst &&
          normalizeText(player.last_name).toLowerCase() === normalizedLast
      ) || null
    );
  }

  function setRequestInputsDisabled(disabled) {
    [
      existingDirectoryPlayerSelect,
      existingTierSelect,
      existingContactInput,
      existingNoteInput,
      existingRequestButton,
      newFirstNameInput,
      newLastNameInput,
      newNicknameInput,
      newNationalityInput,
      newPositionSelect,
      newTierSelect,
      newContactInput,
      newNoteInput,
      newRequestButton,
    ].forEach((element) => {
      if (element) {
        element.disabled = disabled;
      }
    });
  }

  function syncExistingRequestTierFromSelection() {
    const selectedPlayerIdValue = Number(existingDirectoryPlayerSelect.value);
    const player = requestableDirectoryPlayers().find((entry) => entry.id === selectedPlayerIdValue);
    const fallbackTier = player?.desired_tier || player?.status || "rotation";
    existingTierSelect.value = fallbackTier;
  }

  function resetNewRequestForm() {
    newRequestForm.reset();
    newPositionSelect.value = "MID";
    newTierSelect.value = "rotation";
  }

  function renderRosterRequestTools() {
    const selectedSeason = pickSeason(seasons, activeSeasonId);

    if (!selectedSeason) {
      directoryPlayers = [];
      seasonRosterRequests = [];
      existingDirectoryPlayerSelect.innerHTML =
        '<option value="">Select your name from the main directory</option>';
      rosterRequestCopy.textContent =
        "Launch a season first. Squad requests only open after a live season is available.";
      setRequestInputsDisabled(true);
      return;
    }

    if (!rosterRequestsSupported) {
      existingDirectoryPlayerSelect.innerHTML =
        '<option value="">Self-request tools are waiting for the latest club update</option>';
      rosterRequestCopy.textContent =
        "Self-request tools will open after the latest live club update adds squad request tracking.";
      setRequestInputsDisabled(true);
      return;
    }

    const addablePlayers = requestableDirectoryPlayers();
    const pendingRequests = pendingRequestsForSeason();
    const pendingPlayerIds = new Set(
      pendingRequests.filter((row) => row.player_id).map((row) => Number(row.player_id))
    );
    const availableDirectoryRequests = addablePlayers.filter(
      (player) => !pendingPlayerIds.has(Number(player.id))
    );

    rosterRequestCopy.textContent = `${selectedSeason.name} is using ${allPlayers.length} live squad players. If you are missing from this season but already live in the main directory, request your spot here. If you are new to the club, send a directory request first. Admin approval is required before your name reaches the live squad.`;

    if (!addablePlayers.length) {
      existingDirectoryPlayerSelect.innerHTML =
        '<option value="">Everyone in the main directory is already on this squad</option>';
    } else {
      existingDirectoryPlayerSelect.innerHTML = `
        <option value="">Select your name from the main directory</option>
        ${addablePlayers
          .map((player) => {
            const pending = pendingPlayerIds.has(Number(player.id));
            const pendingLabel = pending ? " · pending request" : "";
            return `<option value="${player.id}" ${pending ? "disabled" : ""}>${escapeHtml(
              playerDisplayName(player)
            )} · current/next-season ${escapeHtml(formatStatusLabel(player.status))}${escapeHtml(
              pendingLabel
            )}</option>`;
          })
          .join("")}
      `;
    }

    if (!availableDirectoryRequests.length) {
      existingDirectoryPlayerSelect.value = "";
    } else if (
      !availableDirectoryRequests.some(
        (player) => Number(player.id) === Number(existingDirectoryPlayerSelect.value)
      )
    ) {
      existingDirectoryPlayerSelect.value = String(availableDirectoryRequests[0].id);
    }

    syncExistingRequestTierFromSelection();
    setRequestInputsDisabled(false);
    existingDirectoryPlayerSelect.disabled = !addablePlayers.length;
    existingRequestButton.disabled = !availableDirectoryRequests.length;
  }

  async function loadDirectoryPlayers() {
    let { data, error } = await supabaseClient
      .from("players")
      .select("id, first_name, last_name, nickname, nationality, phone, positions, desired_tier, status")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error && hasMissingDesiredTierColumn(error)) {
      ({ data, error } = await supabaseClient
        .from("players")
        .select("id, first_name, last_name, nickname, nationality, phone, positions, status")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }));
    }

    if (error) {
      throw error;
    }

    directoryPlayers = (data || []).map(normalizeDirectoryPlayer);
  }

  async function loadSeasonRosterRequests() {
    if (!activeSeasonId || !rosterRequestsSupported) {
      seasonRosterRequests = [];
      return;
    }

    const { data, error } = await supabaseClient
      .from("season_roster_requests")
      .select(
        "id, season_id, player_id, request_type, requester_name, requester_contact, first_name, last_name, nickname, nationality, preferred_positions, requested_tier, note, status, created_at"
      )
      .eq("season_id", activeSeasonId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error && hasMissingRosterRequestTable(error)) {
      rosterRequestsSupported = false;
      seasonRosterRequests = [];
      return;
    }

    if (error) {
      throw error;
    }

    seasonRosterRequests = (data || []).map(normalizeRosterRequestRow);
  }

  async function loadSeason() {
    const selectedSeason = pickSeason(seasons, activeSeasonId);

    if (!selectedSeason) {
      seasonSelect.innerHTML = '<option value="">No seasons available</option>';
      seasonSelect.disabled = true;
      seasonNameEl.textContent = "-";
      allPlayers = [];
      allStandings = [];
      playerDetailsMap = new Map();
      selectedPlayerId = null;
      statusLine.classList.remove("loading", "success", "error");
      statusLine.classList.add("warning");
      statusText.textContent = "No seasons found.";
      playerList.innerHTML = '<div class="empty-state">No seasons are available yet.</div>';
      playerDetail.innerHTML = '<div class="empty-state">Launch a season to view the squad.</div>';
      updateSummaryStats();
      renderRosterRequestTools();
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

      updateSummaryStats();
      renderRoster();
      renderDetail();

      try {
        await Promise.all([loadDirectoryPlayers(), loadSeasonRosterRequests()]);
      } catch (requestSupportError) {
        directoryPlayers = [];
        seasonRosterRequests = [];
        setRosterRequestStatus(readableError(requestSupportError), "warning");
      }

      renderRosterRequestTools();

      statusLine.classList.remove("loading", "error", "warning");
      statusLine.classList.add("success");
      statusText.textContent = `${selectedSeason.name} · ${allPlayers.length} players loaded`;
    } catch (error) {
      const message = readableError(error);
      directoryPlayers = [];
      seasonRosterRequests = [];
      statusLine.classList.remove("loading", "success", "warning");
      statusLine.classList.add("error");
      statusText.textContent = message;
      playerList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      playerDetail.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      renderRosterRequestTools();
    }
  }

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", (event) => {
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

    selectedPlayerId = Number(item.dataset.playerId);
    renderRoster();
    renderDetail();
  });

  seasonSelect.addEventListener("change", async () => {
    activeSeasonId = Number(seasonSelect.value) || null;
    setRosterRequestStatus("");
    await loadSeason();
  });

  existingDirectoryPlayerSelect.addEventListener("change", () => {
    syncExistingRequestTierFromSelection();
  });

  existingRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!activeSeasonId) {
      setRosterRequestStatus("Choose a live season first.", "warning");
      return;
    }

    if (!rosterRequestsSupported) {
      setRosterRequestStatus(
        "Season squad requests are waiting for the latest club update.",
        "warning"
      );
      return;
    }

    const playerId = Number(existingDirectoryPlayerSelect.value);
    const player = directoryPlayers.find((entry) => Number(entry.id) === playerId);

    if (!playerId || !player) {
      setRosterRequestStatus("Choose your directory profile first.", "warning");
      return;
    }

    if (
      pendingRequestsForSeason().some((row) => Number(row.player_id) === Number(playerId) && row.status === "pending")
    ) {
      setRosterRequestStatus("A pending season request already exists for that directory player.", "warning");
      return;
    }

    existingRequestButton.disabled = true;
    existingRequestButton.textContent = "Sending...";
    setRosterRequestStatus(`Sending a season squad request for ${playerDisplayName(player)}...`);

    const { error } = await supabaseClient.from("season_roster_requests").insert({
      season_id: activeSeasonId,
      player_id: player.id,
      request_type: "directory",
      requester_name: playerDisplayName(player),
      requester_contact: normalizeText(existingContactInput.value || player.phone || "") || null,
      first_name: player.first_name,
      last_name: player.last_name,
      nickname: normalizeText(player.nickname || "") || null,
      nationality: player.nationality,
      preferred_positions: Array.isArray(player.positions) && player.positions.length ? player.positions : ["MID"],
      requested_tier: normalizeText(existingTierSelect.value || player.status || "rotation").toLowerCase(),
      note: normalizeText(existingNoteInput.value) || null,
      status: "pending",
    });

    existingRequestButton.disabled = false;
    existingRequestButton.textContent = "Request season squad spot";

    if (error) {
      setRosterRequestStatus(readableError(error), "error");
      return;
    }

    existingContactInput.value = "";
    existingNoteInput.value = "";
    await loadSeasonRosterRequests();
    renderRosterRequestTools();
    setRosterRequestStatus(
      `${playerDisplayName(player)} was sent to the busses for season squad approval.`,
      "success"
    );
  });

  newRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!activeSeasonId) {
      setRosterRequestStatus("Choose a live season first.", "warning");
      return;
    }

    if (!rosterRequestsSupported) {
      setRosterRequestStatus(
        "Season squad requests are waiting for the latest club update.",
        "warning"
      );
      return;
    }

    const firstName = normalizeText(newFirstNameInput.value);
    const lastName = normalizeText(newLastNameInput.value);
    const nickname = normalizeText(newNicknameInput.value);
    const nationality = normalizeText(newNationalityInput.value);
    const contact = normalizeText(newContactInput.value);
    const requestedTier = normalizeText(newTierSelect.value || "rotation").toLowerCase();
    const position = normalizeText(newPositionSelect.value || "MID").toUpperCase();
    const note = normalizeText(newNoteInput.value);
    const requesterName = normalizeText(`${firstName} ${lastName}`);

    if (!firstName || !lastName || !nationality || !contact) {
      setRosterRequestStatus("Add your name, nationality, and contact before requesting directory review.", "warning");
      return;
    }

    const existingDirectoryPlayer = findDirectoryPlayerByName(firstName, lastName);
    if (existingDirectoryPlayer) {
      setRosterRequestStatus(
        `${playerDisplayName(existingDirectoryPlayer)} is already in the main directory. Use the directory profile request above instead.`,
        "warning"
      );
      return;
    }

    if (
      pendingRequestsForSeason().some(
        (row) =>
          row.player_id == null &&
          normalizeText(row.first_name).toLowerCase() === firstName.toLowerCase() &&
          normalizeText(row.last_name).toLowerCase() === lastName.toLowerCase()
      )
    ) {
      setRosterRequestStatus("A pending directory request already exists for that name.", "warning");
      return;
    }

    newRequestButton.disabled = true;
    newRequestButton.textContent = "Sending...";
    setRosterRequestStatus(`Sending a directory review for ${requesterName}...`);

    const { error } = await supabaseClient.from("season_roster_requests").insert({
      season_id: activeSeasonId,
      player_id: null,
      request_type: "new_directory",
      requester_name: requesterName,
      requester_contact: contact,
      first_name: firstName,
      last_name: lastName,
      nickname: nickname || null,
      nationality,
      preferred_positions: [position],
      requested_tier: requestedTier,
      note: note || null,
      status: "pending",
    });

    newRequestButton.disabled = false;
    newRequestButton.textContent = "Request directory + season review";

    if (error) {
      setRosterRequestStatus(readableError(error), "error");
      return;
    }

    resetNewRequestForm();
    await loadSeasonRosterRequests();
    renderRosterRequestTools();
    setRosterRequestStatus(
      `${requesterName} was sent to the busses for directory and season review.`,
      "success"
    );
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
    renderRosterRequestTools();
  }
});
