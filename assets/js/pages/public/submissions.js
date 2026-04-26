document.addEventListener("DOMContentLoaded", () => {
  if (!window.MandarinasPublic) {
    const statusLine = document.getElementById("submission-status-line");
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
    matchdayState,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const RATING_QUESTIONS = [
    {
      key: "overall",
      label: "Overall rating",
      hint: "How did they do overall for your team that day? Half stars are allowed.",
    },
  ];

  const params = new URLSearchParams(window.location.search);
  const previewRequested = params.get("preview") === "1";
  const previewMode = previewRequested && Boolean(window.MandarinasShell?.hasAdminAccess?.());
  const requestedSeasonId = querySeasonIdFromUrl();
  const requestedMatchdayId = Number(params.get("matchday_id"));
  const requestedPlayerId = Number(params.get("player_id"));
  const hasExplicitSeasonQuery = Number.isInteger(requestedSeasonId) && requestedSeasonId > 0;
  const hasExplicitMatchdayQuery = Number.isInteger(requestedMatchdayId) && requestedMatchdayId > 0;

  const heroCopy = document.getElementById("submission-hero-copy");
  const reportTitle = document.getElementById("submission-report-title");
  const scheduleLink = document.getElementById("submission-schedule-link");
  const statusLine = document.getElementById("submission-status-line");
  const windowNote = document.getElementById("submission-window-note");
  const seasonField = document.getElementById("submission-season-field");
  const seasonSelect = document.getElementById("submission-season-select");
  const matchdayField = document.getElementById("submission-matchday-field");
  const matchdaySelect = document.getElementById("submission-matchday-select");
  const reportCard = document.getElementById("submission-report-card");
  const playerCopy = document.getElementById("submission-player-copy");
  const playerSelect = document.getElementById("submission-player-select");
  const selectedPlayerCard = document.getElementById("submission-selected-player-card");
  const statsCopy = document.getElementById("submission-stats-copy");
  const matchScoresCard = document.getElementById("submission-match-scores-card");
  const statsForm = document.getElementById("submission-stats-form");
  const goalsInput = document.getElementById("submission-goals");
  const goalKeepsInput = document.getElementById("submission-goal-keeps");
  const cleanSheetInput = document.getElementById("submission-clean-sheet");
  const statNoteInput = document.getElementById("submission-stat-note");
  const saveStatsButton = document.getElementById("submission-save-stats-button");
  const statsNote = document.getElementById("submission-stats-note");
  const ratingsCopy = document.getElementById("submission-ratings-copy");
  const ratingTeammateCount = document.getElementById("submission-rating-teammate-count");
  const ratingSavedCount = document.getElementById("submission-rating-saved-count");
  const ratingProgressPill = document.getElementById("submission-rating-progress-pill");
  const ratingProgressCopy = document.getElementById("submission-rating-progress-copy");
  const ratingTargets = document.getElementById("submission-rating-targets");
  const ratingForm = document.getElementById("submission-rating-form");
  const ratingsEmpty = document.getElementById("submission-ratings-empty");
  const ratingRelationship = document.getElementById("submission-rating-relationship");
  const ratingName = document.getElementById("submission-rating-name");
  const ratingProgressLine = document.getElementById("submission-rating-progress-line");
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
  let statTablesReady = true;
  let ratingTablesReady = true;
  let previewFallbackApplied = false;

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function roundToHalf(value) {
    return Math.round(Number(value || 0) * 2) / 2;
  }

  function sameRatingScore(left, right) {
    return Math.abs(Number(left || 0) - Number(right || 0)) < 0.01;
  }

  function isValidRatingScore(value) {
    const numeric = Number(value || 0);
    return numeric >= 0.5 && numeric <= 5 && sameRatingScore(numeric * 2, Math.round(numeric * 2));
  }

  function formatRatingScore(value) {
    const numeric = Number(value || 0);
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
  }

  function ratingFillPercent(value) {
    const numeric = Math.max(0, Math.min(5, Number(value || 0)));
    return `${(numeric / 5) * 100}%`;
  }

  function isTeammateRelationship(value) {
    return normalizeText(value).toLowerCase() === "teammate";
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

  function toDate(value) {
    return value ? new Date(value) : null;
  }

  function addDuration(baseDate, hours) {
    if (!baseDate) {
      return null;
    }

    return new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
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

  function hasMissingStatTable(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("matchday_stat_submissions") &&
      (
        message.includes("relation") ||
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find")
      )
    );
  }

  function hasMissingRatingTable(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("matchday_player_ratings") &&
      (
        message.includes("relation") ||
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find")
      )
    );
  }

  function readableSubmissionError(error) {
    if (hasMissingStatTable(error) || hasMissingRatingTable(error)) {
      return "Player reports are still in view mode while live saving is being switched on.";
    }

    if (hasMissingWindowColumns(error)) {
      return "Player report windows are not scheduled for this matchday yet.";
    }

    return baseReadableError(error);
  }

  async function fetchMatchdayWindows(seasonId) {
    const { data, error } = await supabaseClient
      .from("matchdays")
      .select("id, player_stats_open_at, player_stats_close_at, player_ratings_close_at, admin_review_locked_at")
      .eq("season_id", seasonId);

    if (error && hasMissingWindowColumns(error)) {
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

  async function detectActiveMatchdayRef() {
    let data = null;
    let error = null;

    ({ data, error } = await supabaseClient
      .from("matchdays")
      .select("id, season_id, matchday_number, kickoff_at, player_stats_open_at, player_stats_close_at, player_ratings_close_at")
      .order("kickoff_at", { ascending: false })
      .limit(200));

    if (error && hasMissingWindowColumns(error)) {
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

  async function detectPreviewMatchdayRef() {
    for (let index = seasons.length - 1; index >= 0; index -= 1) {
      const season = seasons[index];
      const bundle = await fetchSeasonBundle(season.id);
      const completed = buildCompletedMatchdays(bundle.matchdays || [], bundle.matches || []);

      if (completed.length) {
        return {
          seasonId: season.id,
          matchdayId: completed[completed.length - 1].id,
        };
      }
    }

    return null;
  }

  function selectedMatchday() {
    return (activeBundle?.matchdays || []).find((row) => Number(row.id) === Number(selectedMatchdayId)) || null;
  }

  function playerMap() {
    return new Map((activeBundle?.players || []).map((player) => [player.id, player]));
  }

  function assignmentRowsForMatchday() {
    return (activeBundle?.assignments || []).filter(
      (assignment) => Number(assignment.matchday_id) === Number(selectedMatchdayId)
    );
  }

  function matchRowsForMatchday() {
    return (activeBundle?.matches || []).filter(
      (match) => Number(match.matchday_id) === Number(selectedMatchdayId)
    );
  }

  function canonicalAttendanceRowsForMatchday() {
    return (activeBundle?.playerStats || [])
      .filter((row) => Number(row.matchday_id) === Number(selectedMatchdayId))
      .filter((row) => {
        const status = normalizeText(row.attendance_status || "").toLowerCase();
        return row.attended || status === "in" || status === "attended";
      });
  }

  async function loadSubmissionsForMatchday() {
    statSubmissions = [];
    ratingSubmissions = [];
    ratingDrafts = new Map();
    statTablesReady = true;
    ratingTablesReady = true;

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

    if (statError && hasMissingStatTable(statError)) {
      statTablesReady = false;
    } else if (statError) {
      throw statError;
    }

    if (ratingError && hasMissingRatingTable(ratingError)) {
      ratingTablesReady = false;
    } else if (ratingError) {
      throw ratingError;
    }

    statSubmissions = statRows || [];
    ratingSubmissions = ratingRows || [];
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

  function canonicalStatForPlayer(playerId) {
    return (
      (activeBundle?.playerStats || []).find(
        (row) =>
          Number(row.matchday_id) === Number(selectedMatchdayId) &&
          Number(row.player_id) === Number(playerId)
      ) || null
    );
  }

  function ratingRowsForPlayer(playerId) {
    return ratingSubmissions.filter(
      (row) =>
        Number(row.rater_player_id) === Number(playerId) &&
        isTeammateRelationship(row.relationship)
    );
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

  function eligiblePlayers() {
    const matchday = selectedMatchday();
    const playersById = playerMap();
    const assignments = assignmentRowsForMatchday().filter((assignment) => normalizeText(assignment.team_code));
    const rows = [];
    const seenIds = new Set();
    const kickoffPassed = Boolean(matchday?.kickoff_at && new Date(matchday.kickoff_at).getTime() <= Date.now());
    const playerSelectionOpen = previewMode || kickoffPassed;

    if (!playerSelectionOpen) {
      return [];
    }

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
      canonicalAttendanceRowsForMatchday().forEach((row) => {
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

    return rows
      .map((player) => ({
        ...player,
        stat_saved: Boolean(statSubmissionForPlayer(player.id)),
        ratings_saved: ratingRowsForPlayer(player.id).length,
      }))
      .sort((left, right) => playerDisplayName(left).localeCompare(playerDisplayName(right)));
  }

  function filteredPlayersForSelect() {
    return eligiblePlayers();
  }

  function selectedPlayer() {
    return eligiblePlayers().find((player) => Number(player.id) === Number(selectedPlayerId)) || null;
  }

  function matchesForPlayer(player) {
    if (!player?.team_code) {
      return [];
    }

    return matchRowsForMatchday().filter(
      (match) =>
        normalizeText(match.home_team_code) === normalizeText(player.team_code) ||
        normalizeText(match.away_team_code) === normalizeText(player.team_code)
    );
  }

  function ratingTargetsForPlayer(player) {
    if (!player) {
      return [];
    }

    const playersById = playerMap();

    return assignmentRowsForMatchday()
      .filter(
        (assignment) =>
          normalizeText(assignment.team_code) &&
          Number(assignment.player_id) !== Number(player.id) &&
          normalizeText(assignment.team_code) === normalizeText(player.team_code)
      )
      .map((assignment) => {
        const ratee = playersById.get(assignment.player_id);
        if (!ratee) {
          return null;
        }

        return {
          ...ratee,
          relationship: "teammate",
          team_code: assignment.team_code,
        };
      })
      .filter(Boolean)
      .sort((left, right) => playerDisplayName(left).localeCompare(playerDisplayName(right)));
  }

  function ratingDraftFor(rateeId) {
    if (!rateeId) {
      return null;
    }

    if (ratingDrafts.has(rateeId)) {
      return ratingDrafts.get(rateeId);
    }

    const saved = savedRatingForTarget(rateeId);
    const overallScore = extractOverallScore(saved?.scores);
    const nextDraft = {
      scores: overallScore !== null ? { overall: roundToHalf(overallScore) } : {},
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

  function normalizeScorePayload(value) {
    if (!value) {
      return {};
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    return typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function extractOverallScore(value) {
    const scores = normalizeScorePayload(value);
    const explicitOverall = Number(scores.overall || 0);
    if (isValidRatingScore(explicitOverall)) {
      return explicitOverall;
    }

    const legacyValues = Object.values(scores)
      .map((entry) => Number(entry || 0))
      .filter((entry) => Number.isFinite(entry) && entry >= 1 && entry <= 5);

    if (!legacyValues.length) {
      return null;
    }

    return legacyValues.reduce((sum, entry) => sum + entry, 0) / legacyValues.length;
  }

  function countLabel(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function receivedRatingsForPlayer(playerId) {
    return ratingSubmissions.filter(
      (row) =>
        Number(row.matchday_id) === Number(selectedMatchdayId) &&
        Number(row.ratee_player_id) === Number(playerId) &&
        Number(row.rater_player_id) !== Number(playerId) &&
        isTeammateRelationship(row.relationship)
    );
  }

  function formSummaryForPlayer(playerId) {
    if (!playerId) {
      return {
        title: "Choose your name first",
        copy: "Your matchday form appears here after you open your own report.",
        feedbackLabel: "0 feedback cards",
        teammateLabel: countLabel(0, "teammate"),
        averageLabel: "",
        note: "Raw peer ratings stay off the public squad page.",
      };
    }

    if (!ratingTablesReady) {
      return {
        title: "Form summary stays in view mode",
        copy: "Matchday feedback will appear here once live rating saving is switched on.",
        feedbackLabel: "View mode",
        teammateLabel: "Waiting",
        averageLabel: "",
        note: "Raw peer ratings stay off the public squad page.",
      };
    }

    const rows = receivedRatingsForPlayer(playerId);
    const teammateCount = rows.length;

    if (!rows.length) {
      return {
        title: "Feedback still coming in",
        copy: "Other players can finish their reports first. Your matchday form summary appears here as their ratings land.",
        feedbackLabel: "0 feedback cards",
        teammateLabel: countLabel(teammateCount, "teammate"),
        averageLabel: "",
        note: "Raw peer ratings stay off the public squad page.",
      };
    }

    const overallValues = rows
      .map((row) => extractOverallScore(row.scores))
      .filter((value) => Number.isFinite(value));
    const overallAverage = overallValues.length
      ? overallValues.reduce((sum, value) => sum + Number(value || 0), 0) / overallValues.length
      : null;
    const averageLabel = overallAverage !== null ? `${overallAverage.toFixed(1)} / 5 overall` : "";

    if (rows.length === 1) {
      return {
        title: "First feedback is in",
        copy: "This is an early read. It settles once more teammates finish their reports.",
        feedbackLabel: "1 feedback card",
        teammateLabel: countLabel(teammateCount, "teammate"),
        averageLabel,
        note: "Raw peer ratings stay off the public squad page.",
      };
    }

    let title = "Building night";
    let copy = "Feedback is still mixed, so use this as a check-in rather than a verdict.";

    if (overallAverage !== null && overallAverage >= 4.35) {
      title = "Matchday highlight";
      copy = "Feedback points to a big all-around night with strong impact for the team.";
    } else if (overallAverage !== null && overallAverage >= 3.7) {
      title = "Positive night";
      copy = "Feedback is pointing in a good direction with a solid overall contribution.";
    } else if (overallAverage !== null && overallAverage >= 3.1) {
      title = "Steady night";
      copy = "Feedback says you gave the team a steady contribution across the night.";
    }

    return {
      title,
      copy,
      feedbackLabel: `${rows.length} feedback cards`,
      teammateLabel: countLabel(teammateCount, "teammate"),
      averageLabel,
      note: "Raw peer ratings stay off the public squad page.",
    };
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
    const rows = (activeBundle?.matchdays || [])
      .slice()
      .sort((left, right) => left.matchday_number - right.matchday_number);

    if (!rows.length) {
      matchdaySelect.innerHTML = '<option value="">No matchdays available</option>';
      matchdaySelect.disabled = true;
      return;
    }

    matchdaySelect.disabled = !previewMode;
    matchdaySelect.innerHTML = rows
      .map((matchday) => {
        const state = matchdayState(matchday, activeBundle?.matches || []);
        const submissionState = matchdayWindowState(matchday);
        const suffix = previewMode
          ? state.label
          : submissionState.statsOpen
            ? "Reports open"
            : submissionState.ratingsOpen
              ? "Ratings open"
              : "Closed";

        return `
          <option value="${matchday.id}" ${Number(matchday.id) === Number(selectedMatchdayId) ? "selected" : ""}>
            Matchday ${matchday.matchday_number} · ${escapeHtml(suffix)}
          </option>
        `;
      })
      .join("");
  }

  function renderPlayerOptions() {
    const rows = filteredPlayersForSelect();
    const matchday = selectedMatchday();
    const kickoffPending = Boolean(
      matchday?.kickoff_at && new Date(matchday.kickoff_at).getTime() > Date.now() && !previewMode
    );
    const attendanceRows = canonicalAttendanceRowsForMatchday();

    if (!selectedMatchdayId) {
      playerSelect.innerHTML = '<option value="">Waiting for the current report</option>';
      playerSelect.disabled = true;
      return;
    }

    if (!rows.length) {
      const emptyLabel = kickoffPending
        ? "Player selection opens after kickoff"
        : attendanceRows.length
          ? "No player options were saved for this matchday yet"
          : "No players were marked in for this matchday yet";
      playerSelect.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
      playerSelect.disabled = true;
      return;
    }

    playerSelect.disabled = false;
    playerSelect.innerHTML = `
      <option value="">Choose your name</option>
      ${rows
        .map((player) => {
          const teamLabel = player.team_code ? formatTeamLabel(player.team_code) : "Played";
          return `
            <option value="${player.id}" ${Number(player.id) === Number(selectedPlayerId) ? "selected" : ""}>
              ${escapeHtml(playerDisplayName(player))} · ${escapeHtml(teamLabel)}
            </option>
          `;
        })
        .join("")}
    `;
  }

  function renderReportCard() {
    const matchday = selectedMatchday();

    if (!matchday) {
      reportCard.innerHTML = '<div class="empty-state">Open a matchday from Fixtures to start a player report.</div>';
      return;
    }

    const state = matchdayWindowState(matchday);
    const badges = [];

    if (matchday.kickoff_at) {
      badges.push(`<span class="tag-pill">${escapeHtml(formatDateTime(matchday.kickoff_at))}</span>`);
    } else {
      badges.push('<span class="tag-pill">Kickoff not scheduled</span>');
    }

    if (state.statsOpen) {
      badges.push('<span class="tag-pill plan-selected">Stats + ratings open</span>');
    } else if (state.ratingsOpen) {
      badges.push('<span class="tag-pill">Ratings open</span>');
    } else {
      badges.push('<span class="tag-pill">Closed</span>');
    }

    reportCard.innerHTML = `
      <div class="section-label">Current report</div>
      <h3>Matchday ${escapeHtml(matchday.matchday_number)}</h3>
      <div class="compact-badges">${badges.join("")}</div>
    `;
  }

  function renderSelectedPlayerCard() {
    const player = selectedPlayer();
    const matchday = selectedMatchday();

    if (!player || !matchday) {
      selectedPlayerCard.innerHTML = '<div class="empty-state">Choose your name first.</div>';
      return;
    }

    const statSubmission = statSubmissionForPlayer(player.id);
    const targets = ratingTargetsForPlayer(player);
    const formSummary = formSummaryForPlayer(player.id);
    const teamBadge = player.team_code
      ? `<span class="team-badge ${escapeHtml(teamClassName(player.team_code))}">${escapeHtml(formatTeamLabel(player.team_code))}</span>`
      : '<span class="tag-pill">Team pending</span>';

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
        <span class="tag-pill">${statSubmission ? "Stats saved" : "No stats submitted"}</span>
        <span class="tag-pill">${escapeHtml(targets.length)} ratings waiting</span>
        <span class="tag-pill">${escapeHtml(formSummary.feedbackLabel)}</span>
      </div>
      <div class="submission-form-panel">
        <div class="section-label">My form</div>
        <h4>${escapeHtml(formSummary.title)}</h4>
        <p class="section-copy">${escapeHtml(formSummary.copy)}</p>
        <div class="compact-badges">
          <span class="tag-pill">${escapeHtml(formSummary.feedbackLabel)}</span>
          <span class="tag-pill">${escapeHtml(formSummary.teammateLabel)}</span>
        </div>
        <p class="micro-note">
          ${
            formSummary.averageLabel
              ? `Average overall rating so far: <strong>${escapeHtml(formSummary.averageLabel)}</strong>. `
              : ""
          }
          ${escapeHtml(formSummary.note)}
        </p>
      </div>
    `;
  }

  function renderMatchScoresCard() {
    const player = selectedPlayer();
    const teamMatches = matchesForPlayer(player);

    if (!player) {
      matchScoresCard.innerHTML = '<div class="empty-state">Choose your name first.</div>';
      return;
    }

    if (!teamMatches.length) {
      matchScoresCard.innerHTML = `
        <div class="section-label">Scores</div>
        <h3>${escapeHtml(player.team_code ? formatTeamLabel(player.team_code) : "Your team")}</h3>
        <div class="empty-state">No scored matches are saved for this player yet.</div>
      `;
      return;
    }

    matchScoresCard.innerHTML = `
      <div class="section-label">Scores</div>
      <h3>${escapeHtml(player.team_code ? `${formatTeamLabel(player.team_code)} matches` : "Matches played")}</h3>
      <div class="history-stack">
        ${teamMatches
          .map((match) => {
            const homeTeam = formatTeamLabel(match.home_team_code);
            const awayTeam = formatTeamLabel(match.away_team_code);
            const homeScore = Number.isFinite(Number(match.home_score)) ? Number(match.home_score) : "-";
            const awayScore = Number.isFinite(Number(match.away_score)) ? Number(match.away_score) : "-";
            const roundLabel = match.round_number ? `Round ${match.round_number}` : "Match";

            return `
              <div class="match-row">
                <div class="match-row-head">
                  <strong>${escapeHtml(roundLabel)}</strong>
                  <span class="tag-pill">Court ${escapeHtml(match.court_label || match.court_number || match.match_order || "-")}</span>
                </div>
                <div class="scoreline">
                  <span class="team-badge ${escapeHtml(teamClassName(match.home_team_code))}">${escapeHtml(homeTeam)}</span>
                  <span class="score">${escapeHtml(homeScore)}</span>
                  <span class="muted">-</span>
                  <span class="score">${escapeHtml(awayScore)}</span>
                  <span class="team-badge ${escapeHtml(teamClassName(match.away_team_code))}">${escapeHtml(awayTeam)}</span>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderStatsForm() {
    const player = selectedPlayer();
    const matchday = selectedMatchday();

    if (!player || !matchday) {
      statsForm.hidden = true;
      return;
    }

    const statSubmission = statSubmissionForPlayer(player.id);
    const canonicalStat = canonicalStatForPlayer(player.id);
    const source = statSubmission || canonicalStat || {};
    const submissionState = matchdayWindowState(matchday);
    const saveEnabled = statTablesReady && submissionState.statsOpen;

    goalsInput.value = String(Number(source.goals || 0));
    goalKeepsInput.value = String(Number(source.goal_keeps || 0));
    cleanSheetInput.checked = Boolean(source.clean_sheet);
    statNoteInput.value = statSubmission?.note || "";
    statsForm.hidden = false;
    saveStatsButton.disabled = !saveEnabled;

    statsCopy.textContent = player.team_code
      ? `You played on ${formatTeamLabel(player.team_code)}. Save your own stat line here if you need to report stats. Ratings stay separate below.`
      : "Enter your own goals, goalkeeper points, and clean sheet here if you need to report stats. Ratings stay separate below.";

    if (!statTablesReady) {
      statsNote.textContent = "Live stat saving is not switched on yet.";
      return;
    }

    if (previewMode) {
      statsNote.textContent = statSubmission
        ? "Stats saved. Staff can keep testing ratings separately below."
        : "Open access is on right now so staff can test stat saving at any time.";
      return;
    }

    if (statSubmission) {
      statsNote.textContent = ratingTablesReady
        ? `Stats saved. Ratings stay separate and remain open until ${formatLongDate(submissionState.ratingsCloseAt)}.`
        : "Stats saved. Ratings remain in view mode until live saving is switched on.";
      return;
    }

    statsNote.textContent = submissionState.statsOpen
      ? `Stat entry is open right now and closes ${formatLongDate(submissionState.statsCloseAt)}.`
      : "Stat entry is not open for this matchday right now.";
  }

  function renderRatingQuestions() {
    const targets = ratingTargetsForPlayer(selectedPlayer());
    const target = targets.find((entry) => Number(entry.id) === Number(selectedRateeId));
    const draft = ratingDraftFor(selectedRateeId);

    if (!target || !draft) {
      ratingQuestionList.innerHTML = "";
      return;
    }

    ratingQuestionList.innerHTML = RATING_QUESTIONS.map((question) => {
      const selectedValue = Number(draft.scores?.[question.key] || 0);
      const selectedCopy = isValidRatingScore(selectedValue)
        ? `${formatRatingScore(selectedValue)} / 5 stars selected`
        : "Tap a star. Half stars work too.";

      return `
        <section class="submission-rating-question">
          <div class="submission-rating-question-copy">
            <strong>${escapeHtml(question.label)}</strong>
            <span>${escapeHtml(question.hint)}</span>
          </div>
          <div class="submission-rating-scale" role="group" aria-label="${escapeHtml(question.label)}">
            <div class="submission-star-interaction">
              <div class="submission-star-strip" aria-hidden="true">
                <span class="submission-star-track">★★★★★</span>
                <span class="submission-star-fill" style="width: ${ratingFillPercent(selectedValue)};">★★★★★</span>
              </div>
              <div class="submission-star-hit-targets">
              ${[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
                .map(
                  (value) => `
                    <button
                      class="submission-star-step ${sameRatingScore(selectedValue, value) ? "active" : ""}"
                      type="button"
                      data-rating-question="${escapeHtml(question.key)}"
                      data-rating-score="${escapeHtml(value)}"
                      aria-pressed="${sameRatingScore(selectedValue, value) ? "true" : "false"}"
                      aria-label="${escapeHtml(`${formatRatingScore(value)} stars`)}"
                      title="${escapeHtml(`${formatRatingScore(value)} stars`)}"
                    ></button>
                  `
                )
                .join("")}
              </div>
            </div>
            <div class="submission-star-caption">${escapeHtml(selectedCopy)}</div>
          </div>
        </section>
      `;
    }).join("");

    ratingCommentInput.value = draft.comment || "";
  }

  function renderRatings() {
    const player = selectedPlayer();
    const matchday = selectedMatchday();
    const targets = ratingTargetsForPlayer(player);
    const teammateCount = targets.length;
    const savedCount = ratingRowsForPlayer(player?.id).length;

    ensureRateeSelection();

    ratingTeammateCount.textContent = String(teammateCount);
    ratingSavedCount.textContent = String(savedCount);
    ratingProgressPill.textContent = player ? `${savedCount} / ${targets.length}` : "0 / 0";
    ratingProgressCopy.textContent = !player
      ? "Choose your name to open the queue."
      : targets.length
        ? `${savedCount} of ${targets.length} ratings saved.`
        : "No teammate queue is available yet.";

    if (!player || !matchday) {
      ratingTargets.innerHTML = '<div class="empty-state">Choose your name first.</div>';
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "Choose your name first.";
      return;
    }

    if (!targets.length) {
      ratingTargets.innerHTML = '<div class="empty-state">No teammates are saved for this matchday yet.</div>';
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "No teammates are saved for this matchday yet.";
      ratingsCopy.textContent = "Ratings open after teams and players exist on the saved matchday.";
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
            <span class="mini-sub">Teammate</span>
          </button>
        `;
      })
      .join("");

    const target = targets.find((entry) => Number(entry.id) === Number(selectedRateeId));
    const submissionState = matchdayWindowState(matchday);
    const saveEnabled = ratingTablesReady && submissionState.ratingsOpen && Boolean(target);

    if (!target) {
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "Choose one player from the queue to continue.";
      return;
    }

    ratingsEmpty.hidden = true;
    ratingForm.hidden = false;
    ratingRelationship.textContent = "Teammate";
    ratingName.textContent = playerDisplayName(target);
    ratingProgressLine.textContent = targets.length
      ? `${savedCount} of ${targets.length} ratings saved.`
      : "No queue yet.";
    ratingTeamPill.className = `team-badge ${escapeHtml(teamClassName(target.team_code))}`;
    ratingTeamPill.textContent = formatTeamLabel(target.team_code);
    ratingsCopy.textContent = "Give each teammate one overall star rating from 0.5 to 5.";
    saveRatingButton.disabled = !saveEnabled;
    nextRatingButton.disabled = !targets.length;
    ratingNote.textContent = !ratingTablesReady
      ? "Live rating saving is not switched on yet."
      : previewMode
        ? "Open access is on right now so staff can test the full report flow."
        : submissionState.ratingsOpen
          ? `Ratings stay open until ${formatLongDate(submissionState.ratingsCloseAt)}.`
          : "Ratings are not open for this matchday right now.";

    renderRatingQuestions();
  }

  function renderWindowState() {
    const matchday = selectedMatchday();

    if (!matchday) {
      reportTitle.textContent = previewMode ? "Staff Report Preview" : "Matchday Report";
      windowNote.textContent = previewMode
        ? "Choose a completed night to inspect the report flow."
        : "Open a matchday from Fixtures to enter a player report.";
      return;
    }

    const state = matchdayWindowState(matchday);
    reportTitle.textContent = previewMode ? "Staff Report Preview" : "Matchday Report";
    windowNote.textContent = (!statTablesReady || !ratingTablesReady)
      ? "Player reports are open in view mode while live saving is being switched on."
      : previewMode
        ? "Open access is on right now so staff can test the full player report flow."
        : state.statsOpen && state.ratingsOpen
          ? `Stats and ratings are open right now. Stats close ${formatLongDate(state.statsCloseAt)} and ratings close ${formatLongDate(state.ratingsCloseAt)}.`
        : state.ratingsOpen
          ? `Stat entry is closed. Ratings stay open until ${formatLongDate(state.ratingsCloseAt)}.`
          : "This matchday is closed.";
  }

  function updateHeaderCopy() {
    const matchday = selectedMatchday();

    heroCopy.textContent = previewMode
      ? "Choose a completed night, pick your name first, then test stats and ratings independently."
      : matchday
        ? "Choose your name first. Your team and scores load automatically, then save stats or rate players in whichever order you need."
        : "Open a matchday from Fixtures, then choose your name to submit stats or ratings.";

    playerCopy.textContent = previewMode
      ? "Open the report by choosing your name from the players who appeared on this saved matchday."
      : "Open the report by choosing your name from the players who were on the field for this matchday.";

    seasonField.hidden = !previewMode;
    matchdayField.hidden = !previewMode;
    seasonSelect.disabled = !previewMode;
  }

  function renderAll() {
    updateUrl();
    renderPlayerOptions();
    renderSelectedPlayerCard();
    renderMatchdayOptions();
    renderReportCard();
    renderMatchScoresCard();
    renderStatsForm();
    renderRatings();
    renderWindowState();
    updateHeaderCopy();

    const scheduleHref = activeSeasonId ? `./schedule.html?season_id=${activeSeasonId}` : "./schedule.html";
    scheduleLink.href = scheduleHref;
  }

  async function loadSeason() {
    setStatus("Loading player report...");

    try {
      const bundle = await fetchSeasonBundle(activeSeasonId);
      matchdayWindowMap = await fetchMatchdayWindows(activeSeasonId);
      activeBundle = mergeMatchdayWindows(bundle);

      if (!(activeBundle?.matchdays || []).some((row) => Number(row.id) === Number(selectedMatchdayId))) {
        const activeMatchday = newestLiveWindowMatchday(activeBundle?.matchdays || []);
        selectedMatchdayId = activeMatchday?.id || defaultMatchdayId(activeBundle);
      }

      await loadSubmissionsForMatchday();

      if (previewMode && !previewFallbackApplied && !eligiblePlayers().length) {
        previewFallbackApplied = true;
        const previewRef = await detectPreviewMatchdayRef();

        if (previewRef && (previewRef.seasonId !== activeSeasonId || previewRef.matchdayId !== selectedMatchdayId)) {
          activeSeasonId = previewRef.seasonId;
          selectedMatchdayId = previewRef.matchdayId;
          renderSeasonOptions();
          await loadSeason();
          return;
        }
      }

      if (!eligiblePlayers().some((player) => Number(player.id) === Number(selectedPlayerId))) {
        selectedPlayerId = null;
      }

      selectedRateeId = null;
      renderAll();
      setStatus(
        statTablesReady && ratingTablesReady
          ? "Player report loaded."
          : "Player report loaded in view mode.",
        statTablesReady && ratingTablesReady ? "success" : "warning"
      );
    } catch (error) {
      const message = readableSubmissionError(error);
      setStatus(message, "error");
      reportCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      selectedPlayerCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      matchScoresCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      playerSelect.innerHTML = `<option value="">${escapeHtml(message)}</option>`;
      playerSelect.disabled = true;
      ratingTargets.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = message;
      statsForm.hidden = true;
      ratingForm.hidden = true;
    }
  }

  function defaultMatchdayId(bundle) {
    const allMatchdays = bundle?.matchdays || [];

    if (allMatchdays.some((row) => Number(row.id) === Number(selectedMatchdayId))) {
      return selectedMatchdayId;
    }

    const activeWindowMatchday = newestLiveWindowMatchday(allMatchdays);
    if (activeWindowMatchday && !previewMode) {
      return activeWindowMatchday.id;
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

  async function saveStatSubmission(event) {
    event.preventDefault();

    const player = selectedPlayer();
    const matchday = selectedMatchday();
    if (!player || !matchday) {
      setStatus("Choose your name first.", "warning");
      return;
    }

    if (!statTablesReady) {
      setStatus("Live stat saving is not switched on yet.", "warning");
      return;
    }

    const submissionState = matchdayWindowState(matchday);
    if (!submissionState.statsOpen) {
      setStatus("The player report window is not open for this matchday right now.", "warning");
      return;
    }

    const goals = Number(goalsInput.value || "0");
    const goalKeeps = Number(goalKeepsInput.value || "0");

    if (!Number.isInteger(goals) || goals < 0 || !Number.isInteger(goalKeeps) || goalKeeps < 0) {
      setStatus("Goals and goalkeeper points must be whole numbers of 0 or greater.", "error");
      return;
    }

    try {
      saveStatsButton.disabled = true;
      saveStatsButton.textContent = "Saving...";

      const { error } = await supabaseClient
        .from("matchday_stat_submissions")
        .upsert(
          {
            matchday_id: matchday.id,
            submitted_by_player_id: player.id,
            player_id: player.id,
            attendance_status: "in",
            goals,
            goal_keeps: goalKeeps,
            clean_sheet: cleanSheetInput.checked,
            note: normalizeText(statNoteInput.value || "") || null,
          },
          { onConflict: "matchday_id,submitted_by_player_id,player_id" }
        );

      if (error) {
        throw error;
      }

      await loadSubmissionsForMatchday();
      renderAll();
      setStatus("Your player report stats have been saved.", "success");
    } catch (error) {
      setStatus(readableSubmissionError(error), "error");
    } finally {
      saveStatsButton.disabled = false;
      saveStatsButton.textContent = "Save my stats";
    }
  }

  async function saveRatingSubmission(event) {
    event.preventDefault();

    const player = selectedPlayer();
    const matchday = selectedMatchday();
    const target = ratingTargetsForPlayer(player).find((entry) => Number(entry.id) === Number(selectedRateeId));
    const draft = ratingDraftFor(selectedRateeId);

    if (!player || !matchday || !target || !draft) {
      setStatus("Choose your name and one player from the queue first.", "warning");
      return;
    }

    if (!ratingTablesReady) {
      setStatus("Live rating saving is not switched on yet.", "warning");
      return;
    }

    const submissionState = matchdayWindowState(matchday);
    if (!submissionState.ratingsOpen) {
      setStatus("Ratings are not open for this matchday right now.", "warning");
      return;
    }

    const missingQuestions = RATING_QUESTIONS.filter((question) => {
      const value = Number(draft.scores?.[question.key] || 0);
      return !isValidRatingScore(value);
    });

    if (missingQuestions.length) {
      setStatus(`Add an overall rating for ${playerDisplayName(target)} before saving.`, "warning");
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
  });

  playerSelect.addEventListener("change", () => {
    selectedPlayerId = Number(playerSelect.value) || null;
    selectedRateeId = null;
    renderAll();
  });

  statsForm.addEventListener("submit", saveStatSubmission);

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

      if (previewMode && !hasExplicitSeasonQuery && !hasExplicitMatchdayQuery) {
        const previewRef = await detectPreviewMatchdayRef();
        if (previewRef) {
          activeSeasonId = previewRef.seasonId;
          selectedMatchdayId = previewRef.matchdayId;
        }
      }

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
        reportCard.innerHTML = '<div class="empty-state">Launch a campaign before opening reports.</div>';
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
