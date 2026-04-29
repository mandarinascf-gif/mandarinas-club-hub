document.addEventListener("DOMContentLoaded", () => {
  if (!window.MandarinasPublic) {
    const msg =
      "MandarinasPublic failed to load. Check browser console for connection or script errors.";
    document.getElementById("hero-copy").textContent = msg;
    console.error("[MandarinasPublic] Fatal:", msg);
    return;
  }

  const {
    escapeHtml,
    playerDisplayName,
    playerNameParts,
    nationalityFlag,
    formatDateTime,
    formatStatusLabel,
    badgeIconMarkup,
    tierIconMarkup,
    formatTeamLabel,
    teamClassName,
    readableError,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    buildCompletedMatchdays,
    buildStandings,
    buildScorersForMatchday,
    buildGoalkeepingForMatchday,
    checkConnection,
  } = window.MandarinasPublic;
  const weatherApi = window.MandarinasWeather || null;

  const heroCopy = document.getElementById("hero-copy");
  const seasonName = document.getElementById("season-name");
  const seasonSub = document.getElementById("season-sub");
  const nextMatchdayNumber = document.getElementById("next-matchday-number");
  const nextMatchdayDate = document.getElementById("next-matchday-date");
  const nextMatchdayWeather = document.getElementById("next-matchday-weather");
  const completedDays = document.getElementById("completed-days");
  const rankedPlayers = document.getElementById("ranked-players");
  const latestResultsTitle = document.getElementById("latest-results-title");
  const latestResultsCopy = document.getElementById("latest-results-copy");
  const latestResultsBody = document.getElementById("latest-results-body");
  const latestResultsCard = document.getElementById("latest-results-card");
  const leadersPoints = document.getElementById("leaders-points");
  const leadersGoals = document.getElementById("leaders-goals");
  const leadersAttendance = document.getElementById("leaders-attendance");
  const mvpCard = document.getElementById("mvp-card");
  const mvpBody = document.getElementById("mvp-body");
  const mvpName = document.getElementById("mvp-name");
  const mvpSubtitle = document.getElementById("mvp-subtitle");
  const pastWinnersCard = document.getElementById("past-winners-card");
  const pastWinnersList = document.getElementById("past-winners-list");
  const championArtLibrary = [
    {
      theme: "winter",
      match: /\bwinter\b/i,
      label: "Winter",
      src: "./assets/images/past-champions/champion-winter-v1.jpg",
      alt: "A gold champion trophy and football on a frosty pitch with mandarins at dusk.",
    },
    {
      theme: "spring",
      match: /\bspring\b/i,
      label: "Spring",
      src: "./assets/images/past-champions/champion-spring-v1.jpg",
      alt: "A gold champion trophy and football on a bright spring pitch with citrus blossoms.",
    },
    {
      theme: "summer",
      match: /\bsummer\b/i,
      label: "Summer",
      src: "./assets/images/past-champions/champion-summer-v1.jpg",
      alt: "A gold champion trophy and football glowing on a summer pitch at sunset.",
    },
    {
      theme: "fall",
      match: /\bfall\b/i,
      label: "Fall",
      src: "./assets/images/past-champions/champion-fall-v1.jpg",
      alt: "A gold champion trophy and football on an autumn pitch with windblown leaves.",
    },
    {
      theme: "holiday",
      match: /\bholiday\b/i,
      label: "Holiday",
      src: "./assets/images/past-champions/champion-holiday-v1.jpg",
      alt: "A gold champion trophy and football on a festive evening pitch with warm string lights.",
    },
    {
      theme: "solstice",
      match: /\bsolstice\b/i,
      label: "Solstice",
      src: "./assets/images/past-champions/champion-solstice-v1.jpg",
      alt: "A gold champion trophy and football on a twilight pitch beneath a dramatic solstice sky.",
    },
  ];

  function renderLeaderRow(rank, player, value) {
    const nameParts = playerNameParts(player);
    const subtitle = [nameParts.secondary, formatStatusLabel(player.status)].filter(Boolean).join(" · ");
    return `
      <div class="leader-row">
        <div class="leader-rank">${escapeHtml(rank)}</div>
        <div class="leader-name-wrap">
          <div class="leader-name">${escapeHtml(nameParts.primary || playerDisplayName(player))}</div>
          <div class="mini-sub">${escapeHtml(subtitle || "Club player")}</div>
        </div>
        <div class="leader-value">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function renderLeaderboard(container, standings, valueGetter, valueLabel) {
    const rows = [...(standings || [])]
      .filter((entry) => valueGetter(entry) > 0)
      .sort((left, right) => valueGetter(right) - valueGetter(left))
      .slice(0, 5);

    if (!rows.length) {
      container.innerHTML = '<div class="empty-state">No season stats yet.</div>';
      return;
    }

    container.innerHTML = rows
      .map((entry, index) => renderLeaderRow(index + 1, entry.player, `${valueGetter(entry)} ${valueLabel}`))
      .join("");
  }

  function renderSeasonLeader(standing) {
    if (!standing) {
      mvpCard.hidden = true;
      return;
    }

    mvpCard.hidden = false;
    const nameParts = playerNameParts(standing.player);
    mvpName.textContent = nameParts.primary || playerDisplayName(standing.player);
    mvpSubtitle.textContent = `${standing.total_points} pts · ${standing.goals} goals · ${standing.days_attended} attended`;
    mvpBody.innerHTML = `
      <div class="detail-card">
        <div class="spotlight-badge-row">
          <span class="champion-card-badge">${badgeIconMarkup("winner")}<span>Winner</span></span>
          <span class="tier-pill ${escapeHtml(standing.player.status)}">${tierIconMarkup(standing.player.status)}<span>${escapeHtml(
            formatStatusLabel(standing.player.status)
          )}</span></span>
        </div>
        <ul>
          <li>Points per game: <strong>${escapeHtml(Number(standing.points_per_game || 0).toFixed(2))}</strong></li>
          <li>Record: <strong>${escapeHtml(`${standing.wins}-${standing.draws}-${standing.losses}`)}</strong></li>
          <li>Goalkeeping points: <strong>${escapeHtml(standing.goal_keep_points_earned || 0)}</strong></li>
          <li>Clean sheets: <strong>${escapeHtml(standing.clean_sheets || 0)}</strong></li>
        </ul>
      </div>
    `;
  }

  function resultMatchMarkup(match) {
    return `
      <div class="match-row">
        <div class="match-row-head">
          <div class="match-label">Round ${escapeHtml(match.round_number)} · Match ${escapeHtml(match.match_order)}</div>
        </div>
        <div class="scoreline">
          <span class="team-badge ${escapeHtml(teamClassName(match.home_team_code))}">${escapeHtml(formatTeamLabel(match.home_team_code))}</span>
          <strong>${escapeHtml(match.home_score)}</strong>
          <span>vs</span>
          <strong>${escapeHtml(match.away_score)}</strong>
          <span class="team-badge ${escapeHtml(teamClassName(match.away_team_code))}">${escapeHtml(formatTeamLabel(match.away_team_code))}</span>
        </div>
      </div>
    `;
  }

  function renderListFromEntries(entries, formatter, emptyLabel) {
    if (!entries.length) {
      return `<div class="empty-state">${escapeHtml(emptyLabel)}</div>`;
    }

    return `<div class="compact-list">${entries.map(formatter).join("")}</div>`;
  }

  function renderScorersBlock(scorersByTeam) {
    const entries = Object.entries(scorersByTeam)
      .flatMap(([teamCode, rows]) => rows.map((row) => ({ ...row, teamCode })))
      .sort((left, right) => right.goals - left.goals);

    return renderListFromEntries(
      entries,
      (entry) => `
        <div class="list-item">
          <div>
            <div class="list-item-title">${escapeHtml(entry.name)}</div>
            <div class="compact-row-copy">${escapeHtml(formatTeamLabel(entry.teamCode))}</div>
          </div>
          <strong>${escapeHtml(entry.goals)} goals</strong>
        </div>
      `,
      "No goals recorded."
    );
  }

  function renderGoalkeepingBlock(goalkeepingByTeam) {
    const entries = Object.entries(goalkeepingByTeam)
      .flatMap(([teamCode, rows]) => rows.map((row) => ({ ...row, teamCode })))
      .sort((left, right) => {
        if (right.clean_sheet !== left.clean_sheet) {
          return Number(right.clean_sheet) - Number(left.clean_sheet);
        }
        return Number(right.goal_keeps || 0) - Number(left.goal_keeps || 0);
      });

    return renderListFromEntries(
      entries,
      (entry) => `
        <div class="list-item">
          <div>
            <div class="list-item-title">${escapeHtml(entry.name)}</div>
            <div class="compact-row-copy">${escapeHtml(formatTeamLabel(entry.teamCode))}</div>
          </div>
          <strong>${escapeHtml(`${entry.goal_keeps || 0} GK${entry.clean_sheet ? " · CS" : ""}`)}</strong>
        </div>
      `,
      "No goalkeeping stats recorded."
    );
  }

  function seasonBadgeLabel(seasonLabel) {
    const yearMatch = String(seasonLabel || "").match(/\b(\d{4})\b/);
    return yearMatch ? yearMatch[1].slice(-2) : "??";
  }

  function championArtworkForSeason(seasonLabel) {
    return (
      championArtLibrary.find((entry) => entry.match.test(String(seasonLabel || ""))) || {
        theme: "club",
        label: "Club",
        src: "./assets/images/home-hero-mandarinas-v1.png",
        alt: "Mandarinas CF players competing at golden hour.",
      }
    );
  }

  async function renderPastWinners(seasons, currentSeasonId) {
    const priorSeasons = (seasons || [])
      .filter((entry) => Number(entry.id) !== Number(currentSeasonId))
      .slice(-6)
      .reverse();

    if (!priorSeasons.length) {
      pastWinnersCard.hidden = true;
      return;
    }

    const winnerRows = (
      await Promise.all(
        priorSeasons.map(async (season) => {
          try {
            const bundle = await fetchSeasonBundle(season.id);
            const completedMatchdays = buildCompletedMatchdays(bundle.matchdays, bundle.matches);
            const standings = buildStandings(
              bundle.players,
              bundle.assignments,
              bundle.playerStats,
              completedMatchdays,
              bundle.season
            );

            if (!standings.length) {
              return null;
            }

            return { season, winner: standings[0] };
          } catch (error) {
            console.error(`[Home] Failed to load past winner for ${season.name}:`, error);
            return null;
          }
        })
      )
    ).filter(Boolean);

    if (!winnerRows.length) {
      pastWinnersCard.hidden = true;
      return;
    }

    pastWinnersCard.hidden = false;
    pastWinnersList.innerHTML = winnerRows
      .map(({ season, winner }) => {
        const nameParts = playerNameParts(winner.player);
        const art = championArtworkForSeason(season.name);
        const nationality = winner.player?.nationality || "";
        const flag = nationalityFlag(nationality);
        return `
          <article class="champion-card champion-card--${escapeHtml(art.theme)}">
            <div class="champion-card-media">
              <img
                src="${escapeHtml(art.src)}"
                alt="${escapeHtml(art.alt)}"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div class="champion-card-body">
              <div class="champion-card-meta">
                <span class="champion-card-badge">${badgeIconMarkup("winner")}<span>Winner</span></span>
                <span class="champion-card-season">${escapeHtml(`${art.label} '${seasonBadgeLabel(season.name)}`)}</span>
              </div>
              <div class="champion-card-name">
                ${
                  flag
                    ? `<span class="champion-card-name-flag" role="img" aria-label="${escapeHtml(nationality)}">${escapeHtml(flag)}</span>`
                    : ""
                }
                <span>${escapeHtml(nameParts.primary || playerDisplayName(winner.player))}</span>
              </div>
              <div class="champion-card-copy">${escapeHtml(season.name)}</div>
              <div class="champion-card-points">${escapeHtml(`${winner.total_points} pts`)}</div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function init() {
    try {
      const health = await checkConnection();
      if (!health.ok) {
        heroCopy.textContent = health.reason;
        leadersPoints.innerHTML = `<div class="empty-state">${escapeHtml(health.reason)}</div>`;
        leadersGoals.innerHTML = `<div class="empty-state">${escapeHtml(health.reason)}</div>`;
        leadersAttendance.innerHTML = `<div class="empty-state">${escapeHtml(health.reason)}</div>`;
        return;
      }

      const seasons = await fetchSeasons();
      const season = pickSeason(seasons, null);

      if (!season) {
        heroCopy.textContent = "No season has been created yet.";
        leadersPoints.innerHTML = '<div class="empty-state">No active season yet.</div>';
        leadersGoals.innerHTML = '<div class="empty-state">No active season yet.</div>';
        leadersAttendance.innerHTML = '<div class="empty-state">No active season yet.</div>';
        latestResultsCard.hidden = true;
        mvpCard.hidden = true;
        pastWinnersCard.hidden = true;
        return;
      }

      const bundle = await fetchSeasonBundle(season.id);
      const completedMatchdays = buildCompletedMatchdays(bundle.matchdays, bundle.matches);
      const standings = buildStandings(
        bundle.players,
        bundle.assignments,
        bundle.playerStats,
        completedMatchdays,
        bundle.season
      );

      const now = Date.now();
      const upcoming = (bundle.matchdays || [])
        .filter((matchday) => matchday.kickoff_at && new Date(matchday.kickoff_at).getTime() >= now)
        .sort((left, right) => new Date(left.kickoff_at) - new Date(right.kickoff_at))[0];
      const latestCompleted = completedMatchdays[completedMatchdays.length - 1] || null;

      seasonName.textContent = season.name;
      seasonSub.textContent = `${season.total_matchdays} matchdays scheduled`;
      completedDays.textContent = String(completedMatchdays.length);
      rankedPlayers.textContent = String(standings.length);
      heroCopy.textContent = `${season.name} is live. Review the next kickoff, latest results, and current standings here.`;

      if (upcoming) {
        nextMatchdayNumber.textContent = `MD ${upcoming.matchday_number}`;
        nextMatchdayDate.textContent = formatDateTime(upcoming.kickoff_at);
        nextMatchdayWeather.textContent = "Loading the forecast for Alden E. Oliver...";

        if (weatherApi) {
          void weatherApi
            .loadSingleMatchdayWeather(upcoming)
            .then((snapshot) => {
              const description = weatherApi.describeMatchdayWeather(snapshot, { includeVenue: true });
              nextMatchdayWeather.textContent = `${description.headline}${description.detail ? ` · ${description.detail}` : ""}`;
            })
            .catch((error) => {
              console.error("[Home] Weather load failed:", error);
              nextMatchdayWeather.textContent = "Forecast unavailable.";
            });
        } else {
          nextMatchdayWeather.textContent = "Forecast unavailable.";
        }
      } else {
        nextMatchdayNumber.textContent = "Complete";
        nextMatchdayDate.textContent = "No future kickoff scheduled.";
        nextMatchdayWeather.textContent = "No upcoming kickoff scheduled.";
      }

      renderLeaderboard(leadersPoints, standings, (entry) => entry.total_points, "pts");
      renderLeaderboard(leadersGoals, standings, (entry) => entry.goals, "goals");
      renderLeaderboard(leadersAttendance, standings, (entry) => entry.days_attended, "days");
      renderSeasonLeader(standings[0] || null);
      void renderPastWinners(seasons, season.id);

      if (latestCompleted) {
        latestResultsCard.hidden = false;
        const scorersByTeam = buildScorersForMatchday(
          latestCompleted.id,
          bundle.assignments,
          bundle.playerStats,
          bundle.players
        );
        const goalkeepingByTeam = buildGoalkeepingForMatchday(
          latestCompleted.id,
          bundle.assignments,
          bundle.playerStats,
          bundle.players
        );

        latestResultsTitle.textContent = `Matchday ${latestCompleted.matchday_number}`;
        latestResultsCopy.textContent = `${formatDateTime(latestCompleted.kickoff_at)} · ${
          latestCompleted.goals_count_as_points ? "team goals counted toward points" : "team goals stayed as tie-breakers"
        }`;
        latestResultsBody.innerHTML = `
          <div class="detail-card">
            <div class="section-label">Scores</div>
            <div class="score-list">${latestCompleted.matches.map((match) => resultMatchMarkup(match)).join("")}</div>
          </div>
          <div class="detail-card">
            <div class="section-label">Scorers</div>
            ${renderScorersBlock(scorersByTeam)}
          </div>
          <div class="detail-card">
            <div class="section-label">Goalkeeping</div>
            ${renderGoalkeepingBlock(goalkeepingByTeam)}
          </div>
        `;
      } else {
        latestResultsCard.hidden = true;
      }
    } catch (error) {
      const message = readableError(error);
      heroCopy.textContent = message;
      leadersPoints.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      leadersGoals.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      leadersAttendance.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      latestResultsCard.hidden = true;
      mvpCard.hidden = true;
      pastWinnersCard.hidden = true;
    }
  }

  init();
});
