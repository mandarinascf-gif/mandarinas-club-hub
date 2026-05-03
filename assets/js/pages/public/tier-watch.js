document.addEventListener("DOMContentLoaded", () => {
  if (!window.MandarinasPublic) {
    document.getElementById("tier-status-line").textContent =
      "MandarinasPublic failed to load. Check browser console (F12) for errors.";
    return;
  }

  const {
    escapeHtml,
    fullName,
    stripSubPrefix,
    normalizeTierValue,
    readableError,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const logic = window.MandarinasLogic || {};
  const buildStandingsByPlayerId =
    logic.buildStandingsByPlayerId || (() => new Map());
  const rotationQueueMode = logic.rotationQueueMode || (() => "regular");
  const buildRotationQueueRows =
    logic.buildRotationQueueRows ||
    ((rows) => [...(rows || [])].filter((row) => row.tier_status === "flex" && row.is_eligible));

  const seasonSelect = document.getElementById("season-select");
  const queueSearch = document.getElementById("queue-search");
  const heroCopy = document.getElementById("hero-copy");
  const queueSpotlightCopy = document.getElementById("queue-spotlight-copy");
  const queueSpotlight = document.getElementById("queue-spotlight");
  const queueFlexCount = document.getElementById("queue-flex-count");
  const queueEligibleCount = document.getElementById("queue-eligible-count");
  const queueModeLabel = document.getElementById("queue-mode-label");
  const queueModeCopy = document.getElementById("queue-mode-copy");
  const queueCycleLabel = document.getElementById("queue-cycle-label");
  const queueCycleCopy = document.getElementById("queue-cycle-copy");
  const queueTableCopy = document.getElementById("queue-table-copy");
  const tierStatusLine = document.getElementById("tier-status-line");
  const queueTableWrap = document.getElementById("queue-table-wrap");

  let seasons = [];
  let activeSeasonId = querySeasonIdFromUrl();
  let tierRows = [];
  let seasonRosterPlayers = [];
  let standingsByPlayerId = new Map();
  let activeQueueMode = "regular";

  function setTierStatus(message = "", tone = "") {
    tierStatusLine.classList.remove("loading", "warning", "error", "success");

    if (!message) {
      tierStatusLine.hidden = true;
      tierStatusLine.textContent = "";
      return;
    }

    tierStatusLine.hidden = false;
    tierStatusLine.textContent = message;

    if (tone) {
      tierStatusLine.classList.add(tone);
    }
  }

  function registrationTier(row) {
    return normalizeTierValue(
      row?.registration_tier || row?.tier_status || row?.season_status || row?.default_status,
      "sub"
    );
  }

  function normalizeTierRow(row) {
    if (!row) {
      return row;
    }

    const defaultStatus = normalizeTierValue(row.default_status, "sub");
    const tierStatus = normalizeTierValue(row.tier_status, defaultStatus);

    return {
      ...row,
      default_status: defaultStatus,
      tier_status: tierStatus,
      registration_tier: normalizeTierValue(row.registration_tier, defaultStatus),
    };
  }

  function displayName(row) {
    return stripSubPrefix(row.nickname) || fullName(row);
  }

  function queueVisibleLimit() {
    return window.matchMedia("(max-width: 719px)").matches ? 5 : 7;
  }

  function queueGoalKeeps(row) {
    return Number(row?.goal_keeps ?? row?.goal_keep_points_earned ?? row?.goalie_points ?? 0);
  }

  function queueRowsMatching(rows, selector, value) {
    return (rows || []).filter((entry) => selector(entry) === value);
  }

  function queuePositionLabel(position) {
    if (position === 1) {
      return "Next up";
    }
    if (position === 2) {
      return "On deck";
    }
    if (position === 3) {
      return "After that";
    }
    return `#${position} in line`;
  }

  function queueRuleSummary(mode = activeQueueMode) {
    return mode === "final"
      ? "Final matchday mode is active. Season points lead the line, then goals, goal keeps, and clean sheets."
      : "Regular queue mode is active. Fewer season appearances stay in front, then season points, goals, goal keeps, and clean sheets break ties.";
  }

  function formatQueueReason(row, queueRows) {
    const attended = Number(row?.games_attended || 0);
    const totalPoints = Number(row?.total_points || 0);
    const goals = Number(row?.goals || 0);
    const goalKeeps = queueGoalKeeps(row);
    const cleanSheets = Number(row?.clean_sheets || 0);
    const noShows = Number(row?.no_shows || 0);
    const lateCancels = Number(row?.late_cancels || 0);
    const queueMode = row?.rotation_queue_mode || activeQueueMode;

    if (queueMode === "final") {
      const samePoints = queueRowsMatching(
        queueRows,
        (entry) => Number(entry?.total_points || 0),
        totalPoints
      );

      if (samePoints.length === 1) {
        return `${totalPoints} point${totalPoints === 1 ? "" : "s"} puts them here.`;
      }

      const samePointsGoals = queueRowsMatching(
        samePoints,
        (entry) => Number(entry?.goals || 0),
        goals
      );

      if (samePointsGoals.length === 1) {
        return "Tied on points, ahead on goals.";
      }

      const samePointsGoalKeeps = queueRowsMatching(samePointsGoals, queueGoalKeeps, goalKeeps);

      if (samePointsGoalKeeps.length === 1) {
        return "Tied on points and goals, ahead on goal keeps.";
      }

      const samePointsCleanSheets = queueRowsMatching(
        samePointsGoalKeeps,
        (entry) => Number(entry?.clean_sheets || 0),
        cleanSheets
      );

      if (samePointsCleanSheets.length === 1) {
        return "Tied on points, goals, and goal keeps, ahead on clean sheets.";
      }

      return "Tied on points; later season totals decide order.";
    }

    const sameAttendance = queueRowsMatching(
      queueRows,
      (entry) => Number(entry?.games_attended || 0),
      attended
    );

    if (sameAttendance.length === 1) {
      return attended === 0
        ? "Fewest appearances so far."
        : `${attended} appearance${attended === 1 ? "" : "s"} so far.`;
    }

    const sameAttendancePoints = sameAttendance.filter(
      (entry) => Number(entry?.total_points || 0) === totalPoints
    );

    if (sameAttendancePoints.length === 1) {
      return "Tied on appearances, ahead on points.";
    }

    const sameAttendancePointsGoals = queueRowsMatching(
      sameAttendancePoints,
      (entry) => Number(entry?.goals || 0),
      goals
    );

    if (sameAttendancePointsGoals.length === 1) {
      return "Tied on appearances and points, ahead on goals.";
    }

    const sameAttendancePointsGoalKeeps = queueRowsMatching(
      sameAttendancePointsGoals,
      queueGoalKeeps,
      goalKeeps
    );

    if (sameAttendancePointsGoalKeeps.length === 1) {
      return "Tied on appearances, points, and goals, ahead on goal keeps.";
    }

    const sameAttendancePointsCleanSheets = queueRowsMatching(
      sameAttendancePointsGoalKeeps,
      (entry) => Number(entry?.clean_sheets || 0),
      cleanSheets
    );

    if (sameAttendancePointsCleanSheets.length === 1) {
      return "Tied on appearances, points, goals, and goal keeps, ahead on clean sheets.";
    }

    const sameNoShows = sameAttendancePointsCleanSheets.filter(
      (entry) => Number(entry?.no_shows || 0) === noShows
    );

    if (sameNoShows.length === 1) {
      return "Tied on results, fewer no-shows.";
    }

    const sameLateCancels = sameNoShows.filter(
      (entry) => Number(entry?.late_cancels || 0) === lateCancels
    );

    if (sameLateCancels.length === 1) {
      return "Tied on results, fewer late cancels.";
    }

    return attended === 0
      ? "Tied on appearances; later tiebreaks decide order."
      : `Tied on ${attended} appearances; later tiebreaks decide order.`;
  }

  function formatQueueMeta(row) {
    const attended = Number(row?.games_attended || 0);
    const totalPoints = Number(row?.total_points || 0);
    const goals = Number(row?.goals || 0);

    if ((row?.rotation_queue_mode || activeQueueMode) === "final") {
      return `${totalPoints} pts · ${goals} goal${goals === 1 ? "" : "s"}`;
    }

    return `${attended} attended${totalPoints > 0 ? ` · ${totalPoints} pts` : ""}`;
  }

  function queueSearchQuery() {
    return String(queueSearch.value || "").trim();
  }

  function filteredQueueRows(queueRows) {
    const query = queueSearchQuery().toLowerCase();

    if (!query) {
      return queueRows;
    }

    return queueRows.filter((row) =>
      [displayName(row), fullName(row), row.nickname || ""].join(" ").toLowerCase().includes(query)
    );
  }

  function renderSeasonOptions() {
    seasonSelect.innerHTML = seasons
      .map(
        (season) =>
          `<option value="${season.id}" ${
            season.id === activeSeasonId ? "selected" : ""
          }>${escapeHtml(season.name)}</option>`
      )
      .join("");
  }

  function updateSeasonUrl(seasonId) {
    const url = new URL(window.location.href);
    url.searchParams.set("season_id", seasonId);
    window.history.replaceState({}, "", url);
  }

  function renderSummary(queueRows) {
    const flexRegisteredCount = seasonRosterPlayers.filter(
      (row) => registrationTier(row) === "flex"
    ).length;

    queueFlexCount.textContent = String(flexRegisteredCount);
    queueEligibleCount.textContent = String(queueRows.length);
    queueModeLabel.textContent = activeQueueMode === "final" ? "Points first" : "Fewest games";
    queueModeCopy.textContent =
      activeQueueMode === "final"
        ? "Final matchday mode is active for this season."
        : "Lower season attendance stays closer to the front.";

    if (queueRows.length) {
      queueCycleLabel.textContent = "Back of line";
      queueCycleCopy.textContent =
        "After you play, your next turn starts behind the players still waiting.";
      return;
    }

    queueCycleLabel.textContent = "No line yet";
    queueCycleCopy.textContent =
      "The queue appears once flex players are eligible for the selected season.";
  }

  function renderQueueSpotlight(queueRows) {
    if (!queueRows.length) {
      queueSpotlightCopy.textContent =
        "The queue will appear once flex players are registered and eligible for the selected season.";
      queueSpotlight.innerHTML = `<div class="empty-state">No flex players are in line yet.</div>`;
      return;
    }

    queueSpotlightCopy.textContent = queueRuleSummary();
    queueSpotlight.innerHTML = queueRows
      .slice(0, 3)
      .map((row, index) => {
        const position = index + 1;

        return `
          <article class="queue-top-card ${position === 1 ? "queue-top-card-primary" : ""}">
            <div class="queue-top-step">${escapeHtml(queuePositionLabel(position))}</div>
            <h3 class="queue-top-name">${escapeHtml(displayName(row))}</h3>
            ${
              row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                ? `<div class="table-player-sub">${escapeHtml(fullName(row))}</div>`
                : ""
            }
            <div class="compact-badges">
              <span class="queue-pill">#${escapeHtml(String(position))}</span>
              <span class="status-pill flex">${escapeHtml(formatQueueMeta(row))}</span>
            </div>
            <p class="queue-top-copy">${escapeHtml(formatQueueReason(row, queueRows))}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderQueueRows(rows, queueRows, queueMap) {
    return rows
      .map((row) => {
        const queuePosition = queueMap.get(row.player_id);
        const isNext = queuePosition === 1;

        return `
          <article class="queue-compact-row ${isNext ? "queue-compact-row-top" : ""}">
            <div class="queue-compact-rank">
              <span class="queue-pill">${escapeHtml(String(queuePosition))}</span>
            </div>
            <div class="queue-compact-main">
              <div class="queue-compact-heading">
                <div class="queue-compact-line">
                  <h3 class="queue-compact-name">${escapeHtml(displayName(row))}</h3>
                  <span class="queue-compact-meta">${escapeHtml(queuePositionLabel(queuePosition))}</span>
                </div>
                <div class="compact-badges">
                  <span class="status-pill flex">${escapeHtml(formatQueueMeta(row))}</span>
                  <span class="status-pill ${activeQueueMode === "final" ? "core" : "sub"}">
                    ${escapeHtml(activeQueueMode === "final" ? "Final matchday rule" : "Regular queue rule")}
                  </span>
                </div>
              </div>
              ${
                row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                  ? `<div class="table-player-sub">${escapeHtml(fullName(row))}</div>`
                  : ""
              }
              <p class="queue-compact-reason">${escapeHtml(formatQueueReason(row, queueRows))}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderQueue() {
    const queueRows = buildRotationQueueRows(tierRows, {
      standingsByPlayerId,
      finalMatchday: activeQueueMode === "final",
    });
    const queueMap = new Map(queueRows.map((row, index) => [row.player_id, index + 1]));
    const rawQuery = queueSearchQuery();
    const filteredRows = filteredQueueRows(queueRows);

    renderSummary(queueRows);
    renderQueueSpotlight(queueRows);

    if (!queueRows.length) {
      queueTableCopy.textContent =
        "This line updates when flex players are registered and marked eligible for the selected season.";
      queueTableWrap.innerHTML = `
        <div class="empty-state">No flex players are in the queue yet. Players appear here once the season starts.</div>
      `;
      return;
    }

    if (rawQuery) {
      queueTableCopy.textContent = `Showing matches for "${rawQuery}". Queue numbers stay the same even while the list is filtered.`;
    } else {
      queueTableCopy.textContent =
        "Search for your name or read from the top down. Lower number means you are closer to the next spot.";
    }

    if (!filteredRows.length) {
      queueTableWrap.innerHTML = `<div class="empty-state">No flex queue matches for "${escapeHtml(
        rawQuery
      )}". Only eligible flex players appear here.</div>`;
      return;
    }

    const visibleRows = rawQuery ? filteredRows : filteredRows.slice(0, queueVisibleLimit());
    const hiddenRows = rawQuery ? [] : filteredRows.slice(visibleRows.length);

    queueTableWrap.innerHTML = `
      <div class="queue-compact-table">
        ${renderQueueRows(visibleRows, queueRows, queueMap)}
      </div>
      ${
        hiddenRows.length
          ? `
            <details class="disclosure-card queue-disclosure">
              <summary class="disclosure-summary">
                <div class="disclosure-copy">
                  <div class="disclosure-title">Show full line</div>
                  <div class="manual-note">${hiddenRows.length} more player${
                    hiddenRows.length === 1 ? "" : "s"
                  } waiting</div>
                </div>
              </summary>
              <div class="disclosure-body">
                <div class="queue-compact-table">
                  ${renderQueueRows(hiddenRows, queueRows, queueMap)}
                </div>
              </div>
            </details>
          `
          : ""
      }
    `;
  }

  async function loadSeason() {
    setTierStatus("Loading the flex queue...", "loading");
    queueSpotlight.innerHTML = `<div class="empty-state">Loading the flex queue...</div>`;
    queueTableWrap.innerHTML = "";

    try {
      const bundle = await fetchSeasonBundle(activeSeasonId);

      standingsByPlayerId = buildStandingsByPlayerId(
        bundle.players || [],
        bundle.assignments || [],
        bundle.playerStats || [],
        bundle.matchdays || [],
        bundle.matches || [],
        bundle.season || null
      );
      seasonRosterPlayers = bundle.players || [];
      activeQueueMode = rotationQueueMode(
        bundle.season || null,
        bundle.matchdays || [],
        bundle.matches || []
      );
      tierRows = (bundle.tiers || []).map((row) => normalizeTierRow(row));

      const seasonName = bundle.season?.name || "This season";
      heroCopy.textContent =
        activeQueueMode === "final"
          ? `${seasonName} is in final-matchday queue mode. Highest season points lead the flex line, then goals, goal keeps, and clean sheets.`
          : `${seasonName} is using the standard flex queue. Players with fewer season appearances stay in front, and tied players are split by season points, goals, goal keeps, and clean sheets.`;

      renderQueue();
      setTierStatus();
    } catch (error) {
      seasonRosterPlayers = [];
      standingsByPlayerId = new Map();
      activeQueueMode = "regular";
      tierRows = [];

      const message = readableError(error);
      renderSummary([]);
      renderQueueSpotlight([]);
      setTierStatus(message, "error");
      queueTableWrap.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  async function init() {
    try {
      seasons = await fetchSeasons();
      const selected = pickSeason(seasons, activeSeasonId);

      if (!selected) {
        setTierStatus("No season found.", "warning");
        return;
      }

      activeSeasonId = selected.id;
      renderSeasonOptions();
      updateSeasonUrl(activeSeasonId);
      await loadSeason();
    } catch (error) {
      setTierStatus(readableError(error), "error");
    }
  }

  seasonSelect.addEventListener("change", async () => {
    activeSeasonId = Number(seasonSelect.value);
    updateSeasonUrl(activeSeasonId);
    await loadSeason();
  });

  queueSearch.addEventListener("input", () => renderQueue());

  window.addEventListener("resize", () => {
    renderQueue();
  });

  init();
});
