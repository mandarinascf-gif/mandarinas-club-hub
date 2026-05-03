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
    formatStatusLabel,
    normalizeTierValue,
    tierIconMarkup,
    trendIconMarkup,
    readableError,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    fetchHistoricalTierAttendance,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const logic = window.MandarinasLogic || {};
  const suggestionSlotLimit = logic.TIER_SUGGESTION_SLOT_LIMIT || 36;
  const summarizeHistoricalAttendance =
    logic.summarizeHistoricalAttendance || ((rows) => [...(rows || [])]);
  const buildStandingsByPlayerId =
    logic.buildStandingsByPlayerId || (() => new Map());
  const rotationQueueMode = logic.rotationQueueMode || (() => "regular");
  const buildRotationQueueRows =
    logic.buildRotationQueueRows ||
    ((rows) => [...(rows || [])].filter((row) => row.tier_status === "flex" && row.is_eligible));
  const applyTierSuggestionSlots = logic.applyTierSuggestionSlots || ((rows) => [...(rows || [])]);
  const tierSuggestionEvidence =
    logic.tierSuggestionEvidence || ((row) => row?.suggestion_evidence || "");

  const seasonSelect = document.getElementById("season-select");
  const heroCopy = document.getElementById("hero-copy");
  const spotMixCount = document.getElementById("spot-mix-count");
  const coreCount = document.getElementById("core-count");
  const rotationCount = document.getElementById("rotation-count");
  const flexCount = document.getElementById("flex-count");
  const changeCount = document.getElementById("change-count");
  const tierStatusLine = document.getElementById("tier-status-line");
  const queueTableWrap = document.getElementById("queue-table-wrap");
  const suggestionPanelCopy = document.getElementById("suggestion-panel-copy");
  const suggestionSummaryPills = document.getElementById("suggestion-summary-pills");
  const openSuggestionModalButton = document.getElementById("open-tier-suggestion-modal");
  const suggestionModal = document.getElementById("tier-suggestion-modal");
  const suggestionModalCopy = document.getElementById("tier-suggestion-modal-copy");
  const suggestionTableSummary = document.getElementById("tier-table-summary");
  const suggestionTableWrap = document.getElementById("tier-table-wrap");
  const tierFilterRow = document.getElementById("tier-filter-row");
  const tierSearch = document.getElementById("tier-search");
  const detailModal = document.getElementById("tier-detail-modal");

  const TIER_ORDER = Object.freeze({ core: 0, flex: 1, sub: 2 });
  const DEFAULT_SORT_DIRECTIONS = Object.freeze({
    player: "asc",
    current: "asc",
    suggested: "asc",
    spot: "desc",
    att: "desc",
    score: "desc",
    recent: "desc",
    hist: "desc",
  });

  let seasons = [];
  let activeSeasonId = querySeasonIdFromUrl();
  let tierRows = [];
  let seasonRosterPlayers = [];
  let activeFilter = "all";
  let sortCol = "suggested";
  let sortDir = DEFAULT_SORT_DIRECTIONS.suggested;
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

  function currentTier(row) {
    return normalizeTierValue(row?.tier_status || row?.default_status, "sub");
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
    const preliminarySuggestedStatus = normalizeTierValue(
      row.preliminary_recommended_tier_status || row.recommended_tier_status,
      tierStatus
    );

    return {
      ...row,
      default_status: defaultStatus,
      tier_status: tierStatus,
      recommended_tier_status: normalizeTierValue(
        row.recommended_tier_status,
        preliminarySuggestedStatus
      ),
      preliminary_recommended_tier_status: preliminarySuggestedStatus,
    };
  }

  function displayName(row) {
    return stripSubPrefix(row.nickname) || fullName(row);
  }

  function formatSpotValue(value) {
    const numeric = Number(value || 0);
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
  }

  function trendClass(trend) {
    if (trend === "up") {
      return "move-up";
    }
    if (trend === "down") {
      return "move-down";
    }
    return "move-stay";
  }

  function trendLabel(trend) {
    if (trend === "up") {
      return "Move up";
    }
    if (trend === "down") {
      return "Move down";
    }
    return "Stay put";
  }

  function movementPill(trend) {
    return `<span class="move-badge ${trendClass(trend)}">${trendIconMarkup(trend)}<span>${escapeHtml(
      trendLabel(trend)
    )}</span></span>`;
  }

  function tierPill(status) {
    return `<span class="tier-pill ${escapeHtml(status)}">${tierIconMarkup(status)}<span>${escapeHtml(
      formatStatusLabel(status)
    )}</span></span>`;
  }

  function suggestionEvidenceText(row) {
    return row?.suggestion_evidence || tierSuggestionEvidence(row) || "Attendance evidence unavailable.";
  }

  function suggestionCounts(rows = tierRows) {
    return rows.reduce(
      (counts, row) => {
        const trend = row?.trend || "steady";
        counts.total += 1;

        if (currentTier(row) !== row.recommended_tier_status) {
          counts.changes += 1;
        }

        if (trend === "up") {
          counts.up += 1;
        } else if (trend === "down") {
          counts.down += 1;
        } else {
          counts.steady += 1;
        }

        return counts;
      },
      { total: 0, changes: 0, up: 0, steady: 0, down: 0 }
    );
  }

  function suggestionSummaryPillsMarkup(counts, rows = tierRows) {
    const spotMixUsed = rows.reduce(
      (total, row) => total + Number(row.suggestion_spot_value || 0),
      0
    );

    return `
      <div class="summary-pill">
        <strong>${escapeHtml(counts.changes)}</strong>
        <span>Changes</span>
      </div>
      <div class="summary-pill">
        <strong>${escapeHtml(counts.up)}</strong>
        <span>Move up</span>
      </div>
      <div class="summary-pill">
        <strong>${escapeHtml(counts.steady)}</strong>
        <span>Hold</span>
      </div>
      <div class="summary-pill">
        <strong>${escapeHtml(counts.down)}</strong>
        <span>Move down</span>
      </div>
      <div class="summary-pill">
        <strong>${escapeHtml(formatSpotValue(spotMixUsed))} / ${escapeHtml(
          formatSpotValue(suggestionSlotLimit)
        )}</strong>
        <span>Plan fill</span>
      </div>
    `;
  }

  function reliabilityLine(row) {
    const noShows = Number(row?.no_shows || 0);
    const lateCancels = Number(row?.late_cancels || 0);
    const flags = [];

    if (noShows > 0) {
      flags.push(`${noShows} no-show${noShows === 1 ? "" : "s"}`);
    }
    if (lateCancels > 0) {
      flags.push(`${lateCancels} late cancel${lateCancels === 1 ? "" : "s"}`);
    }

    return flags.length ? `${flags.join(", ")} this season` : "No no-shows or late cancels this season";
  }

  function renderSuggestionCards(rows) {
    return `
      <div class="standings-card-list">
        ${rows
          .map((row, index) => {
            const recentGames = Number(row.recent_games_attended || 0);
            const evidenceText = suggestionEvidenceText(row);

            return `
              <article class="standings-card">
                <header class="standings-card-head">
                  <div class="standings-rank-badge">${escapeHtml(index + 1)}</div>
                  <div class="standings-card-title">
                    <div class="player-main">${escapeHtml(displayName(row))}</div>
                    ${
                      row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                        ? `<div class="table-player-sub">${escapeHtml(fullName(row))}</div>`
                        : ""
                    }
                  </div>
                </header>
                <div class="compact-badges">
                  <span class="status-pill ${escapeHtml(currentTier(row))}">Now: ${escapeHtml(
                    formatStatusLabel(currentTier(row))
                  )}</span>
                  ${movementPill(row.trend || "steady")}
                  <span class="status-pill ${escapeHtml(row.recommended_tier_status)}">Suggested next: ${escapeHtml(
                    formatStatusLabel(row.recommended_tier_status)
                  )}</span>
                </div>
                <div class="standings-metrics">
                  <div class="metric-pill"><span>Last 8</span><strong>${escapeHtml(recentGames)} / 8</strong></div>
                  <div class="metric-pill"><span>Season games</span><strong>${escapeHtml(row.games_attended)}</strong></div>
                  <div class="metric-pill"><span>Season score</span><strong>${escapeHtml(row.attendance_score)}</strong></div>
                  <div class="metric-pill"><span>All-time score</span><strong>${escapeHtml(row.historical_attendance_score || 0)}</strong></div>
                </div>
                <div class="detail-list">
                  <div class="detail-item">
                    <span class="detail-label">Why the app leans here</span>
                    <strong>${escapeHtml(row.transparency_note || "No summary note yet.")}</strong>
                    <span class="tier-evidence">${escapeHtml(evidenceText)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">What helps next</span>
                    <strong>${escapeHtml(row.next_step || "Keep showing up consistently.")}</strong>
                    <span class="tier-evidence">${escapeHtml(reliabilityLine(row))}</span>
                  </div>
                </div>
                <div class="actions">
                  <button
                    class="secondary-button table-action-button"
                    type="button"
                    data-detail-id="${escapeHtml(row.player_id)}"
                  >
                    Full breakdown
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
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

  function renderQueueRows(rows, queueRows, queueMap, labelPrefix = "#") {
    return rows
      .map((row) => {
        const queuePosition = queueMap.get(row.player_id);
        const attended = Number(row?.games_attended || 0);
        const isNext = queuePosition === 1;
        const positionLabel = isNext ? "Next up" : `#${queuePosition} in line`;

        return `
          <article class="queue-compact-row ${isNext ? "queue-compact-row-top" : ""}">
            <div class="queue-compact-rank">
              <span class="queue-pill">${escapeHtml(String(queuePosition))}</span>
            </div>
            <div class="queue-compact-main">
              <div class="queue-compact-line">
                <h3 class="queue-compact-name">${escapeHtml(displayName(row))}</h3>
                <span class="queue-compact-meta">${escapeHtml(positionLabel)}</span>
              </div>
              ${
                isNext
                  ? '<div class="queue-compact-eyebrow">Gets the next open spot</div>'
                  : ""
              }
              ${
                row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                  ? `<div class="table-player-sub">${escapeHtml(fullName(row))}</div>`
                  : ""
              }
              <p class="queue-compact-reason">${escapeHtml(
                attended === 0
                  ? "Hasn't played yet this season"
                  : `${attended} game${attended === 1 ? "" : "s"} played this season`
              )}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function suggestionComparator(left, right) {
    const leftSuggested = TIER_ORDER[left.recommended_tier_status] ?? 99;
    const rightSuggested = TIER_ORDER[right.recommended_tier_status] ?? 99;
    if (leftSuggested !== rightSuggested) {
      return leftSuggested - rightSuggested;
    }

    const leftSpot = Number(left.suggestion_spot_value || 0);
    const rightSpot = Number(right.suggestion_spot_value || 0);
    if (rightSpot !== leftSpot) {
      return rightSpot - leftSpot;
    }

    const leftRank = Number(left.suggestion_slot_rank || 0);
    const rightRank = Number(right.suggestion_slot_rank || 0);
    if (leftRank > 0 && rightRank > 0 && leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftRecent = Number(left.recent_attendance_score || 0);
    const rightRecent = Number(right.recent_attendance_score || 0);
    if (rightRecent !== leftRecent) {
      return rightRecent - leftRecent;
    }

    const leftScore = Number(left.attendance_score || 0);
    const rightScore = Number(right.attendance_score || 0);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const leftGames = Number(left.games_attended || 0);
    const rightGames = Number(right.games_attended || 0);
    if (rightGames !== leftGames) {
      return rightGames - leftGames;
    }

    const leftHistorical = Number(left.historical_attendance_score || 0);
    const rightHistorical = Number(right.historical_attendance_score || 0);
    if (rightHistorical !== leftHistorical) {
      return rightHistorical - leftHistorical;
    }

    return displayName(left).localeCompare(displayName(right));
  }

  const SORT_KEYS = {
    player: (row) => displayName(row).toLowerCase(),
    current: (row) => TIER_ORDER[currentTier(row)] ?? 99,
    suggested: (row) => TIER_ORDER[row.recommended_tier_status] ?? 99,
    spot: (row) => Number(row.suggestion_spot_value || 0),
    att: (row) => Number(row.games_attended || 0),
    score: (row) => Number(row.attendance_score || 0),
    recent: (row) => Number(row.recent_attendance_score || 0),
    hist: (row) => Number(row.historical_attendance_score || 0),
  };

  function sortArrow(col) {
    if (sortCol !== col) {
      return "";
    }
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function thClass(col) {
    return sortCol === col ? "active-sort" : "";
  }

  function syncBodyModalState() {
    const hasOpenModal = [suggestionModal, detailModal].some((modal) => !modal.hidden);
    document.body.classList.toggle("modal-open", hasOpenModal);
  }

  function openModal(modal) {
    modal.hidden = false;
    syncBodyModalState();
  }

  function closeModal(modal) {
    modal.hidden = true;
    syncBodyModalState();
  }

  function bindModal(modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-modal-close]")) {
        closeModal(modal);
      }
    });
  }

  function filteredSuggestionRows() {
    const query = String(tierSearch.value || "").trim().toLowerCase();

    return tierRows.filter((row) => {
      if (activeFilter === "changes" && currentTier(row) === row.recommended_tier_status) {
        return false;
      }

      if (
        activeFilter !== "all" &&
        activeFilter !== "changes" &&
        row.recommended_tier_status !== activeFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        row.first_name,
        row.last_name,
        row.nickname || "",
        row.next_step || "",
        row.transparency_note || "",
        formatStatusLabel(row.recommended_tier_status),
        formatStatusLabel(currentTier(row)),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function sorted(rows) {
    const key = SORT_KEYS[sortCol] || SORT_KEYS.suggested;
    const direction = sortDir === "asc" ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftValue = key(left);
      const rightValue = key(right);

      if (typeof leftValue === "string") {
        const difference = leftValue.localeCompare(rightValue) * direction;
        return difference || suggestionComparator(left, right);
      }

      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * direction;
      }

      return suggestionComparator(left, right);
    });
  }

  function updateSeasonUrl(seasonId) {
    const url = new URL(window.location.href);
    url.searchParams.set("season_id", seasonId);
    window.history.replaceState({}, "", url);
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

  function renderSummary() {
    const registeredPlayers = seasonRosterPlayers || [];

    spotMixCount.textContent = String(registeredPlayers.length);
    coreCount.textContent = String(
      registeredPlayers.filter((row) => registrationTier(row) === "core").length
    );
    rotationCount.textContent = String(
      registeredPlayers.filter((row) => registrationTier(row) === "flex").length
    );
    flexCount.textContent = String(
      registeredPlayers.filter((row) => registrationTier(row) === "sub").length
    );
    changeCount.textContent = String(
      registeredPlayers.filter((row) => row?.is_eligible !== false).length
    );
  }

  function renderQueue() {
    const queueRows = buildRotationQueueRows(tierRows, {
      standingsByPlayerId,
      finalMatchday: activeQueueMode === "final",
    });
    const queueMap = new Map(queueRows.map((row, index) => [row.player_id, index + 1]));
    const visibleRows = queueRows.slice(0, queueVisibleLimit());
    const hiddenRows = queueRows.slice(visibleRows.length);
    if (!queueRows.length) {
      queueTableWrap.innerHTML = `
        <div class="empty-state">No flex players in the queue yet. Players appear here once the season starts.</div>
      `;
      return;
    }

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

  function renderSuggestionSummaryPanel() {
    const counts = suggestionCounts();

    suggestionSummaryPills.innerHTML = tierRows.length
      ? suggestionSummaryPillsMarkup(counts)
      : "";

    if (!tierRows.length) {
      suggestionPanelCopy.textContent =
        "Tier recommendations will appear here once the season data is available.";
      suggestionModalCopy.textContent =
        "Start with Changes if you only want to see movement. Now is the active tier today. Suggested next is the attendance-based recommendation.";
      openSuggestionModalButton.disabled = true;
      return;
    }

    if (counts.changes === 0) {
      suggestionPanelCopy.textContent =
        "Everyone looks stable right now. Now and Suggested next currently match across the board.";
    } else {
      suggestionPanelCopy.textContent =
        counts.changes === 1
          ? "1 player is currently flagged for review. Start with Changes to focus on the movement case first."
          : `${counts.changes} players are currently flagged for review. Start with Changes to focus on movement cases first.`;
    }

    suggestionModalCopy.textContent =
      "Start with Changes if you only want to see movement. Now is the active tier today. Suggested next is the attendance-based recommendation for manager review, not an automatic change.";
    openSuggestionModalButton.disabled = false;
  }

  function renderSuggestionTable() {
    const rows = sorted(filteredSuggestionRows());
    const counts = suggestionCounts();

    suggestionTableSummary.innerHTML = tierRows.length
      ? `
          <div class="summary-pill-grid">
            ${suggestionSummaryPillsMarkup(counts)}
          </div>
          <p class="manual-note">
            <strong>How to read this:</strong> <strong>Now</strong> is the tier active today.
            <strong>Suggested next</strong> is where the player would land if the tier plan were rebuilt from attendance data today.
          </p>
        `
      : "";

    if (!rows.length) {
      suggestionTableWrap.innerHTML = `<div class="empty-state">No players match the current filter.</div>`;
      return;
    }

    suggestionTableWrap.innerHTML = renderSuggestionCards(rows);

    suggestionTableWrap.querySelectorAll("[data-detail-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = tierRows.find(
          (entry) => Number(entry.player_id) === Number(button.dataset.detailId)
        );
        if (!row) {
          return;
        }
        renderDetailModal(row);
        openModal(detailModal);
      });
    });
  }

  function renderDetailModal(row) {
    const recentGames = Number(row.recent_games_attended || 0);
    const recentScore = Number(row.recent_attendance_score || 0);
    const seasonGames = Number(row.games_attended || 0);
    const seasonScore = Number(row.attendance_score || 0);
    const historicalScore = Number(row.historical_attendance_score || 0);
    const evidenceText = suggestionEvidenceText(row);

    detailModal.innerHTML = `
      <div class="site-modal-backdrop" data-modal-close></div>
      <div
        class="site-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-detail-modal-title"
      >
        <div class="site-modal-head">
          <div>
            <div class="section-label">Recommendation breakdown</div>
            <h2 class="site-modal-title" id="tier-detail-modal-title">${escapeHtml(displayName(row))}</h2>
            <p class="site-modal-copy">This is a manager review note, not an automatic tier change.</p>
          </div>
          <button class="ghost-button" type="button" data-modal-close>Close</button>
        </div>
        <div class="site-modal-body" id="tier-detail-content">
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">Now</span>
              <div>${tierPill(currentTier(row))}</div>
            </div>
            <div class="detail-item">
              <span class="detail-label">Suggested next</span>
              <div>${tierPill(row.recommended_tier_status)} ${movementPill(row.trend || "steady")}</div>
            </div>
          </div>
          <div class="detail-list" style="margin-top: var(--space-md);">
            <div class="detail-item">
              <span class="detail-label">Last 8 weeks</span>
              <strong>${escapeHtml(recentGames)} of 8 played (score: ${escapeHtml(recentScore)})</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">This season</span>
              <strong>${escapeHtml(seasonGames)} games played (score: ${escapeHtml(seasonScore)})</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">All-time</span>
              <strong>Score ${escapeHtml(historicalScore)}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">Reliability</span>
              <strong>${escapeHtml(reliabilityLine(row))}</strong>
            </div>
          </div>
          <div class="manual-note" style="margin-top: var(--space-md);">
            <strong>Why the app leans here</strong><br />
            ${escapeHtml(row.transparency_note || "Stable in current tier.")}
          </div>
          <div class="manual-note">${escapeHtml(evidenceText)}</div>
          <div class="manual-note">
            <strong>What helps next</strong><br />
            ${escapeHtml(row.next_step || "Keep showing up consistently.")}
          </div>
        </div>
      </div>
    `;
  }

  function renderTierBoards() {
    renderSummary();
    renderQueue();
    renderSuggestionSummaryPanel();
    renderSuggestionTable();
  }

  async function loadSeason() {
    setTierStatus("Loading the flex queue...", "loading");
    queueTableWrap.innerHTML = "";
    suggestionTableSummary.innerHTML = "";
    suggestionTableWrap.innerHTML = "";

    try {
      const bundle = await fetchSeasonBundle(activeSeasonId);
      const normalizedTierRows = (bundle.tiers || []).map((row) => normalizeTierRow(row));
      const historicalContext = await fetchHistoricalTierAttendance(
        seasons,
        activeSeasonId,
        normalizedTierRows.map((row) => row.player_id)
      );
      const rowsWithHistory = summarizeHistoricalAttendance(
        normalizedTierRows,
        seasons,
        activeSeasonId,
        historicalContext.matchdays,
        historicalContext.matches,
        historicalContext.playerStats
      );

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
      tierRows = applyTierSuggestionSlots(rowsWithHistory, suggestionSlotLimit).map((row) =>
        normalizeTierRow(row)
      );
      renderTierBoards();
      heroCopy.textContent =
        activeQueueMode === "final"
          ? `${bundle.season.name} shows the live flex queue first and keeps the recommendation center separate. On the final matchday, season points lead the line and tied players are split by goals, goal keeps, and clean sheets.`
          : `${bundle.season.name} shows the live flex queue first and keeps the recommendation center separate. Fewer appearances stay at the front, and tied players are split by season points, goals, goal keeps, and clean sheets.`;
      setTierStatus();
    } catch (error) {
      seasonRosterPlayers = [];
      standingsByPlayerId = new Map();
      activeQueueMode = "regular";
      const message = readableError(error);
      setTierStatus(message, "error");
      queueTableWrap.innerHTML = "";
      suggestionTableSummary.innerHTML = "";
      suggestionTableWrap.innerHTML = `<div class="empty-state">${escapeHtml(
        message
      )}</div>`;
    }
  }

  async function init() {
    try {
      seasons = await fetchSeasons();
      const selected = pickSeason(seasons, activeSeasonId);

      if (!selected) {
        setTierStatus("No season found.", "warning");
        openSuggestionModalButton.disabled = true;
        return;
      }

      activeSeasonId = selected.id;
      renderSeasonOptions();
      updateSeasonUrl(activeSeasonId);
      await loadSeason();
    } catch (error) {
      setTierStatus(readableError(error), "error");
      openSuggestionModalButton.disabled = true;
    }
  }

  bindModal(suggestionModal);
  bindModal(detailModal);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!detailModal.hidden) {
      closeModal(detailModal);
      return;
    }

    if (!suggestionModal.hidden) {
      closeModal(suggestionModal);
    }
  });

  openSuggestionModalButton.addEventListener("click", () => {
    renderSuggestionTable();
    openModal(suggestionModal);
  });

  seasonSelect.addEventListener("change", async () => {
    activeSeasonId = Number(seasonSelect.value);
    updateSeasonUrl(activeSeasonId);
    await loadSeason();
  });

  tierFilterRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) {
      return;
    }

    activeFilter = button.dataset.filter;
    tierFilterRow.querySelectorAll("[data-filter]").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === activeFilter);
    });
    renderSuggestionTable();
  });

  tierSearch.addEventListener("input", () => renderSuggestionTable());

  window.addEventListener("resize", () => {
    renderQueue();
    renderSuggestionTable();
  });

  init();
});
