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
  const buildRotationQueueRows =
    logic.buildRotationQueueRows ||
    ((rows) => [...(rows || [])].filter((row) => row.tier_status === "rotation" && row.is_eligible));
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
  const openSuggestionModalButton = document.getElementById("open-tier-suggestion-modal");
  const suggestionModal = document.getElementById("tier-suggestion-modal");
  const suggestionModalCopy = document.getElementById("tier-suggestion-modal-copy");
  const suggestionTableWrap = document.getElementById("tier-table-wrap");
  const tierFilterRow = document.getElementById("tier-filter-row");
  const tierSearch = document.getElementById("tier-search");
  const detailModal = document.getElementById("tier-detail-modal");

  const TIER_ORDER = Object.freeze({ core: 0, rotation: 1, flex_sub: 2 });
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
  let activeFilter = "all";
  let sortCol = "suggested";
  let sortDir = DEFAULT_SORT_DIRECTIONS.suggested;

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
    return row.tier_status || row.default_status || "flex_sub";
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
      return "Promote";
    }
    if (trend === "down") {
      return "Drop";
    }
    return "Stay";
  }

  function movementPill(trend) {
    return `<span class="move-badge ${trendClass(trend)}">${escapeHtml(trendLabel(trend))}</span>`;
  }

  function tierPill(status) {
    return `<span class="tier-pill ${escapeHtml(status)}">${escapeHtml(
      formatStatusLabel(status)
    )}</span>`;
  }

  function suggestionEvidenceText(row) {
    return row?.suggestion_evidence || tierSuggestionEvidence(row) || "Attendance evidence unavailable.";
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
      if (activeFilter !== "all" && row.recommended_tier_status !== activeFilter) {
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
    const spotMixUsed = tierRows.reduce(
      (total, row) => total + Number(row.suggestion_spot_value || 0),
      0
    );

    spotMixCount.textContent = `${formatSpotValue(spotMixUsed)} / ${formatSpotValue(
      suggestionSlotLimit
    )}`;
    coreCount.textContent = String(
      tierRows.filter((row) => row.recommended_tier_status === "core").length
    );
    rotationCount.textContent = String(
      tierRows.filter((row) => row.recommended_tier_status === "rotation").length
    );
    flexCount.textContent = String(
      tierRows.filter((row) => row.recommended_tier_status === "flex_sub").length
    );
    changeCount.textContent = String(
      tierRows.filter((row) => currentTier(row) !== row.recommended_tier_status).length
    );
  }

  function renderQueue() {
    const queueRows = buildRotationQueueRows(tierRows);
    const queueMap = new Map(queueRows.map((row, index) => [row.player_id, index + 1]));

    if (!queueRows.length) {
      queueTableWrap.innerHTML = `
        <div class="subtable-head">
          <div>
            <h3>Current Rotation Queue</h3>
            <p>This stays season-to-date and separate from the suggestion model.</p>
          </div>
        </div>
        <div class="empty-state">No live Rotation queue yet.</div>
      `;
      return;
    }

    if (window.matchMedia("(max-width: 719px)").matches) {
      queueTableWrap.innerHTML = `
        <div class="subtable-head">
          <div>
            <h3>Current Rotation Queue</h3>
            <p>Lower season-to-date attendance stays first, so Q1 is next up when a rotation slot opens.</p>
          </div>
        </div>
        <div class="standings-card-list">
          ${queueRows
            .map((row) => `
              <article class="standings-card">
                <header class="standings-card-head">
                  <div class="standings-rank-badge">Q${escapeHtml(queueMap.get(row.player_id))}</div>
                  <div class="standings-card-title">
                    <div class="player-main">${escapeHtml(displayName(row))}</div>
                    ${
                      row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                        ? `<div class="table-player-sub">${escapeHtml(fullName(row))}</div>`
                        : ""
                    }
                  </div>
                </header>
                <div class="standings-metrics">
                  <div class="metric-pill"><span>Att</span><strong>${escapeHtml(row.games_attended)}</strong></div>
                  <div class="metric-pill"><span>Score</span><strong>${escapeHtml(row.attendance_score)}</strong></div>
                </div>
                <div class="manual-note">${escapeHtml(row.transparency_note || "Current rotation queue")}</div>
              </article>
            `)
            .join("")}
        </div>
      `;
      return;
    }

    queueTableWrap.innerHTML = `
      <div class="subtable-head">
        <div>
          <h3>Current Rotation Queue</h3>
          <p>Lower season-to-date attendance stays first, so Q1 is next up when a rotation slot opens.</p>
        </div>
      </div>
      <table class="standings-table">
        <thead>
          <tr>
            <th class="num">Q</th>
            <th>Player</th>
            <th class="num">Att</th>
            <th class="num">Score</th>
            <th class="hide-mobile">Note</th>
          </tr>
        </thead>
        <tbody>
          ${queueRows
            .map(
              (row) => `
                <tr>
                  <td class="num"><span class="queue-pill">${escapeHtml(queueMap.get(row.player_id))}</span></td>
                  <td>
                    <div class="player-cell">
                      <span class="name">${escapeHtml(displayName(row))}</span>
                      ${
                        row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                          ? `<span class="sub">${escapeHtml(fullName(row))}</span>`
                          : ""
                      }
                    </div>
                  </td>
                  <td class="num">${escapeHtml(row.games_attended)}</td>
                  <td class="num">${escapeHtml(row.attendance_score)}</td>
                  <td class="hide-mobile">${escapeHtml(row.transparency_note || "Current rotation queue")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderSuggestionSummaryPanel() {
    const spotMixUsed = tierRows.reduce(
      (total, row) => total + Number(row.suggestion_spot_value || 0),
      0
    );
    const moveTotal = tierRows.filter(
      (row) => currentTier(row) !== row.recommended_tier_status
    ).length;

    suggestionPanelCopy.textContent = `Open the recommendation table when needed. It currently fills ${formatSpotValue(
      spotMixUsed
    )} of ${formatSpotValue(suggestionSlotLimit)} weighted spots and suggests ${moveTotal} tier change${
      moveTotal === 1 ? "" : "s"
    }.`;
    suggestionModalCopy.textContent = `Recommendations use recent score first, season score second, and historical score third to break close calls inside the ${formatSpotValue(
      suggestionSlotLimit
    )}-spot plan.`;
    openSuggestionModalButton.disabled = tierRows.length === 0;
  }

  function renderSuggestionTable() {
    const rows = sorted(filteredSuggestionRows());

    if (!rows.length) {
      suggestionTableWrap.innerHTML = `<div class="empty-state">No players match the current filter.</div>`;
      return;
    }

    if (window.matchMedia("(max-width: 719px)").matches) {
      suggestionTableWrap.innerHTML = `
        <div class="standings-card-list">
          ${rows
            .map(
              (row, index) => `
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
                    ${tierPill(currentTier(row))}
                    ${movementPill(row.trend || "steady")}
                    ${tierPill(row.recommended_tier_status)}
                  </div>
                  <div class="standings-metrics">
                    <div class="metric-pill"><span>Spot</span><strong>${
                      row.suggestion_spot_value
                        ? escapeHtml(formatSpotValue(row.suggestion_spot_value))
                        : "—"
                    }</strong></div>
                    <div class="metric-pill"><span>Att</span><strong>${escapeHtml(row.games_attended)}</strong></div>
                    <div class="metric-pill"><span>Score</span><strong>${escapeHtml(row.attendance_score)}</strong></div>
                    <div class="metric-pill"><span>Recent</span><strong>${escapeHtml(row.recent_attendance_score || 0)}</strong></div>
                    <div class="metric-pill"><span>History</span><strong>${escapeHtml(row.historical_attendance_score || 0)}</strong></div>
                  </div>
                  <div class="manual-note">${escapeHtml(row.transparency_note || "No summary note yet.")}</div>
                  <button
                    class="secondary-button table-action-button"
                    type="button"
                    data-detail-id="${escapeHtml(row.player_id)}"
                  >
                    View why
                  </button>
                </article>
              `
            )
            .join("")}
        </div>
      `;

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
      return;
    }

    suggestionTableWrap.innerHTML = `
      <table class="standings-table standings-table-wide">
        <thead>
          <tr>
            <th class="num">#</th>
            <th class="sortable-th ${thClass("player")}" data-sort="player">Player${sortArrow("player")}</th>
            <th class="sortable-th ${thClass("current")}" data-sort="current">Current${sortArrow("current")}</th>
            <th>Move</th>
            <th>More</th>
            <th class="sortable-th ${thClass("suggested")}" data-sort="suggested">Suggested${sortArrow("suggested")}</th>
            <th class="num sortable-th ${thClass("spot")}" data-sort="spot">Spot${sortArrow("spot")}</th>
            <th class="num sortable-th ${thClass("att")}" data-sort="att">Att${sortArrow("att")}</th>
            <th class="num sortable-th ${thClass("score")}" data-sort="score">Score${sortArrow("score")}</th>
            <th class="num sortable-th ${thClass("recent")}" data-sort="recent">Recent${sortArrow("recent")}</th>
            <th class="num sortable-th ${thClass("hist")}" data-sort="hist">History${sortArrow("hist")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, index) => `
                <tr>
                  <td class="num muted">${index + 1}</td>
                  <td>
                    <div class="player-stack">
                      <div class="player-cell">
                        <span class="name">${escapeHtml(displayName(row))}</span>
                        ${
                          row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                            ? `<span class="sub">${escapeHtml(fullName(row))}</span>`
                            : ""
                        }
                      </div>
                    </div>
                  </td>
                  <td>${tierPill(currentTier(row))}</td>
                  <td>${movementPill(row.trend || "steady")}</td>
                  <td>
                    <button
                      class="ghost-button table-action-button"
                      type="button"
                      data-detail-id="${escapeHtml(row.player_id)}"
                    >
                      View Why
                    </button>
                  </td>
                  <td>${tierPill(row.recommended_tier_status)}</td>
                  <td class="num">${
                    row.suggestion_spot_value
                      ? `<span class="queue-pill">${escapeHtml(
                          formatSpotValue(row.suggestion_spot_value)
                        )}</span>`
                      : "—"
                  }</td>
                  <td class="num">${escapeHtml(row.games_attended)}</td>
                  <td class="num">${escapeHtml(row.attendance_score)}</td>
                  <td class="num">${escapeHtml(row.recent_attendance_score || 0)}</td>
                  <td class="num">${escapeHtml(row.historical_attendance_score || 0)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;

    suggestionTableWrap.querySelectorAll("[data-sort]").forEach((header) => {
      header.addEventListener("click", () => {
        const nextSort = header.dataset.sort;
        if (sortCol === nextSort) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortCol = nextSort;
          sortDir = DEFAULT_SORT_DIRECTIONS[nextSort] || "desc";
        }
        renderSuggestionTable();
      });
    });

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
            <div class="section-label">Explanation</div>
            <h2 class="site-modal-title" id="tier-detail-modal-title">Suggestion Details</h2>
          </div>
          <button class="ghost-button" type="button" data-modal-close>Close</button>
        </div>
        <div class="site-modal-body" id="tier-detail-content">
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">Player</span>
              <strong>${escapeHtml(displayName(row))}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">Current Tier</span>
              <div>${tierPill(currentTier(row))}</div>
            </div>
            <div class="detail-item">
              <span class="detail-label">Suggested Tier</span>
              <div>${tierPill(row.recommended_tier_status)}</div>
            </div>
            <div class="detail-item">
              <span class="detail-label">Move</span>
              <div>${movementPill(row.trend || "steady")}</div>
            </div>
            <div class="detail-item">
              <span class="detail-label">Weighted Spot</span>
              <strong>${escapeHtml(
                row.suggestion_spot_value ? formatSpotValue(row.suggestion_spot_value) : "—"
              )}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">Season Attendance</span>
              <strong>${escapeHtml(row.games_attended)}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">Season Score</span>
              <strong>${escapeHtml(row.attendance_score)}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">Recent Score</span>
              <strong>${escapeHtml(row.recent_attendance_score || 0)}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-label">Historical Score</span>
              <strong>${escapeHtml(row.historical_attendance_score || 0)}</strong>
            </div>
          </div>
          <div class="manual-note">
            <strong>${escapeHtml(row.transparency_note || "No summary note yet.")}</strong><br />
            ${escapeHtml(suggestionEvidenceText(row))}
          </div>
          <div class="manual-note">
            <strong>Next step</strong><br />
            ${escapeHtml(row.next_step || "No follow-up note yet.")}
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
    setTierStatus("Loading the tier tracker...", "loading");
    queueTableWrap.innerHTML = "";
    suggestionTableWrap.innerHTML = "";

    try {
      const bundle = await fetchSeasonBundle(activeSeasonId);
      const historicalContext = await fetchHistoricalTierAttendance(
        seasons,
        activeSeasonId,
        (bundle.tiers || []).map((row) => row.player_id)
      );
      const rowsWithHistory = summarizeHistoricalAttendance(
        bundle.tiers || [],
        seasons,
        activeSeasonId,
        historicalContext.matchdays,
        historicalContext.matches,
        historicalContext.playerStats
      );

      tierRows = applyTierSuggestionSlots(rowsWithHistory, suggestionSlotLimit);
      renderTierBoards();
      heroCopy.textContent = `${bundle.season.name} keeps the live rotation queue visible. Tier recommendations open separately, and each explanation shows recent score, season score, historical score, and the logic behind the call.`;
      setTierStatus();
    } catch (error) {
      const message = readableError(error);
      setTierStatus(message, "error");
      queueTableWrap.innerHTML = "";
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
