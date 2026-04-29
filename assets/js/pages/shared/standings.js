document.addEventListener("DOMContentLoaded", async () => {
  if (!window.MandarinasPublic) {
    const statusLine = document.getElementById("standings-status-line");
    if (statusLine) {
      statusLine.textContent =
        "MandarinasPublic failed to load. Check browser console (F12) for errors.";
    }
    console.error("[MandarinasPublic] Fatal: shared standings dependencies failed to load.");
    return;
  }

  const {
    escapeHtml,
    playerDisplayName,
    playerNameParts,
    formatStatusLabel,
    badgeIconMarkup,
    tierIconMarkup,
    formatDay,
    readableError,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    buildCompletedMatchdays,
    buildStandings,
    sortStandings,
    matchdayState,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const seasonSelect = document.getElementById("season-select");
  const heroCopy = document.getElementById("hero-copy");
  const completedCount = document.getElementById("completed-count");
  const rankedCount = document.getElementById("ranked-count");
  const latestDay = document.getElementById("latest-day");
  const latestDayCopy = document.getElementById("latest-day-copy");
  const goalRule = document.getElementById("goal-rule");
  const standingsSearch = document.getElementById("standings-search");
  const tierFilterRow = document.getElementById("tier-filter-row");
  const standingsStatusLine = document.getElementById("standings-status-line");
  const standingsDataNote = document.getElementById("standings-data-note");
  const standingsTableWrap = document.getElementById("standings-table-wrap");
  const tableNote = document.getElementById("table-note");
  const podiumBoard = document.getElementById("podium-board");
  const topPlayersBoard = document.getElementById("top-players-board");
  const openMatchdayLink = document.getElementById("open-matchday-link");

  const SORT_COLUMNS = [
    { key: "total_points", label: "Pts", width: "68px" },
    { key: "points_per_game", label: "PPG", width: "76px" },
    { key: "wins", label: "W", width: "56px" },
    { key: "draws", label: "D", width: "56px" },
    { key: "losses", label: "L", width: "56px" },
    { key: "goals", label: "G", width: "56px" },
    { key: "goal_keep_points_earned", label: "GK", width: "64px" },
    { key: "clean_sheets", label: "CS", width: "64px" },
  ];
  const SORT_LABELS = Object.freeze({
    player_name: "player name",
    total_points: "total points",
    points_per_game: "points per game",
    wins: "wins",
    draws: "draws",
    losses: "losses",
    goals: "goals",
    goal_keep_points_earned: "goal keeping",
    clean_sheets: "clean sheets",
  });
  const DEFAULT_SORT_DIRECTIONS = Object.freeze({
    player_name: "asc",
    total_points: "desc",
    points_per_game: "desc",
    wins: "desc",
    draws: "desc",
    losses: "asc",
    goals: "desc",
    goal_keep_points_earned: "desc",
    clean_sheets: "desc",
  });

  let seasons = [];
  let activeSeasonId = querySeasonIdFromUrl();
  let standings = [];
  let activeSeason = null;
  let activeTierFilter = "all";
  let sortKey = "total_points";
  let sortDir = DEFAULT_SORT_DIRECTIONS.total_points;

  function defaultSortDirectionFor(key) {
    return DEFAULT_SORT_DIRECTIONS[key] || "desc";
  }

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

  function renderPodiumBoard() {
    if (!podiumBoard) {
      return;
    }

    const leaders = sortStandings(standings, "total_points", "desc").slice(0, 3);

    if (!leaders.length) {
      podiumBoard.innerHTML = '<div class="status-line">No ranked players yet.</div>';
      return;
    }

    podiumBoard.innerHTML = leaders
      .map((row, index) => {
        const nameParts = playerNameParts(row.player);
        const subtitle = [nameParts.secondary, formatStatusLabel(row.player.status)]
          .filter(Boolean)
          .join(" · ");
        return `
          <article class="podium-card rank-${index + 1}">
            <div class="podium-rank">${escapeHtml(index + 1)}</div>
            <div>
              <div class="podium-name">${escapeHtml(nameParts.primary || playerDisplayName(row.player))}</div>
              <div class="podium-meta">${escapeHtml(subtitle || "Club player")}</div>
            </div>
            <div class="compact-badges">
              ${index === 0 ? `<span class="winner-pill">${badgeIconMarkup("winner")}<span>Winner</span></span>` : ""}
              <span class="tag-pill">${escapeHtml(row.total_points)} pts</span>
              <span class="tag-pill">${escapeHtml(Number(row.points_per_game || 0).toFixed(2))} PPG</span>
            </div>
            <div class="podium-copy">
              ${escapeHtml(`${row.goals} goals · ${row.days_attended} attended`)}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderTopPlayersBoard() {
    const leaders = sortStandings(standings, "total_points", "desc").slice(podiumBoard ? 3 : 0, podiumBoard ? 9 : 6);

    if (!leaders.length) {
      topPlayersBoard.innerHTML = `<div class="status-line">${
        podiumBoard ? "Only the podium is available right now." : "No ranked players yet."
      }</div>`;
      return;
    }

    topPlayersBoard.innerHTML = leaders
      .map((row) => {
        const nameParts = playerNameParts(row.player);
        const subtitle = [nameParts.secondary, formatStatusLabel(row.player.status), `${Number(row.points_per_game || 0).toFixed(2)} PPG`]
          .filter(Boolean)
          .join(" · ");
        return `
          <div class="leader-row">
            <div class="leader-rank">${escapeHtml(row.rank)}</div>
            <div class="leader-name-wrap">
              <div class="leader-name">${escapeHtml(nameParts.primary || playerDisplayName(row.player))}</div>
              <div class="table-player-sub">${escapeHtml(subtitle)}</div>
            </div>
            <div class="leader-points">${escapeHtml(row.total_points)} pts</div>
          </div>
        `
      })
      .join("");
  }

  function getFilteredStandings() {
    const query = String(standingsSearch?.value || "").trim().toLowerCase();

    return standings.filter((row) => {
      if (activeTierFilter !== "all" && row.player.status !== activeTierFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        row.player.first_name,
        row.player.last_name,
        row.player.nickname || "",
        row.player.nationality || "",
        row.player.status || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderTableRows(rows) {
    const totalCount = rows.length;

    return rows
      .map((row) => {
        const isTop3 = row.rank <= 3;
        const isBottom4 = row.rank > Math.max(totalCount - 4, 4);
        const rowClass = isTop3 ? `podium-${row.rank}` : isBottom4 ? "bottom-four" : "";
        const nameParts = playerNameParts(row.player);
        const subtitle = [nameParts.secondary, formatStatusLabel(row.player.status)]
          .filter(Boolean)
          .join(" · ");

        return `
          <tr class="${rowClass}">
            <td class="table-rank">${escapeHtml(row.rank)}</td>
            <td>
              <div class="table-player-cell">
                <div class="player-main">${escapeHtml(nameParts.primary || playerDisplayName(row.player))}</div>
                <div class="table-player-sub">${escapeHtml(subtitle || formatStatusLabel(row.player.status))}</div>
              </div>
            </td>
            <td class="table-points">${escapeHtml(row.total_points)}</td>
            <td class="table-num">${escapeHtml(Number(row.points_per_game || 0).toFixed(2))}</td>
            <td class="table-num">${escapeHtml(row.wins)}</td>
            <td class="table-num">${escapeHtml(row.draws)}</td>
            <td class="table-num">${escapeHtml(row.losses)}</td>
            <td class="table-num">${escapeHtml(row.goals)}</td>
            <td class="table-num">${escapeHtml(row.goal_keep_points_earned)}</td>
            <td class="table-num">${escapeHtml(row.clean_sheets)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderStandingsCards(rows) {
    return `
      <div class="standings-card-list">
        ${rows
          .map((row) => {
            const nameParts = playerNameParts(row.player);
            const subtitle = [nameParts.secondary, formatStatusLabel(row.player.status)]
              .filter(Boolean)
              .join(" · ");

            return `
              <article class="standings-card">
                <header class="standings-card-head">
                  <div class="standings-rank-badge">${escapeHtml(row.rank)}</div>
                  <div class="standings-card-title">
                    <div class="player-main">${escapeHtml(nameParts.primary || playerDisplayName(row.player))}</div>
                    <div class="table-player-sub">${escapeHtml(subtitle || "Club player")}</div>
                  </div>
                </header>
                <div class="compact-badges">
                  <span class="tier-pill ${escapeHtml(row.player.status)}">${tierIconMarkup(row.player.status)}<span>${escapeHtml(formatStatusLabel(row.player.status))}</span></span>
                  <span class="tag-pill">${escapeHtml(row.total_points)} pts</span>
                  <span class="tag-pill">${escapeHtml(Number(row.points_per_game || 0).toFixed(2))} PPG</span>
                </div>
                <div class="standings-metrics">
                  <div class="metric-pill"><span>Record</span><strong>${escapeHtml(`${row.wins}-${row.draws}-${row.losses}`)}</strong></div>
                  <div class="metric-pill"><span>Goals</span><strong>${escapeHtml(row.goals)}</strong></div>
                  <div class="metric-pill"><span>GK</span><strong>${escapeHtml(row.goal_keep_points_earned)}</strong></div>
                  <div class="metric-pill"><span>CS</span><strong>${escapeHtml(row.clean_sheets)}</strong></div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function sortArrow(key) {
    if (sortKey !== key) {
      return "";
    }
    return sortDir === "desc" ? " ▼" : " ▲";
  }

  function currentSortLabel() {
    return SORT_LABELS[sortKey] || "league priority";
  }

  function renderTable() {
    const rows = sortStandings(getFilteredStandings(), sortKey, sortDir);
    const seasonLabel =
      activeSeason?.name || seasons.find((season) => season.id === activeSeasonId)?.name || "Season";
    const tierLabel =
      activeTierFilter === "all" ? "all tiers" : formatStatusLabel(activeTierFilter).toLowerCase();

    if (!rows.length) {
      standingsTableWrap.innerHTML = `<div class="empty-state">No players match the current filters.</div>`;
      tableNote.textContent = `${seasonLabel} · ${tierLabel}`;
      return;
    }

    if (window.matchMedia("(max-width: 767px)").matches) {
      standingsTableWrap.innerHTML = renderStandingsCards(rows);
      tableNote.textContent = `${seasonLabel} · ${tierLabel} · sorted by ${currentSortLabel()}`;
      return;
    }

    standingsTableWrap.innerHTML = `
      <table class="standings-table standings-table-compact season-standings-table">
        <thead>
          <tr>
            <th class="table-rank-head">Pos</th>
            <th class="sortable-th ${sortKey === "player_name" ? "active-sort" : ""}" data-sort-key="player_name">
              Player${sortArrow("player_name")}
            </th>
            ${SORT_COLUMNS.map(
              (column) => `
                <th
                  class="sortable-th ${sortKey === column.key ? "active-sort" : ""}"
                  data-sort-key="${column.key}"
                >
                  ${column.label}${sortArrow(column.key)}
                </th>
              `
            ).join("")}
          </tr>
        </thead>
        <tbody>
          ${renderTableRows(rows)}
        </tbody>
      </table>
    `;

    tableNote.textContent = `${seasonLabel} · ${tierLabel} · sorted by ${currentSortLabel()}`;
  }

  function syncOpenMatchdayLink() {
    if (!openMatchdayLink) {
      return;
    }

    if (!activeSeason) {
      openMatchdayLink.href = "./seasons.html";
      openMatchdayLink.textContent = "Launch a campaign first";
      return;
    }

    openMatchdayLink.href = `./matchday.html?season_id=${activeSeason.id}`;
    openMatchdayLink.textContent = `Open ${activeSeason.name} in match center`;
  }

  async function loadSeason() {
    standingsStatusLine.textContent = "Loading the table...";
    if (standingsDataNote) {
      standingsDataNote.hidden = true;
      standingsDataNote.textContent = "";
    }

    try {
      const bundle = await fetchSeasonBundle(activeSeasonId);
      const completedMatchdays = buildCompletedMatchdays(bundle.matchdays, bundle.matches);
      const incompleteMatchdays = bundle.matchdays
        .map((matchday) => ({ matchday, state: matchdayState(matchday, bundle.matches) }))
        .filter(({ state }) => state.key === "in_progress" || state.isOverdue);

      activeSeason = bundle.season;
      standings = buildStandings(
        bundle.players,
        bundle.assignments,
        bundle.playerStats,
        completedMatchdays,
        bundle.season
      );

      const latestCompleted = completedMatchdays[completedMatchdays.length - 1] || null;

      completedCount.textContent = String(completedMatchdays.length);
      rankedCount.textContent = String(standings.length);
      latestDay.textContent = latestCompleted ? `MD ${latestCompleted.matchday_number}` : "-";
      latestDayCopy.textContent = latestCompleted
        ? formatDay(latestCompleted.kickoff_at)
        : "Waiting for completed results.";
      goalRule.textContent = latestCompleted
        ? latestCompleted.goals_count_as_points
          ? "Goals count"
          : "Tiebreak only"
        : "-";

      heroCopy.textContent = `${bundle.season.name} only counts fully scored matchdays in the table. Official order follows total points, PPG, wins, draws, losses, goals, goalkeeping, then clean sheets.`;

      if (standingsDataNote && incompleteMatchdays.length) {
        standingsDataNote.hidden = false;
        standingsDataNote.textContent = `Waiting on full results for ${incompleteMatchdays
          .map(
            ({ matchday, state }) =>
              `MD ${matchday.matchday_number} (${state.detail.toLowerCase()})`
          )
          .join(", ")}.`;
      }

      renderPodiumBoard();
      renderTopPlayersBoard();
      syncOpenMatchdayLink();
      renderTable();
      standingsStatusLine.textContent = "Table loaded.";
    } catch (error) {
      const message = readableError(error);
      standingsStatusLine.textContent = message;
      if (standingsDataNote) {
        standingsDataNote.hidden = true;
        standingsDataNote.textContent = "";
      }
      standingsTableWrap.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  async function init() {
    try {
      seasons = await fetchSeasons();
      const selectedSeason = pickSeason(seasons, activeSeasonId);

      if (!selectedSeason) {
        standingsStatusLine.textContent = "No seasons have been created yet.";
        standingsTableWrap.innerHTML = `<div class="empty-state">The table will appear once a season exists.</div>`;
        return;
      }

      activeSeasonId = selectedSeason.id;
      renderSeasonOptions();
      updateSeasonUrl(activeSeasonId);
      await loadSeason();
    } catch (error) {
      const message = readableError(error);
      standingsStatusLine.textContent = message;
      standingsTableWrap.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  seasonSelect.addEventListener("change", async () => {
    activeSeasonId = Number(seasonSelect.value);
    updateSeasonUrl(activeSeasonId);
    await loadSeason();
  });

  if (standingsSearch) {
    standingsSearch.addEventListener("input", () => {
      renderTable();
    });
  }

  if (tierFilterRow) {
    tierFilterRow.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tier-filter]");
      if (!button) {
        return;
      }

      activeTierFilter = button.dataset.tierFilter;
      Array.from(tierFilterRow.querySelectorAll("[data-tier-filter]")).forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.tierFilter === activeTierFilter);
      });
      renderTable();
    });
  }

  standingsTableWrap.addEventListener("click", (event) => {
    const header = event.target.closest("[data-sort-key]");
    if (!header) {
      return;
    }

    const nextKey = header.dataset.sortKey;
    if (sortKey === nextKey) {
      sortDir = sortDir === "desc" ? "asc" : "desc";
    } else {
      sortKey = nextKey;
      sortDir = defaultSortDirectionFor(nextKey);
    }

    renderTable();
  });

  await init();
});
