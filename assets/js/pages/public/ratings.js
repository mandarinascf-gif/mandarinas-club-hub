document.addEventListener("DOMContentLoaded", () => {
  if (!window.MandarinasPublic) {
    const statusLine = document.getElementById("ratings-status-line");
    if (statusLine) {
      statusLine.textContent =
        "MandarinasPublic failed to load. Check browser console for connection or script errors.";
      statusLine.className = "status-line error";
    }
    console.error("[MandarinasPublic] Fatal: MandarinasPublic is undefined");
    return;
  }

  const supabaseClient = window.MandarinasSupabaseConfig.createClient();
  const {
    escapeHtml,
    formatDateTime,
    formatLongDate,
    formatTeamLabel,
    teamClassName,
    playerDisplayName,
    readableError: baseReadableError,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    buildCompletedMatchdays,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const RATING_QUESTIONS = [
    {
      key: "first_touch",
      label: "First touch / control",
      hint: "Did they control the ball cleanly and keep it moving?",
    },
    {
      key: "passing_vision",
      label: "Passing / vision",
      hint: "Did they connect play and spot good options?",
    },
    {
      key: "defensive_work",
      label: "Defensive work",
      hint: "Did they recover, press, and protect the team shape?",
    },
    {
      key: "positioning",
      label: "Positioning / decisions",
      hint: "Did they take smart spaces and make good match decisions?",
    },
    {
      key: "work_rate",
      label: "Work rate / team play",
      hint: "Did they compete, support teammates, and stay involved?",
    },
    {
      key: "impact",
      label: "Overall impact",
      hint: "How much did they influence the match tonight?",
    },
  ];

  const params = new URLSearchParams(window.location.search);
  const previewMode = params.get("preview") === "1";
  const requestedSeasonId = querySeasonIdFromUrl();
  const requestedMatchdayId = Number(params.get("matchday_id"));
  const requestedPlayerId = Number(params.get("player_id"));
  const hasExplicitSeasonQuery = Number.isInteger(requestedSeasonId) && requestedSeasonId > 0;
  const hasExplicitMatchdayQuery = Number.isInteger(requestedMatchdayId) && requestedMatchdayId > 0;

  const heroCopy = document.getElementById("ratings-hero-copy");
  const scheduleLink = document.getElementById("ratings-schedule-link");
  const openStatsLink = document.getElementById("ratings-open-stats-link");
  const statusLine = document.getElementById("ratings-status-line");
  const reportTitle = document.getElementById("ratings-report-title");
  const seasonField = document.getElementById("ratings-season-field");
  const seasonSelect = document.getElementById("ratings-season-select");
  const matchdayField = document.getElementById("ratings-matchday-field");
  const matchdaySelect = document.getElementById("ratings-matchday-select");
  const reportCard = document.getElementById("ratings-report-card");
  const summarySeason = document.getElementById("ratings-season-pill");
  const summaryMatchday = document.getElementById("ratings-matchday-pill");
  const summaryMatchdayCopy = document.getElementById("ratings-matchday-copy");
  const summaryPlayer = document.getElementById("ratings-player-pill");
  const summaryPlayerCopy = document.getElementById("ratings-player-copy");
  const summaryProgress = document.getElementById("ratings-progress-pill");
  const summaryProgressCopy = document.getElementById("ratings-progress-copy");
  const windowNote = document.getElementById("ratings-window-note");
  const playerPanelCopy = document.getElementById("ratings-player-panel-copy");
  const playerSelect = document.getElementById("ratings-player-select");
  const selectedPlayerCard = document.getElementById("ratings-selected-player-card");
  const ratingsCopy = document.getElementById("ratings-copy");
  const ratingTeammateCount = document.getElementById("rating-teammate-count");
  const ratingOpponentCount = document.getElementById("rating-opponent-count");
  const ratingSavedCount = document.getElementById("rating-saved-count");
  const ratingTargets = document.getElementById("submission-rating-targets");
  const ratingForm = document.getElementById("submission-rating-form");
  const ratingsEmpty = document.getElementById("submission-ratings-empty");
  const ratingRelationship = document.getElementById("submission-rating-relationship");
  const ratingName = document.getElementById("submission-rating-name");
  const ratingProgressCopy = document.getElementById("submission-rating-progress-copy");
  const ratingTeamPill = document.getElementById("submission-rating-team-pill");
  const ratingQuestionList = document.getElementById("submission-rating-question-list");
  const ratingCommentInput = document.getElementById("submission-rating-comment");
  const saveRatingButton = document.getElementById("submission-save-rating-button");
  const nextRatingButton = document.getElementById("submission-next-rating-button");
  const ratingNote = document.getElementById("submission-rating-note");

  let seasons = [];
  let activeSeasonId = requestedSeasonId;
  let selectedMatchdayId =
    Number.isInteger(requestedMatchdayId) && requestedMatchdayId > 0 ? requestedMatchdayId : null;
  let selectedPlayerId =
    Number.isInteger(requestedPlayerId) && requestedPlayerId > 0 ? requestedPlayerId : null;
  let selectedRateeId = null;
  let activeBundle = null;
  let statSubmissions = [];
  let ratingSubmissions = [];
  let ratingDrafts = new Map();
  let matchdayWindowMap = new Map();
  let windowsSupported = true;
  let submissionTablesReady = true;

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function setStatus(message, tone = "") {
    statusLine.textContent = message;
    statusLine.className = tone ? `status-line ${tone}` : "status-line";
  }

  function updateUrl() {
    const url = new URL(window.location.href);

    if (activeSeasonId) {
      url.searchParams.set("season_id", String(activeSeasonId));
    } else {
      url.searchParams.delete("season_id");
    }

    if (selectedMatchdayId) {
      url.searchParams.set("matchday_id", String(selectedMatchdayId));
    } else {
      url.searchParams.delete("matchday_id");
    }

    if (selectedPlayerId) {
      url.searchParams.set("player_id", String(selectedPlayerId));
    } else {
      url.searchParams.delete("player_id");
    }

    if (previewMode) {
      url.searchParams.set("preview", "1");
    } else {
      url.searchParams.delete("preview");
    }

    window.history.replaceState({}, "", url);
  }

  function scrollToPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }

    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toDate(value) {
    return value ? new Date(value) : null;
  }

  function addDuration(baseDate, hours) {
    if (!baseDate) {
      return null;
    }

    return new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
  }

  function liveWindowRank(matchday) {
    const state = matchdayWindowState(matchday);

    if (state.statsOpen) {
      return 2;
    }

    if (state.ratingsOpen) {
      return 1;
    }

    return 0;
  }

  function newestLiveWindowMatchday(rows) {
    return (rows || [])
      .filter((matchday) => liveWindowRank(matchday) > 0)
      .sort((left, right) => {
        const rankGap = liveWindowRank(right) - liveWindowRank(left);
        if (rankGap !== 0) {
          return rankGap;
        }

        const leftStart = matchdayWindowState(left).openAt?.getTime() || 0;
        const rightStart = matchdayWindowState(right).openAt?.getTime() || 0;
        return rightStart - leftStart;
      })[0] || null;
  }

  function hasMissingWindowColumns(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      (message.includes("column") || message.includes("schema cache")) &&
      (
        message.includes("player_stats_open_at") ||
        message.includes("player_stats_close_at") ||
        message.includes("player_ratings_close_at") ||
        message.includes("admin_review_locked_at")
      )
    );
  }

  function hasMissingSubmissionTables(error) {
    const message = String(error?.message || "").toLowerCase();
    const mentionsSubmissionTable =
      message.includes("matchday_stat_submissions") ||
      message.includes("matchday_player_ratings");

    return mentionsSubmissionTable && (
      message.includes("relation") ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find")
    );
  }

  function readableSubmissionError(error) {
    if (hasMissingSubmissionTables(error)) {
      return "Player reports are still in view mode while live saving is being switched on.";
    }

    if (hasMissingWindowColumns(error)) {
      return "Player report windows are not scheduled for this matchday yet.";
    }

    return baseReadableError(error);
  }

  async function fetchMatchdayWindows(seasonId) {
    windowsSupported = true;

    const { data, error } = await supabaseClient
      .from("matchdays")
      .select("id, player_stats_open_at, player_stats_close_at, player_ratings_close_at, admin_review_locked_at")
      .eq("season_id", seasonId);

    if (error && hasMissingWindowColumns(error)) {
      windowsSupported = false;
      return new Map();
    }

    if (error) {
      throw error;
    }

    return new Map((data || []).map((row) => [row.id, row]));
  }

  function mergeMatchdayWindows(bundle) {
    if (!bundle) {
      return bundle;
    }

    return {
      ...bundle,
      matchdays: (bundle.matchdays || []).map((matchday) => ({
        ...matchday,
        ...(matchdayWindowMap.get(matchday.id) || {}),
      })),
    };
  }

  function selectedMatchday() {
    return (activeBundle?.matchdays || []).find((row) => Number(row.id) === Number(selectedMatchdayId)) || null;
  }

  function matchdayWindowState(matchday) {
    const kickoffAt = toDate(matchday?.kickoff_at);
    const openAt = toDate(matchday?.player_stats_open_at) || addDuration(kickoffAt, 1);
    const statsCloseAt = toDate(matchday?.player_stats_close_at) || addDuration(kickoffAt, 13);
    const ratingsCloseAt =
      toDate(matchday?.player_ratings_close_at) ||
      (kickoffAt ? addDuration(kickoffAt, 7 * 24) : null);
    const now = Date.now();
    const hasStarted = Boolean(openAt && now >= openAt.getTime());
    const statsClosed = Boolean(statsCloseAt && now > statsCloseAt.getTime());
    const ratingsClosed = Boolean(ratingsCloseAt && now > ratingsCloseAt.getTime());

    return {
      openAt,
      statsCloseAt,
      ratingsCloseAt,
      statsOpen: previewMode || (hasStarted && !statsClosed),
      ratingsOpen: previewMode || (hasStarted && !ratingsClosed),
      statsClosed,
      ratingsClosed,
    };
  }

  function defaultMatchdayId(bundle) {
    const allMatchdays = bundle?.matchdays || [];

    if (allMatchdays.some((row) => Number(row.id) === Number(selectedMatchdayId))) {
      return selectedMatchdayId;
    }

    const activeWindowMatchday = newestLiveWindowMatchday(allMatchdays);
    if (activeWindowMatchday) {
      return activeWindowMatchday.id;
    }

    if (!previewMode) {
      return null;
    }

    const completed = buildCompletedMatchdays(allMatchdays, bundle?.matches || []);
    if (completed.length) {
      return completed[completed.length - 1].id;
    }

    const withKickoff = allMatchdays.filter((row) => row.kickoff_at);
    if (withKickoff.length) {
      return withKickoff[withKickoff.length - 1].id;
    }

    return allMatchdays[0]?.id || null;
  }

  async function detectActiveMatchdayRef() {
    let data = null;
    let error = null;

    ({ data, error } = await supabaseClient
      .from("matchdays")
      .select("id, season_id, matchday_number, kickoff_at, player_stats_open_at, player_stats_close_at, player_ratings_close_at")
      .order("kickoff_at", { ascending: false })
      .limit(200));

    if (error && hasMissingWindowColumns(error)) {
      windowsSupported = false;
      ({ data, error } = await supabaseClient
        .from("matchdays")
        .select("id, season_id, matchday_number, kickoff_at")
        .order("kickoff_at", { ascending: false })
        .limit(200));
    }

    if (error) {
      throw error;
    }

    const active = newestLiveWindowMatchday(data || []);
    return active ? { seasonId: active.season_id, matchdayId: active.id } : null;
  }

  async function loadSubmissionsForMatchday() {
    statSubmissions = [];
    ratingSubmissions = [];
    ratingDrafts = new Map();
    submissionTablesReady = true;

    if (!selectedMatchdayId) {
      return;
    }

    const [{ data: statRows, error: statError }, { data: ratingRows, error: ratingError }] =
      await Promise.all([
        supabaseClient
          .from("matchday_stat_submissions")
          .select("*")
          .eq("matchday_id", selectedMatchdayId)
          .limit(5000),
        supabaseClient
          .from("matchday_player_ratings")
          .select("*")
          .eq("matchday_id", selectedMatchdayId)
          .limit(10000),
      ]);

    const error = statError || ratingError;
    if (error && hasMissingSubmissionTables(error)) {
      submissionTablesReady = false;
      return;
    }

    if (error) {
      throw error;
    }

    statSubmissions = statRows || [];
    ratingSubmissions = ratingRows || [];
  }

  function playerMap() {
    return new Map((activeBundle?.players || []).map((player) => [player.id, player]));
  }

  function assignmentRowsForMatchday() {
    return (activeBundle?.assignments || []).filter(
      (assignment) => Number(assignment.matchday_id) === Number(selectedMatchdayId)
    );
  }

  function statSubmissionForPlayer(playerId) {
    return (
      statSubmissions.find(
        (row) =>
          Number(row.matchday_id) === Number(selectedMatchdayId) &&
          Number(row.player_id) === Number(playerId) &&
          Number(row.submitted_by_player_id) === Number(playerId)
      ) || null
    );
  }

  function ratingRowsForPlayer(playerId) {
    return ratingSubmissions.filter((row) => Number(row.rater_player_id) === Number(playerId));
  }

  function eligiblePlayers() {
    const playersById = playerMap();
    const assignments = assignmentRowsForMatchday();
    const rows = [];
    const seenIds = new Set();

    assignments.forEach((assignment) => {
      const player = playersById.get(assignment.player_id);
      if (!player || seenIds.has(player.id)) {
        return;
      }

      seenIds.add(player.id);
      rows.push({
        ...player,
        team_code: assignment.team_code,
      });
    });

    if (!rows.length) {
      (activeBundle?.playerStats || [])
        .filter((row) => Number(row.matchday_id) === Number(selectedMatchdayId))
        .filter((row) => {
          const status = normalizeText(row.attendance_status || "").toLowerCase();
          return row.attended || status === "in" || status === "attended";
        })
        .forEach((row) => {
          const player = playersById.get(row.player_id);
          if (!player || seenIds.has(player.id)) {
            return;
          }

          seenIds.add(player.id);
          rows.push({
            ...player,
            team_code: null,
          });
        });
    }

    const totalTargets = Math.max(assignments.length - 1, 0);

    return rows
      .map((player) => ({
        ...player,
        stat_saved: Boolean(statSubmissionForPlayer(player.id)),
        ratings_saved: ratingRowsForPlayer(player.id).length,
        ratings_total: player.team_code ? totalTargets : 0,
      }))
      .sort((left, right) => playerDisplayName(left).localeCompare(playerDisplayName(right)));
  }

  function filteredPlayersForSelect() {
    return eligiblePlayers().filter(
      (player) => previewMode || player.stat_saved || Number(player.id) === Number(selectedPlayerId)
    );
  }

  function selectedPlayer() {
    return eligiblePlayers().find((player) => Number(player.id) === Number(selectedPlayerId)) || null;
  }

  function statsHref(playerId) {
    const url = new URL("./submissions.html", window.location.href);

    if (activeSeasonId) {
      url.searchParams.set("season_id", String(activeSeasonId));
    }

    if (selectedMatchdayId) {
      url.searchParams.set("matchday_id", String(selectedMatchdayId));
    }

    if (playerId) {
      url.searchParams.set("player_id", String(playerId));
    }

    if (previewMode) {
      url.searchParams.set("preview", "1");
    }

    return `${url.pathname}${url.search}`;
  }

  function ratingTargetsForPlayer(player) {
    if (!player?.team_code) {
      return [];
    }

    const playersById = playerMap();
    return assignmentRowsForMatchday()
      .filter((assignment) => Number(assignment.player_id) !== Number(player.id))
      .map((assignment) => {
        const ratee = playersById.get(assignment.player_id);
        if (!ratee) {
          return null;
        }

        const relationship = assignment.team_code === player.team_code ? "teammate" : "opponent";
        return {
          ...ratee,
          relationship,
          team_code: assignment.team_code,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (left.relationship !== right.relationship) {
          return left.relationship.localeCompare(right.relationship);
        }

        return playerDisplayName(left).localeCompare(playerDisplayName(right));
      });
  }

  function savedRatingForTarget(rateeId) {
    return (
      ratingSubmissions.find(
        (row) =>
          Number(row.matchday_id) === Number(selectedMatchdayId) &&
          Number(row.rater_player_id) === Number(selectedPlayerId) &&
          Number(row.ratee_player_id) === Number(rateeId)
      ) || null
    );
  }

  function ratingDraftFor(rateeId) {
    if (!rateeId) {
      return null;
    }

    if (ratingDrafts.has(rateeId)) {
      return ratingDrafts.get(rateeId);
    }

    const saved = savedRatingForTarget(rateeId);
    const nextDraft = {
      scores: { ...(saved?.scores || {}) },
      comment: saved?.comment || "",
    };
    ratingDrafts.set(rateeId, nextDraft);
    return nextDraft;
  }

  function ensureRateeSelection() {
    const targets = ratingTargetsForPlayer(selectedPlayer());
    if (!targets.some((target) => Number(target.id) === Number(selectedRateeId))) {
      selectedRateeId = targets[0]?.id || null;
    }
  }

  function ratingProgressText(targetCount, savedCount) {
    if (!targetCount) {
      return "No teammate or opponent queue is ready for this player yet.";
    }

    if (savedCount === targetCount) {
      return "Every available rating in this queue has been saved.";
    }

    return `${savedCount} of ${targetCount} ratings saved.`;
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

  function renderMatchdayOptions() {
    const rows = (activeBundle?.matchdays || []).slice().sort((left, right) => left.matchday_number - right.matchday_number);

    if (!rows.length) {
      matchdaySelect.innerHTML = '<option value="">No matchdays available</option>';
      matchdaySelect.disabled = true;
      return;
    }

    matchdaySelect.disabled = !previewMode;
    matchdaySelect.innerHTML = rows
      .map((matchday) => {
        const submissionState = matchdayWindowState(matchday);
        const suffix = previewMode
          ? (matchday.kickoff_at ? formatDateTime(matchday.kickoff_at) : "Preview")
          : submissionState.ratingsOpen
            ? "Ratings open"
            : submissionState.statsOpen
              ? "Stats first"
              : "Closed";

        return `
          <option value="${matchday.id}" ${Number(matchday.id) === Number(selectedMatchdayId) ? "selected" : ""}>
            Matchday ${matchday.matchday_number} · ${escapeHtml(suffix)}
          </option>
        `;
      })
      .join("");
  }

  function windowNoteMarkup(matchday) {
    if (!matchday) {
      return previewMode
        ? "Open a matchday first. Staff can test the ratings flow while official records stay locked."
        : "No live player ratings window is open right now.";
    }

    if (!submissionTablesReady) {
      return "Live rating saving is not switched on for this screen yet.";
    }

    const state = matchdayWindowState(matchday);

    if (previewMode) {
      return "Open access is on right now so staff can test the ratings flow.";
    }

    if (!matchday.kickoff_at) {
      return "This matchday has no kickoff time yet, so the player ratings window has not opened.";
    }

    if (state.ratingsOpen) {
      return `The live ratings window is open now and closes ${formatLongDate(state.ratingsCloseAt)}.`;
    }

    if (state.ratingsClosed) {
      return "The player ratings window is closed for this matchday.";
    }

    return `Ratings open after kickoff and stay available until ${formatLongDate(state.ratingsCloseAt)}.`;
  }

  function renderReportCard() {
    const matchday = selectedMatchday();

    if (!matchday) {
      reportCard.innerHTML = '<div class="empty-state">No live player ratings report is open right now.</div>';
      return;
    }

    const state = matchdayWindowState(matchday);
    const badges = [];

    if (matchday.kickoff_at) {
      badges.push(`<span class="tag-pill">${escapeHtml(formatDateTime(matchday.kickoff_at))}</span>`);
    } else {
      badges.push('<span class="tag-pill">Kickoff not scheduled</span>');
    }

    if (state.ratingsOpen) {
      badges.push('<span class="tag-pill plan-selected">Ratings open</span>');
    } else if (state.statsOpen) {
      badges.push('<span class="tag-pill">Stats first</span>');
    } else {
      badges.push('<span class="tag-pill">Closed</span>');
    }

    reportCard.innerHTML = `
      <div class="section-label">Current report</div>
      <h3>Matchday ${escapeHtml(matchday.matchday_number)}</h3>
      <div class="compact-badges">${badges.join("")}</div>
    `;
  }

  function renderPlayerOptions() {
    const matchday = selectedMatchday();
    const rows = filteredPlayersForSelect();

    if (!matchday) {
      playerSelect.innerHTML = '<option value="">Waiting for the current report</option>';
      playerSelect.disabled = true;
      return;
    }

    if (!rows.length) {
      playerSelect.innerHTML = previewMode
        ? '<option value="">No players available</option>'
        : '<option value="">Stats need to be saved first</option>';
      playerSelect.disabled = true;
      return;
    }

    playerSelect.disabled = false;
    playerSelect.innerHTML = `
      <option value="">Choose your name</option>
      ${rows
        .map((player) => {
          const teamLabel = player.team_code ? formatTeamLabel(player.team_code) : "No team";
          const suffix = player.stat_saved ? `${teamLabel} · Ready` : `${teamLabel} · Stats first`;
          return `
            <option value="${player.id}" ${Number(player.id) === Number(selectedPlayerId) ? "selected" : ""}>
              ${escapeHtml(playerDisplayName(player))} · ${escapeHtml(suffix)}
            </option>
          `;
        })
        .join("")}
    `;
  }

  function renderSelectedPlayerCard() {
    const player = selectedPlayer();
    const matchday = selectedMatchday();

    if (!player || !matchday) {
      selectedPlayerCard.innerHTML = '<div class="empty-state">Choose your name first.</div>';
      openStatsLink.href = statsHref(selectedPlayerId || "");
      return;
    }

    const savedCount = ratingRowsForPlayer(player.id).length;
    const targetCount = ratingTargetsForPlayer(player).length;
    const teamBadge = player.team_code
      ? `<span class="team-badge ${escapeHtml(teamClassName(player.team_code))}">${escapeHtml(formatTeamLabel(player.team_code))}</span>`
      : '<span class="tag-pill">No team saved</span>';

    selectedPlayerCard.innerHTML = `
      <div class="submission-player-meta">
        <div>
          <div class="section-label">Selected player</div>
          <h3>${escapeHtml(playerDisplayName(player))}</h3>
          <p class="section-copy">${escapeHtml(matchday.kickoff_at ? formatDateTime(matchday.kickoff_at) : `Matchday ${matchday.matchday_number}`)}</p>
        </div>
        ${teamBadge}
      </div>
      <div class="compact-badges">
        <span class="tag-pill">${player.stat_saved ? "Stats saved" : "Stats required first"}</span>
        <span class="tag-pill">${escapeHtml(savedCount)} / ${escapeHtml(targetCount)} rated</span>
      </div>
    `;

    openStatsLink.href = statsHref(player.id);
  }

  function renderRatingQuestions() {
    const target = ratingTargetsForPlayer(selectedPlayer()).find(
      (entry) => Number(entry.id) === Number(selectedRateeId)
    );
    const draft = ratingDraftFor(selectedRateeId);

    if (!target || !draft) {
      ratingQuestionList.innerHTML = "";
      return;
    }

    ratingQuestionList.innerHTML = RATING_QUESTIONS.map((question) => {
      const selectedValue = Number(draft.scores?.[question.key] || 0);

      return `
        <section class="submission-rating-question">
          <div class="submission-rating-question-copy">
            <strong>${escapeHtml(question.label)}</strong>
            <span>${escapeHtml(question.hint)}</span>
          </div>
          <div class="submission-rating-scale" role="group" aria-label="${escapeHtml(question.label)}">
            ${[1, 2, 3, 4, 5]
              .map(
                (value) => `
                  <button
                    class="chip-button ${selectedValue === value ? "active" : ""}"
                    type="button"
                    data-rating-question="${escapeHtml(question.key)}"
                    data-rating-score="${escapeHtml(value)}"
                    aria-pressed="${selectedValue === value ? "true" : "false"}"
                  >
                    ${escapeHtml(value)}
                  </button>
                `
              )
              .join("")}
          </div>
        </section>
      `;
    }).join("");

    ratingCommentInput.value = draft.comment || "";
  }

  function nextTargetId() {
    const targets = ratingTargetsForPlayer(selectedPlayer());
    if (!targets.length) {
      return null;
    }

    const firstIncomplete = targets.find((target) => !savedRatingForTarget(target.id));
    if (firstIncomplete && Number(firstIncomplete.id) !== Number(selectedRateeId)) {
      return firstIncomplete.id;
    }

    const currentIndex = targets.findIndex((target) => Number(target.id) === Number(selectedRateeId));
    if (currentIndex >= 0 && currentIndex < targets.length - 1) {
      return targets[currentIndex + 1].id;
    }

    return targets[0].id;
  }

  function renderRatings() {
    const player = selectedPlayer();
    const matchday = selectedMatchday();
    const targets = ratingTargetsForPlayer(player);
    const teammateCount = targets.filter((target) => target.relationship === "teammate").length;
    const opponentCount = targets.filter((target) => target.relationship === "opponent").length;
    const savedCount = ratingRowsForPlayer(player?.id).length;

    ensureRateeSelection();

    ratingTeammateCount.textContent = String(teammateCount);
    ratingOpponentCount.textContent = String(opponentCount);
    ratingSavedCount.textContent = String(savedCount);

    if (!player || !matchday) {
      ratingTargets.innerHTML = '<div class="empty-state">Choose your name first.</div>';
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "Choose your name first.";
      return;
    }

    if (!previewMode && !player.stat_saved) {
      ratingTargets.innerHTML = '<div class="empty-state">Save your stat line first on the Player Stats page, then come back to ratings.</div>';
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "Save your stat line first on the Player Stats page, then come back to ratings.";
      ratingsCopy.textContent = "Ratings stay separate so you only arrive here after your own stat line is saved.";
      return;
    }

    if (!targets.length) {
      ratingTargets.innerHTML = '<div class="empty-state">No teammate or opponent queue is available until teams are saved for this matchday.</div>';
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "No teammate or opponent queue is available until teams are saved for this matchday.";
      ratingsCopy.textContent = "Ratings appear once the matchday has saved team assignments.";
      return;
    }

    ratingTargets.innerHTML = targets
      .map((target) => {
        const saved = Boolean(savedRatingForTarget(target.id));
        const active = Number(target.id) === Number(selectedRateeId);

        return `
          <button
            class="submission-target-chip ${active ? "active" : ""} ${saved ? "complete" : ""}"
            type="button"
            data-ratee-id="${target.id}"
          >
            <span>${escapeHtml(playerDisplayName(target))}</span>
            <span class="mini-sub">${escapeHtml(target.relationship === "teammate" ? "Teammate" : "Opponent")}</span>
          </button>
        `;
      })
      .join("");

    const target = targets.find((entry) => Number(entry.id) === Number(selectedRateeId));
    const submissionState = matchdayWindowState(matchday);
    const saveEnabled = submissionTablesReady && submissionState.ratingsOpen && Boolean(target);

    if (!target) {
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "Choose one player from the rating queue to continue.";
      return;
    }

    ratingsEmpty.hidden = true;
    ratingForm.hidden = false;
    ratingRelationship.textContent = target.relationship === "teammate" ? "Teammate" : "Opponent";
    ratingName.textContent = playerDisplayName(target);
    ratingTeamPill.className = `team-badge ${escapeHtml(teamClassName(target.team_code))}`;
    ratingTeamPill.textContent = formatTeamLabel(target.team_code);
    ratingProgressCopy.textContent = ratingProgressText(targets.length, savedCount);
    ratingsCopy.textContent = submissionTablesReady
      ? "Use the same soccer-specific scale for every player so staff can compare reports cleanly."
      : "Live rating saving is not switched on for this screen yet.";
    saveRatingButton.disabled = !saveEnabled;
    nextRatingButton.disabled = !targets.length;
    ratingNote.textContent = !submissionTablesReady
      ? "Saving is disabled until live rating saving is switched on."
      : previewMode
        ? "Open access is on right now so staff can test the ratings flow."
        : submissionState.ratingsOpen
          ? `Ratings stay open until ${formatLongDate(submissionState.ratingsCloseAt)}.`
          : "Ratings are not open for this matchday right now.";

    renderRatingQuestions();
  }

  function updateSummary() {
    const matchday = selectedMatchday();
    const player = selectedPlayer();
    const targets = ratingTargetsForPlayer(player);
    const savedCount = ratingRowsForPlayer(player?.id).length;

    summarySeason.textContent = activeBundle?.season?.name || "-";
    summaryMatchday.textContent = matchday ? `MD ${matchday.matchday_number}` : "-";
    summaryMatchdayCopy.textContent = matchday
      ? (matchday.kickoff_at ? formatDateTime(matchday.kickoff_at) : "Kickoff not scheduled")
      : "Waiting for the live report.";
    summaryPlayer.textContent = player ? playerDisplayName(player) : "-";
    summaryPlayerCopy.textContent = player
      ? (player.team_code ? `${formatTeamLabel(player.team_code)} · ${player.nationality || "Unknown"}` : player.nationality || "Matchday player")
      : "Pick yourself to continue.";
    summaryProgress.textContent = `${savedCount} / ${targets.length}`;
    summaryProgressCopy.textContent = ratingProgressText(targets.length, savedCount);
    windowNote.textContent = windowNoteMarkup(matchday);

    reportTitle.textContent = previewMode ? "Ratings Desk" : "Current Player Ratings";
    seasonField.hidden = !previewMode;
    matchdayField.hidden = !previewMode && Boolean(matchday);
    seasonSelect.disabled = !previewMode;

    playerPanelCopy.textContent = previewMode
      ? "Choose your name from this saved matchday. Open access keeps the full roster available for testing."
      : "Choose your name from the current roster. Live ratings stay focused on players who already saved stats.";

    const scheduleHref = activeSeasonId ? `./schedule.html?season_id=${activeSeasonId}` : "./schedule.html";
    scheduleLink.href = scheduleHref;
    openStatsLink.href = statsHref(player?.id || selectedPlayerId || "");
  }

  function renderAll() {
    updateUrl();
    renderMatchdayOptions();
    renderPlayerOptions();
    renderReportCard();
    renderSelectedPlayerCard();
    renderRatings();
    updateSummary();
  }

  async function loadSeason() {
    setStatus("Loading player ratings...");

    try {
      const bundle = await fetchSeasonBundle(activeSeasonId);
      matchdayWindowMap = await fetchMatchdayWindows(activeSeasonId);
      activeBundle = mergeMatchdayWindows(bundle);
      selectedMatchdayId = defaultMatchdayId(activeBundle);
      await loadSubmissionsForMatchday();

      if (!eligiblePlayers().some((player) => Number(player.id) === Number(selectedPlayerId))) {
        selectedPlayerId = null;
      }

      heroCopy.textContent = previewMode
        ? `${activeBundle.season.name} ratings desk is open for staff testing. Open any matchday, pick a player, and inspect the rating queue.`
        : selectedMatchdayId
          ? `${activeBundle.season.name} player ratings are live for the current matchday. Pick yourself and work through the queue after your stats are saved.`
          : `${activeBundle.season.name} player ratings are waiting for the next live window.`;

      renderAll();
      setStatus(
        submissionTablesReady
          ? "Player ratings loaded."
          : "Player ratings loaded in view mode.",
        submissionTablesReady ? "success" : "warning"
      );
    } catch (error) {
      const message = readableSubmissionError(error);
      setStatus(message, "error");
      reportCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      playerSelect.innerHTML = `<option value="">${escapeHtml(message)}</option>`;
      playerSelect.disabled = true;
      selectedPlayerCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      ratingTargets.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = message;
    }
  }

  async function saveRatingSubmission(event) {
    event.preventDefault();

    const player = selectedPlayer();
    const matchday = selectedMatchday();
    const target = ratingTargetsForPlayer(player).find((entry) => Number(entry.id) === Number(selectedRateeId));
    const draft = ratingDraftFor(selectedRateeId);

    if (!player || !matchday || !target || !draft) {
      setStatus("Choose yourself and one rating target first.", "warning");
      return;
    }

    if (!submissionTablesReady) {
      setStatus("Live rating saving is not switched on yet.", "warning");
      return;
    }

    if (!previewMode && !player.stat_saved) {
      setStatus("Save your stat line on the Player Stats page before rating this matchday.", "warning");
      return;
    }

    const submissionState = matchdayWindowState(matchday);
    if (!submissionState.ratingsOpen) {
      setStatus("The rating window is not open for this matchday right now.", "warning");
      return;
    }

    const missingQuestions = RATING_QUESTIONS.filter((question) => {
      const value = Number(draft.scores?.[question.key] || 0);
      return !Number.isInteger(value) || value < 1 || value > 5;
    });

    if (missingQuestions.length) {
      setStatus(`Finish every rating question for ${playerDisplayName(target)} before saving.`, "warning");
      return;
    }

    try {
      saveRatingButton.disabled = true;
      saveRatingButton.textContent = "Saving...";

      const { error } = await supabaseClient
        .from("matchday_player_ratings")
        .upsert(
          {
            matchday_id: matchday.id,
            rater_player_id: player.id,
            ratee_player_id: target.id,
            relationship: target.relationship,
            scores: draft.scores,
            comment: normalizeText(draft.comment || "") || null,
          },
          { onConflict: "matchday_id,rater_player_id,ratee_player_id" }
        );

      if (error) {
        throw error;
      }

      await loadSubmissionsForMatchday();
      selectedRateeId = nextTargetId();
      renderAll();
      setStatus(`Rating saved for ${playerDisplayName(target)}.`, "success");
    } catch (error) {
      setStatus(readableSubmissionError(error), "error");
    } finally {
      saveRatingButton.disabled = false;
      saveRatingButton.textContent = "Save rating";
    }
  }

  seasonSelect.addEventListener("change", async () => {
    activeSeasonId = Number(seasonSelect.value);
    selectedMatchdayId = null;
    selectedPlayerId = null;
    selectedRateeId = null;
    await loadSeason();
  });

  matchdaySelect.addEventListener("change", async () => {
    selectedMatchdayId = Number(matchdaySelect.value) || null;
    selectedPlayerId = null;
    selectedRateeId = null;
    await loadSubmissionsForMatchday();
    renderAll();
    scrollToPanel("ratings-player-panel");
  });

  playerSelect.addEventListener("change", () => {
    selectedPlayerId = Number(playerSelect.value) || null;
    selectedRateeId = null;
    renderAll();
    if (selectedPlayerId) {
      scrollToPanel("ratings-panel");
    }
  });

  ratingTargets.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ratee-id]");
    if (!button) {
      return;
    }

    selectedRateeId = Number(button.dataset.rateeId);
    renderAll();
  });

  ratingQuestionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rating-question]");
    if (!button || !selectedRateeId) {
      return;
    }

    const question = button.dataset.ratingQuestion;
    const score = Number(button.dataset.ratingScore);
    const draft = ratingDraftFor(selectedRateeId);
    if (!draft) {
      return;
    }

    draft.scores = {
      ...(draft.scores || {}),
      [question]: score,
    };

    ratingDrafts.set(selectedRateeId, draft);
    renderRatingQuestions();
  });

  ratingCommentInput.addEventListener("input", () => {
    const draft = ratingDraftFor(selectedRateeId);
    if (!draft) {
      return;
    }

    draft.comment = ratingCommentInput.value;
    ratingDrafts.set(selectedRateeId, draft);
  });

  ratingForm.addEventListener("submit", saveRatingSubmission);

  nextRatingButton.addEventListener("click", () => {
    const nextId = nextTargetId();
    if (!nextId) {
      return;
    }

    selectedRateeId = nextId;
    renderAll();
  });

  async function init() {
    try {
      seasons = await fetchSeasons();

      if (!previewMode && !hasExplicitSeasonQuery && !hasExplicitMatchdayQuery) {
        const activeRef = await detectActiveMatchdayRef();
        if (activeRef) {
          activeSeasonId = activeRef.seasonId;
          selectedMatchdayId = activeRef.matchdayId;
        }
      }

      const selectedSeason = pickSeason(seasons, activeSeasonId);
      if (!selectedSeason) {
        setStatus("No seasons have been created yet.", "warning");
        reportCard.innerHTML = '<div class="empty-state">Launch a campaign before opening player ratings.</div>';
        playerSelect.innerHTML = '<option value="">Launch a campaign first</option>';
        playerSelect.disabled = true;
        return;
      }

      activeSeasonId = selectedSeason.id;
      renderSeasonOptions();
      updateUrl();
      await loadSeason();
    } catch (error) {
      const message = readableSubmissionError(error);
      setStatus(message, "error");
      reportCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
  }

  init();
});
