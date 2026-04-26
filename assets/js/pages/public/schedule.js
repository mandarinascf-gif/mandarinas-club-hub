document.addEventListener("DOMContentLoaded", () => {
  if (!window.MandarinasPublic) {
    document.getElementById("schedule-status-line").textContent =
      "MandarinasPublic failed to load. Check browser console for script errors.";
    console.error("[MandarinasPublic] Fatal: MandarinasPublic is undefined");
    return;
  }

  const {
    escapeHtml,
    formatDateTime,
    formatTeamLabel,
    teamClassName,
    playerDisplayName,
    readableError,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    buildCompletedMatchdays,
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

  function buildLineupView(matchdayId) {
    const playerMap = new Map((activeBundle.players || []).map((player) => [player.id, player]));
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
          name: playerDisplayName(player),
          summary: playerStatSummary(statMap.get(assignment.player_id)),
        });
      });

    const teamOrder = ["blue", "magenta", "green", "orange"];
    const hasLineups = teamOrder.some((teamCode) => grouped[teamCode].length);

    if (!hasLineups) {
      return '<div class="empty-state">No team assignments were saved for this matchday.</div>';
    }

    return `
      <div class="team-sheet-grid">
        ${teamOrder
          .map((teamCode) => {
            const rows = grouped[teamCode].sort((left, right) => left.name.localeCompare(right.name));
            return `
              <section class="team-sheet">
                <div class="team-sheet-head">
                  <span class="team-badge ${escapeHtml(teamClassName(teamCode))}">${escapeHtml(formatTeamLabel(teamCode))}</span>
                  <span class="mini-sub">${escapeHtml(rows.length)} players</span>
                </div>
                ${
                  rows.length
                    ? `
                      <div class="team-player-list">
                        ${rows
                          .map(
                            (row) => `
                              <div class="team-player-row">
                                <span>${escapeHtml(row.name)}</span>
                                <span class="mini-sub">${escapeHtml(row.summary || "-")}</span>
                              </div>
                            `
                          )
                          .join("")}
                      </div>
                    `
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
      <div class="detail-card">
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
  }

  function renderMatchdayList() {
    const rows = activeBundle?.matchdays || [];

    if (!rows.length) {
      matchdayGrid.innerHTML = '<div class="empty-state">No matchdays found for this season.</div>';
      return;
    }

    matchdayGrid.innerHTML = rows
      .slice()
      .sort((left, right) => left.matchday_number - right.matchday_number)
      .map((matchday) => {
        const state = matchdayState(matchday, activeBundle.matches || []);
        return `
          <article class="list-item ${Number(matchday.id) === Number(selectedMatchdayId) ? "active" : ""}" data-matchday-id="${matchday.id}">
            <div>
              <div class="list-item-title">Matchday ${escapeHtml(matchday.matchday_number)}</div>
              <div class="compact-row-copy">
                ${escapeHtml(matchday.kickoff_at ? formatDateTime(matchday.kickoff_at) : "Kickoff not scheduled")}
              </div>
            </div>
            <div class="list-actions">
              <span class="state-pill ${escapeHtml(state.key)}">${escapeHtml(state.label)}</span>
              <a class="secondary-button" href="#matchday-detail">View</a>
            </div>
          </article>
        `;
      })
      .join("");
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
        selectedMatchdayId = activeBundle.matchdays?.[0]?.id || null;
      }

      heroCopy.textContent = `${activeBundle.season.name} matchdays are listed on the left. Select any row to review scores and team assignments.`;
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
