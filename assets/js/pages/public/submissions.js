document.addEventListener("DOMContentLoaded", () => {
  if (!window.MandarinasPublic) {
    const statusLine = document.getElementById("submission-status-line");
    const suggestionStatusLine = document.getElementById("submission-suggestion-status-line");
    if (statusLine) {
      statusLine.textContent =
        "MandarinasPublic failed to load. Check browser console for connection or script errors.";
      statusLine.className = "status-line error";
    }
    if (suggestionStatusLine) {
      suggestionStatusLine.hidden = false;
      suggestionStatusLine.textContent =
        "MandarinasPublic failed to load. Check browser console for connection or script errors.";
      suggestionStatusLine.className = "status-line error";
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
      key: "club_rating",
      label: "Overall rating",
      hint: "Slide until the club rating feels right for the night they had.",
    },
  ];

  const params = new URLSearchParams(window.location.search);
  const previewRequested = params.get("preview") === "1";
  let previewMode = false;
  const requestedSeasonId = querySeasonIdFromUrl();
  const requestedMatchdayId = Number(params.get("matchday_id"));
  const requestedPlayerId = Number(params.get("player_id"));
  const requestedView = String(params.get("view") || "").trim().toLowerCase();
  const hasExplicitSeasonQuery = Number.isInteger(requestedSeasonId) && requestedSeasonId > 0;
  const hasExplicitMatchdayQuery = Number.isInteger(requestedMatchdayId) && requestedMatchdayId > 0;

  const heroCopy = document.getElementById("submission-hero-copy");
  const pageLabel = document.getElementById("submission-page-label");
  const pageTitle = document.getElementById("submission-page-title");
  const submissionWorkspace = document.getElementById("submission-workspace");
  const submissionWorkspaceFrame = document.getElementById("submission-workspace-frame");
  const submissionReportPane = document.getElementById("submission-report-pane");
  const submissionSuggestionsPane = document.getElementById("submission-suggestions-pane");
  const submissionViewTriggers = Array.from(document.querySelectorAll("[data-submission-view-trigger]"));
  const submissionNavLinks = Array.from(document.querySelectorAll("[data-submission-nav]"));
  const submissionProgressSteps = Array.from(document.querySelectorAll("[data-submission-step]"));
  const reportTitle = document.getElementById("submission-report-title");
  const scheduleLink = document.getElementById("submission-schedule-link");
  const statusLine = document.getElementById("submission-status-line");
  const suggestionStatusLine = document.getElementById("submission-suggestion-status-line");
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
  const ratingLiveGrade = document.getElementById("submission-rating-live-grade");
  const ratingLiveGradeCopy = document.getElementById("submission-rating-live-grade-copy");
  const ratingTargets = document.getElementById("submission-rating-targets");
  const ratingForm = document.getElementById("submission-rating-form");
  const ratingsEmpty = document.getElementById("submission-ratings-empty");
  const ratingName = document.getElementById("submission-rating-name");
  const ratingProgressLine = document.getElementById("submission-rating-progress-line");
  const ratingTeamPill = document.getElementById("submission-rating-team-pill");
  const ratingGradeNumber = document.getElementById("submission-rating-grade-number");
  const ratingGradeLabel = document.getElementById("submission-rating-grade-label");
  const ratingQuestionList = document.getElementById("submission-rating-question-list");
  const ratingCommentInput = document.getElementById("submission-rating-comment");
  const saveRatingButton = document.getElementById("submission-save-rating-button");
  const nextRatingButton = document.getElementById("submission-next-rating-button");
  const ratingNote = document.getElementById("submission-rating-note");
  const ratingsPanel = document.getElementById("submission-ratings-panel");
  const suggestionsCopy = document.getElementById("submission-suggestions-copy");
  const suggestionCount = document.getElementById("submission-suggestion-count");
  const replyCount = document.getElementById("submission-reply-count");
  const likeCount = document.getElementById("submission-like-count");
  const suggestionForm = document.getElementById("submission-suggestion-form");
  const suggestionTitleInput = document.getElementById("submission-suggestion-title");
  const suggestionBodyInput = document.getElementById("submission-suggestion-body");
  const saveSuggestionButton = document.getElementById("submission-save-suggestion-button");
  const suggestionNote = document.getElementById("submission-suggestion-note");
  const suggestionBoardCopy = document.getElementById("submission-suggestion-board-copy");
  const refreshSuggestionsButton = document.getElementById("submission-refresh-suggestions-button");
  const suggestionThreadList = document.getElementById("submission-suggestion-thread-list");
  const completionPanel = document.getElementById("submission-complete-panel");
  const completionCard = document.getElementById("submission-complete-card");
  const choosePlayerPanel = playerSelect?.closest(".panel") || null;
  const reportPanel = reportCard?.closest(".panel") || null;
  const statsPanel = statsForm?.closest(".panel") || null;

  let seasons = [];
  let activeSeasonId = requestedSeasonId;
  let activeSubmissionView =
    requestedView === "suggestions"
      ? "suggestions"
      : requestedView === "ratings"
        ? "ratings"
        : "stats";
  let selectedMatchdayId =
    Number.isInteger(requestedMatchdayId) && requestedMatchdayId > 0 ? requestedMatchdayId : null;
  let selectedPlayerId =
    Number.isInteger(requestedPlayerId) && requestedPlayerId > 0 ? requestedPlayerId : null;
  let selectedRateeId = null;
  let activeBundle = null;
  let statSubmissions = [];
  let ratingSubmissions = [];
  let suggestionThreads = [];
  let suggestionReplies = [];
  let suggestionLikes = [];
  let ratingDrafts = new Map();
  let replyDrafts = new Map();
  let matchdayWindowMap = new Map();
  let discussionMatchdayId = null;
  let activeReplySuggestionId = null;
  let savingSuggestion = false;
  let savingReplySuggestionId = null;
  let pendingLikeTargetKey = "";
  let statTablesReady = true;
  let ratingTablesReady = true;
  let discussionTablesReady = true;
  let previewFallbackApplied = false;
  let playerSelectionFallbackNote = "";

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function roundToHalf(value) {
    return Math.round(Number(value || 0) * 2) / 2;
  }

  function isValidLegacyRatingScore(value) {
    const numeric = Number(value || 0);
    return numeric >= 0.5 && numeric <= 5 && Math.abs(numeric * 2 - Math.round(numeric * 2)) < 0.01;
  }

  function isValidClubRating(value) {
    if (value === null || value === undefined || value === "") {
      return false;
    }

    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 99;
  }

  function formatClubRating(value) {
    if (!isValidClubRating(value)) {
      return "--";
    }

    return String(Math.round(Number(value)));
  }

  function formatAverageGrade(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric.toFixed(1) : "-";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function legacyScoreToGrade(value) {
    const numeric = clamp(Number(value || 0), 0.5, 5);
    const effectiveStars = Math.max(1, numeric);
    return clamp(Math.round(40 + ((effectiveStars - 1) / 4) * 59), 40, 99);
  }

  function clubRatingToLegacyScore(value) {
    const numeric = clamp(Number(value || 0), 0, 99);

    if (numeric < 40) {
      return 0.5;
    }

    const stars = 1 + ((numeric - 40) / 59) * 4;
    return roundToHalf(clamp(stars, 1, 5));
  }

  function matchGradeLabel(value) {
    const numeric =
      value === null || value === undefined || value === ""
        ? Number.NaN
        : Number(value);
    if (!Number.isFinite(numeric)) {
      return "Waiting on a rating";
    }
    if (numeric >= 92) {
      return "Match boss";
    }
    if (numeric >= 82) {
      return "Difference maker";
    }
    if (numeric >= 70) {
      return "Steady engine";
    }
    if (numeric >= 55) {
      return "Grinding shift";
    }
    return "Reset night";
  }

  function matchGradeCopy(value) {
    const numeric =
      value === null || value === undefined || value === ""
        ? Number.NaN
        : Number(value);
    if (!Number.isFinite(numeric)) {
      return "Slide to set the live game read.";
    }
    if (numeric >= 92) {
      return "Took over stretches and drove the game.";
    }
    if (numeric >= 82) {
      return "Made a real difference for the team.";
    }
    if (numeric >= 70) {
      return "Gave the team a solid, reliable game.";
    }
    if (numeric >= 55) {
      return "Had a mixed game with some helpful moments.";
    }
    return "Had a tough game and never quite found the rhythm.";
  }

  function ratingSliderPercent(value) {
    if (!isValidClubRating(value)) {
      return "50%";
    }

    const numeric = clamp(Number(value || 0), 0, 99);
    return `${(numeric / 99) * 100}%`;
  }

  function sliderDisplayValue(value) {
    return isValidClubRating(value) ? Number(value) : 50;
  }

  function ratingSummaryText(value, grade) {
    if (!isValidClubRating(value) || grade === null) {
      return "Slide to choose a rating";
    }

    return `${formatClubRating(value)} / 99 club rating`;
  }

  function ratingSummaryMeta(value, grade) {
    if (!isValidClubRating(value) || grade === null) {
      return "Single-point slider";
    }

    return matchGradeLabel(grade);
  }

  function isTeammateRelationship(value) {
    return normalizeText(value).toLowerCase() === "teammate";
  }

  function syncStatusNode(node, message, tone = "") {
    if (!node) {
      return;
    }

    node.hidden = !message;
    node.textContent = message;
    node.className = tone ? `status-line ${tone}` : "status-line";
  }

  function setStatus(message, tone = "") {
    syncStatusNode(statusLine, message, tone);
    syncStatusNode(suggestionStatusLine, message, tone);
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

    if (activeSubmissionView === "suggestions") {
      url.searchParams.set("view", "suggestions");
    } else if (activeSubmissionView === "ratings") {
      url.searchParams.set("view", "ratings");
    } else {
      url.searchParams.delete("view");
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

  function hasMissingSuggestionTable(error) {
    const message = String(error?.message || "").toLowerCase();
    if (
      !(
        message.includes("matchday_suggestions") ||
        message.includes("matchday_suggestion_replies") ||
        message.includes("matchday_suggestion_likes")
      )
    ) {
      return false;
    }

    return (
      message.includes("relation") ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find")
    );
  }

  function readableSubmissionError(error) {
    if (hasMissingStatTable(error) || hasMissingRatingTable(error)) {
      return "The night desk is still in view mode while live saving is being switched on.";
    }

    if (hasMissingSuggestionTable(error)) {
      return "Suggestions stay in view mode until the discussion migration is applied.";
    }

    if (hasMissingWindowColumns(error)) {
      return "Night-desk windows are not scheduled for this matchday yet.";
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

  function canonicalAttendanceRows(matchdayId) {
    return (activeBundle?.playerStats || [])
      .filter((row) => Number(row.matchday_id) === Number(matchdayId))
      .filter((row) => {
        const status = normalizeText(row.attendance_status || "").toLowerCase();
        return row.attended || status === "in" || status === "attended";
      });
  }

  function canonicalAttendanceRowsForMatchday() {
    return canonicalAttendanceRows(selectedMatchdayId);
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

  async function loadDiscussionForMatchday() {
    suggestionThreads = [];
    suggestionReplies = [];
    suggestionLikes = [];
    savingReplySuggestionId = null;
    pendingLikeTargetKey = "";
    discussionTablesReady = true;

    if (!selectedMatchdayId) {
      discussionMatchdayId = null;
      replyDrafts = new Map();
      activeReplySuggestionId = null;
      return;
    }

    if (Number(discussionMatchdayId) !== Number(selectedMatchdayId)) {
      replyDrafts = new Map();
      activeReplySuggestionId = null;
    }
    discussionMatchdayId = selectedMatchdayId;

    const [
      { data: threadRows, error: threadError },
      { data: replyRows, error: replyError },
      { data: likeRows, error: likeError },
    ] = await Promise.all([
      supabaseClient
        .from("matchday_suggestions")
        .select("*")
        .eq("matchday_id", selectedMatchdayId)
        .limit(5000),
      supabaseClient
        .from("matchday_suggestion_replies")
        .select("*")
        .limit(10000),
      supabaseClient
        .from("matchday_suggestion_likes")
        .select("*")
        .limit(20000),
    ]);

    const errors = [threadError, replyError, likeError].filter(Boolean);
    const fatalError = errors.find((error) => !hasMissingSuggestionTable(error));
    if (fatalError) {
      throw fatalError;
    }

    if (errors.length) {
      discussionTablesReady = false;
      return;
    }

    suggestionThreads = (threadRows || []).slice();
    const threadIdSet = new Set(suggestionThreads.map((row) => Number(row.id)));
    suggestionReplies = (replyRows || []).filter((row) => threadIdSet.has(Number(row.suggestion_id)));
    const replyIdSet = new Set(suggestionReplies.map((row) => Number(row.id)));
    suggestionLikes = (likeRows || []).filter((row) => {
      if (row.suggestion_id !== null && row.suggestion_id !== undefined) {
        return threadIdSet.has(Number(row.suggestion_id));
      }

      if (row.suggestion_reply_id !== null && row.suggestion_reply_id !== undefined) {
        return replyIdSet.has(Number(row.suggestion_reply_id));
      }

      return false;
    });
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

  function suggestionThreadRows() {
    return [...suggestionThreads].sort((left, right) => {
      const leftTime = new Date(left.created_at || left.updated_at || 0).getTime();
      const rightTime = new Date(right.created_at || right.updated_at || 0).getTime();
      return rightTime - leftTime;
    });
  }

  function suggestionReplyRows(suggestionId) {
    return suggestionReplies
      .filter((row) => Number(row.suggestion_id) === Number(suggestionId))
      .sort((left, right) => {
        const leftTime = new Date(left.created_at || left.updated_at || 0).getTime();
        const rightTime = new Date(right.created_at || right.updated_at || 0).getTime();
        return leftTime - rightTime;
      });
  }

  function suggestionLikeRows(target) {
    if (target.type === "reply") {
      return suggestionLikes.filter((row) => Number(row.suggestion_reply_id) === Number(target.id));
    }

    return suggestionLikes.filter((row) => Number(row.suggestion_id) === Number(target.id));
  }

  function suggestionLikeRowForPlayer(target, playerId) {
    if (!playerId) {
      return null;
    }

    return (
      suggestionLikeRows(target).find((row) => Number(row.liked_by_player_id) === Number(playerId)) || null
    );
  }

  function discussionAuthorLabel(playerId) {
    const player = playerMap().get(Number(playerId));
    return player ? playerDisplayName(player) : `Player ${playerId}`;
  }

  function playerSelectionIsOpen(matchday) {
    const kickoffPassed = Boolean(matchday?.kickoff_at && new Date(matchday.kickoff_at).getTime() <= Date.now());
    return previewMode || kickoffPassed;
  }

  function playersForMatchday(matchdayId) {
    const matchday = (activeBundle?.matchdays || []).find((row) => Number(row.id) === Number(matchdayId));
    const playersById = playerMap();
    const rows = [];
    const seenIds = new Set();

    if (!matchday || !playerSelectionIsOpen(matchday)) {
      return [];
    }

    const assignments = (activeBundle?.assignments || []).filter(
      (assignment) =>
        Number(assignment.matchday_id) === Number(matchdayId) && normalizeText(assignment.team_code)
    );

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
      canonicalAttendanceRows(matchdayId).forEach((row) => {
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

    return rows.sort((left, right) => playerDisplayName(left).localeCompare(playerDisplayName(right)));
  }

  function latestSelectableMatchdayId(bundle) {
    const allMatchdays = bundle?.matchdays || [];
    const withPlayers = allMatchdays.filter((matchday) => playersForMatchday(matchday.id).length);

    if (!withPlayers.length) {
      return null;
    }

    const liveMatchday = newestLiveWindowMatchday(withPlayers);
    if (liveMatchday) {
      return liveMatchday.id;
    }

    const completedIds = new Set(
      buildCompletedMatchdays(allMatchdays, bundle?.matches || []).map((matchday) => Number(matchday.id))
    );
    const completedWithPlayers = withPlayers
      .filter((matchday) => completedIds.has(Number(matchday.id)))
      .sort((left, right) => {
        const leftKickoff = new Date(left.kickoff_at || 0).getTime();
        const rightKickoff = new Date(right.kickoff_at || 0).getTime();
        return rightKickoff - leftKickoff;
      });

    if (completedWithPlayers.length) {
      return completedWithPlayers[0].id;
    }

    return withPlayers
      .slice()
      .sort((left, right) => {
        const leftKickoff = new Date(left.kickoff_at || 0).getTime();
        const rightKickoff = new Date(right.kickoff_at || 0).getTime();
        return rightKickoff - leftKickoff;
      })[0]?.id || null;
  }

  function eligiblePlayers() {
    return playersForMatchday(selectedMatchdayId);
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
    const overallGrade = extractOverallGrade(saved?.scores);
    const nextDraft = {
      scores:
        overallGrade !== null
          ? { club_rating: Math.round(overallGrade), overall: clubRatingToLegacyScore(overallGrade) }
          : {},
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

  function extractOverallGrade(value) {
    const scores = normalizeScorePayload(value);
    const explicitGrade = Number(scores.club_rating ?? scores.overall_grade ?? scores.grade);
    if (isValidClubRating(explicitGrade)) {
      return explicitGrade;
    }

    const explicitOverall = Number(scores.overall || 0);
    if (isValidLegacyRatingScore(explicitOverall)) {
      return legacyScoreToGrade(explicitOverall);
    }

    const legacyValues = Object.values(scores)
      .map((entry) => Number(entry || 0))
      .filter((entry) => Number.isFinite(entry) && entry >= 1 && entry <= 5);

    if (!legacyValues.length) {
      return null;
    }

    return legacyScoreToGrade(legacyValues.reduce((sum, entry) => sum + entry, 0) / legacyValues.length);
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

  function peerSnapshotForPlayer(playerId) {
    const rows = receivedRatingsForPlayer(playerId);
    const overallValues = rows
      .map((row) => extractOverallGrade(row.scores))
      .filter((value) => Number.isFinite(value));
    const averageGrade = overallValues.length
      ? overallValues.reduce((sum, value) => sum + Number(value || 0), 0) / overallValues.length
      : null;
    const matchGrade = averageGrade !== null ? Math.round(averageGrade) : null;

    return {
      rows,
      averageGrade,
      matchGrade,
    };
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
      .map((row) => extractOverallGrade(row.scores))
      .filter((value) => Number.isFinite(value));
    const overallAverage = overallValues.length
      ? overallValues.reduce((sum, value) => sum + Number(value || 0), 0) / overallValues.length
      : null;
    const averageLabel = overallAverage !== null ? `${formatAverageGrade(overallAverage)} / 99 overall` : "";

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

    if (overallAverage !== null && overallAverage >= 89) {
      title = "Matchday highlight";
      copy = "Feedback points to a big all-around night with strong impact for the team.";
    } else if (overallAverage !== null && overallAverage >= 80) {
      title = "Positive night";
      copy = "Feedback is pointing in a good direction with a solid overall contribution.";
    } else if (overallAverage !== null && overallAverage >= 71) {
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

  function loadedStatusState() {
    const reportReady = statTablesReady && ratingTablesReady;

    if (reportReady && discussionTablesReady) {
      return {
        message: "Night desk loaded.",
        tone: "success",
      };
    }

    if (!reportReady && !discussionTablesReady) {
      return {
        message: "Night desk loaded in view mode. The board stays in view mode too.",
        tone: "warning",
      };
    }

    if (!reportReady) {
      return {
        message: "Night desk loaded in view mode.",
        tone: "warning",
      };
    }

    return {
      message: "Night desk loaded. The board stays in view mode.",
      tone: "warning",
    };
  }

  function normalizeSubmissionView(view) {
    if (view === "suggestions") {
      return "suggestions";
    }
    if (view === "ratings") {
      return "ratings";
    }
    return "stats";
  }

  function setSubmissionView(view, options = {}) {
    const nextView = normalizeSubmissionView(view);
    const {
      focus = false,
      scroll = false,
      updateHistory = true,
    } = options;

    activeSubmissionView = nextView;

    if (submissionWorkspaceFrame) {
      submissionWorkspaceFrame.dataset.submissionViewMode = nextView;
    }

    if (submissionReportPane) {
      submissionReportPane.hidden = nextView === "suggestions";
    }

    if (submissionSuggestionsPane) {
      submissionSuggestionsPane.hidden = nextView !== "suggestions";
    }

    submissionViewTriggers.forEach((button) => {
      const isActive = button.dataset.submissionViewTrigger === nextView;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    submissionNavLinks.forEach((link) => {
      const isActive =
        (nextView === "suggestions" && link.dataset.submissionNav === "suggestions") ||
        (nextView !== "suggestions" && link.dataset.submissionNav === "report");
      link.classList.toggle("active", isActive);
    });

    updateHeaderCopy();
    syncSubmissionWizard();

    if (updateHistory) {
      updateUrl();
    }

    if (nextView === "ratings" && selectedPlayer() && ratingsPanel && !ratingsPanel.classList.contains("is-hidden")) {
      ratingsPanel.scrollIntoView({ behavior: scroll ? "smooth" : "auto", block: "start" });
    } else if (scroll && submissionWorkspace) {
      submissionWorkspace.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (focus) {
      if (nextView === "suggestions") {
        if (selectedPlayer() && selectedMatchday() && discussionTablesReady) {
          suggestionTitleInput.focus();
        } else {
          playerSelect.focus();
        }
      } else if (nextView === "ratings" && selectedPlayer() && selectedMatchday() && !ratingForm.hidden) {
        ratingCommentInput.focus();
      } else {
        playerSelect.focus();
      }
    }
  }

  function currentSubmissionStep() {
    const player = selectedPlayer();
    const matchday = selectedMatchday();
    if (!player || !matchday) {
      return 1;
    }

    if (activeSubmissionView === "suggestions") {
      return 5;
    }

    if (activeSubmissionView === "ratings") {
      return 4;
    }

    const statSaved = Boolean(statSubmissionForPlayer(player.id));
    const targets = ratingTargetsForPlayer(player);
    const savedRatings = ratingRowsForPlayer(player.id).length;
    const ratingsDone = targets.length ? savedRatings >= targets.length : true;
    const submissionState = matchdayWindowState(matchday);
    const statsEditable = statTablesReady && submissionState.statsOpen;
    const ratingsEditable = ratingTablesReady && submissionState.ratingsOpen && targets.length;

    if (!statsEditable && !ratingsEditable && !statSaved && !ratingsDone) {
      return 2;
    }

    return 3;
  }

  function renderCompletionCard() {
    const player = selectedPlayer();
    const matchday = selectedMatchday();

    if (!completionCard) {
      return;
    }

    if (!player || !matchday) {
      completionCard.innerHTML = '<div class="empty-state">Choose your name first to unlock the report flow.</div>';
      return;
    }

    const statSaved = Boolean(statSubmissionForPlayer(player.id));
    const targets = ratingTargetsForPlayer(player);
    const savedRatings = ratingRowsForPlayer(player.id).length;
    const ratingsDone = targets.length ? savedRatings >= targets.length : true;
    const submissionState = matchdayWindowState(matchday);
    const statsStillOpen = statTablesReady && submissionState.statsOpen;
    const readyToFinish = ratingsDone;
    const summaryMessage = readyToFinish
      ? statSaved
        ? "Your current report flow is complete for this matchday."
        : "Your ratings are in. Add stats later only if you need to."
      : "You still have ratings left before this report is complete.";
    const statBadgeLabel = statSaved
      ? "Stats saved"
      : statsStillOpen
        ? "Stats optional"
        : "Stats closed";

    completionCard.innerHTML = `
      <div class="submission-complete-ready">
        <div class="section-label">Current status</div>
        <h3>${escapeHtml(summaryMessage)}</h3>
        <div class="compact-badges">
          <span class="tag-pill">${escapeHtml(statBadgeLabel)}</span>
          <span class="tag-pill">${escapeHtml(`${savedRatings} / ${targets.length} ratings saved`)}</span>
          <span class="tag-pill">${escapeHtml(
            activeSubmissionView === "suggestions"
              ? "Suggestions open"
              : activeSubmissionView === "ratings"
                ? "Ratings mode"
                : "Stats mode"
          )}</span>
        </div>
        <p class="section-copy">
          ${escapeHtml(
            readyToFinish
              ? statSaved
                ? "If you still want to leave tactical notes or ideas, switch into Suggestions."
                : "Your ratings do not depend on stats. If you have no numbers to add, you are done."
              : "Use the progress steps above to finish the remaining rating tasks on this matchday."
          )}
        </p>
      </div>
    `;
  }

  function syncSubmissionWizard() {
    const currentStep = currentSubmissionStep();
    const playerReady = Boolean(selectedPlayer() && selectedMatchday());
    const mobileWizard = window.matchMedia("(max-width: 767px)").matches;
    const player = selectedPlayer();
    const targets = ratingTargetsForPlayer(player);
    const savedRatings = ratingRowsForPlayer(player?.id).length;
    const statSaved = Boolean(player && statSubmissionForPlayer(player.id));
    const ratingsDone = targets.length ? savedRatings >= targets.length : true;
    const submissionState = player && selectedMatchday() ? matchdayWindowState(selectedMatchday()) : null;
    const statsResolved =
      statSaved || ratingsDone || !statTablesReady || !submissionState?.statsOpen;
    const readyToFinish = ratingsDone;
    const viewingSuggestions = activeSubmissionView === "suggestions";
    const viewingRatings = activeSubmissionView === "ratings";
    const viewingStats = !viewingSuggestions && !viewingRatings;

    document.body.dataset.submissionStep = String(currentStep);

    submissionProgressSteps.forEach((stepNode) => {
      const stepNumber = Number(stepNode.dataset.submissionStep);
      const completed =
        (stepNumber === 1 && playerReady) ||
        (stepNumber === 2 && playerReady) ||
        (stepNumber === 3 && statsResolved) ||
        (stepNumber === 4 && ratingsDone) ||
        (stepNumber === 5 && viewingSuggestions) ||
        (stepNumber === 6 && readyToFinish);

      stepNode.classList.toggle("is-active", stepNumber === currentStep);
      stepNode.classList.toggle("is-complete", completed && stepNumber !== currentStep);
    });

    [
      { panel: choosePlayerPanel, show: true },
      { panel: reportPanel, show: playerReady && !viewingSuggestions },
      { panel: statsPanel, show: playerReady && viewingStats },
      { panel: ratingsPanel, show: playerReady && viewingRatings },
      {
        panel: completionPanel,
        show: playerReady && !viewingSuggestions && (!mobileWizard || readyToFinish),
      },
    ].forEach(({ panel, show }) => {
      if (!panel) {
        return;
      }

      panel.classList.add("submission-step-panel");
      panel.classList.toggle("is-hidden", !show);
    });
  }

  function renderSuggestionSummary() {
    const matchday = selectedMatchday();
    const threadTotal = suggestionThreads.length;
    const replyTotal = suggestionReplies.length;
    const likeTotal = suggestionLikes.length;

    refreshSuggestionsButton.disabled = !matchday;

    suggestionCount.textContent = String(threadTotal);
    replyCount.textContent = String(replyTotal);
    likeCount.textContent = String(likeTotal);

    if (!matchday) {
      suggestionsCopy.textContent = "Open a matchday first, then use the board to collect ideas and replies.";
      suggestionBoardCopy.textContent = "Suggestions attach to one matchday at a time.";
      return;
    }

    if (!discussionTablesReady) {
      suggestionsCopy.textContent = "Suggestions stay in view mode until the discussion migration is applied.";
      suggestionBoardCopy.textContent = `Matchday ${matchday.matchday_number} is ready for discussion once the board tables exist.`;
      return;
    }

    suggestionsCopy.textContent = previewMode
      ? "Preview access is on. Posts, replies, and likes here still update the saved live board for this matchday."
      : `Share one clear idea for Matchday ${matchday.matchday_number}, then reply or like the threads that matter most.`;

    suggestionBoardCopy.textContent = threadTotal
      ? `Matchday ${matchday.matchday_number} currently has ${countLabel(threadTotal, "suggestion")}, ${countLabel(replyTotal, "reply")}, and ${countLabel(likeTotal, "like")}.`
      : `Matchday ${matchday.matchday_number} does not have any suggestions yet.`;
  }

  function renderSuggestionComposer() {
    const matchday = selectedMatchday();
    const player = selectedPlayer();
    const canWrite = Boolean(matchday && player && discussionTablesReady && !savingSuggestion);

    suggestionTitleInput.disabled = !canWrite;
    suggestionBodyInput.disabled = !canWrite;
    saveSuggestionButton.disabled = !canWrite;
    saveSuggestionButton.textContent = savingSuggestion ? "Posting..." : "Post suggestion";

    if (!matchday) {
      suggestionNote.textContent = "Choose a matchday first.";
      return;
    }

    if (!discussionTablesReady) {
      suggestionNote.textContent = "Discussion saving is not switched on yet.";
      return;
    }

    if (!player) {
      suggestionNote.textContent = "Choose your name first to post, reply, or like suggestions.";
      return;
    }

    suggestionNote.textContent = previewMode
      ? `Posting as ${playerDisplayName(player)} in preview mode. This still updates the saved live board.`
      : `Posting as ${playerDisplayName(player)} on Matchday ${matchday.matchday_number}.`;
  }

  function renderSuggestionThreads() {
    const matchday = selectedMatchday();
    const player = selectedPlayer();
    const canInteract = Boolean(matchday && player && discussionTablesReady);
    const threads = suggestionThreadRows();

    if (!matchday) {
      suggestionThreadList.innerHTML = '<div class="empty-state">Choose a matchday first.</div>';
      return;
    }

    if (!discussionTablesReady) {
      suggestionThreadList.innerHTML =
        '<div class="empty-state">Suggestions stay in view mode until the discussion migration is applied.</div>';
      return;
    }

    if (!threads.length) {
      suggestionThreadList.innerHTML = `
        <div class="empty-state">
          No suggestions have been posted for Matchday ${escapeHtml(matchday.matchday_number)} yet.
        </div>
      `;
      return;
    }

    suggestionThreadList.innerHTML = threads
      .map((thread) => {
        const threadReplies = suggestionReplyRows(thread.id);
        const threadLikeList = suggestionLikeRows({ type: "thread", id: thread.id });
        const threadLikeMatch = suggestionLikeRowForPlayer({ type: "thread", id: thread.id }, selectedPlayerId);
        const threadLiked = Boolean(threadLikeMatch);
        const threadLikeBusy = pendingLikeTargetKey === `thread:${thread.id}`;
        const replyBusy = Number(savingReplySuggestionId) === Number(thread.id);
        const isReplying = Number(activeReplySuggestionId) === Number(thread.id);
        const replyDraft = replyDrafts.get(Number(thread.id)) || "";

        return `
          <article class="suggestion-thread-card">
            <div class="suggestion-thread-head">
              <div class="suggestion-thread-title-wrap">
                <div class="section-label">Suggestion</div>
                <h3>${escapeHtml(thread.title || "Untitled suggestion")}</h3>
                <p class="mini-sub">
                  ${escapeHtml(discussionAuthorLabel(thread.author_player_id))} ·
                  ${escapeHtml(formatDateTime(thread.created_at))}
                </p>
              </div>
              <div class="compact-badges">
                <span class="tag-pill">${escapeHtml(countLabel(threadReplies.length, "reply"))}</span>
                <span class="tag-pill">${escapeHtml(countLabel(threadLikeList.length, "like"))}</span>
              </div>
            </div>

            <p class="suggestion-thread-body">${escapeHtml(thread.body || "")}</p>

            <div class="suggestion-thread-actions">
              <button
                class="ghost-button suggestion-like-button ${threadLiked ? "active" : ""}"
                type="button"
                data-suggestion-like-id="${thread.id}"
                aria-pressed="${threadLiked ? "true" : "false"}"
                ${!canInteract || threadLikeBusy ? "disabled" : ""}
              >
                ${threadLikeBusy ? "Saving..." : threadLiked ? "Liked" : "Like"} · ${escapeHtml(threadLikeList.length)}
              </button>
              <button
                class="secondary-button"
                type="button"
                data-toggle-reply-id="${thread.id}"
                ${!canInteract || replyBusy ? "disabled" : ""}
              >
                ${isReplying ? "Close reply" : "Reply"}
              </button>
            </div>

            ${
              isReplying
                ? `
                  <div class="suggestion-reply-form">
                    <div class="field">
                      <label for="submission-reply-${thread.id}">Reply</label>
                      <textarea
                        id="submission-reply-${thread.id}"
                        rows="3"
                        maxlength="600"
                        placeholder="Add a reply to this suggestion."
                        data-reply-draft-id="${thread.id}"
                      >${escapeHtml(replyDraft)}</textarea>
                    </div>
                    <div class="actions">
                      <button
                        class="primary-button"
                        type="button"
                        data-save-reply-id="${thread.id}"
                        ${!canInteract || replyBusy ? "disabled" : ""}
                      >
                        ${replyBusy ? "Saving..." : "Send reply"}
                      </button>
                      <button
                        class="ghost-button"
                        type="button"
                        data-cancel-reply-id="${thread.id}"
                        ${replyBusy ? "disabled" : ""}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                `
                : ""
            }

            ${
              threadReplies.length
                ? `
                  <div class="suggestion-reply-list">
                    ${threadReplies
                      .map((reply) => {
                        const replyLikeList = suggestionLikeRows({ type: "reply", id: reply.id });
                        const replyLikeMatch = suggestionLikeRowForPlayer(
                          { type: "reply", id: reply.id },
                          selectedPlayerId
                        );
                        const replyLiked = Boolean(replyLikeMatch);
                        const replyLikeBusy = pendingLikeTargetKey === `reply:${reply.id}`;

                        return `
                          <article class="suggestion-reply-card">
                            <div class="suggestion-reply-head">
                              <div class="suggestion-reply-meta">
                                <strong>${escapeHtml(discussionAuthorLabel(reply.author_player_id))}</strong>
                                <span class="mini-sub">${escapeHtml(formatDateTime(reply.created_at))}</span>
                              </div>
                              <span class="tag-pill">${escapeHtml(countLabel(replyLikeList.length, "like"))}</span>
                            </div>

                            <p class="suggestion-reply-body">${escapeHtml(reply.body || "")}</p>

                            <div class="suggestion-reply-actions">
                              <button
                                class="ghost-button suggestion-like-button ${replyLiked ? "active" : ""}"
                                type="button"
                                data-reply-like-id="${reply.id}"
                                aria-pressed="${replyLiked ? "true" : "false"}"
                                ${!canInteract || replyLikeBusy ? "disabled" : ""}
                              >
                                ${replyLikeBusy ? "Saving..." : replyLiked ? "Liked" : "Like"} · ${escapeHtml(
                                  replyLikeList.length
                                )}
                              </button>
                            </div>
                          </article>
                        `;
                      })
                      .join("")}
                  </div>
                `
                : ""
            }
          </article>
        `;
      })
      .join("");
  }

  function renderSuggestions() {
    renderSuggestionSummary();
    renderSuggestionComposer();
    renderSuggestionThreads();
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
      reportCard.innerHTML = '<div class="empty-state">Open a matchday from Fixtures to start the night desk.</div>';
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

    const pulseTitle = state.statsOpen
      ? "Full night desk is live"
      : state.ratingsOpen
        ? "Stat line is closed, ratings still live"
        : "This matchday is wrapped";
    const pulseCopy = state.statsOpen
      ? `Open your card, lock your numbers now or skip straight to ratings. Ratings stay open until ${formatLongDate(state.ratingsCloseAt)}.`
      : state.ratingsOpen
        ? `The stat window is done, but ratings stay open until ${formatLongDate(state.ratingsCloseAt)} whether or not you saved stats.`
        : "The desk stays visible here, but no more live matchday reporting can be added right now.";

    reportCard.innerHTML = `
      <div class="submission-report-stage">
        <div class="submission-report-stage-copy">
          <div class="section-label">Current report</div>
          <h3>Matchday ${escapeHtml(matchday.matchday_number)}</h3>
          <p class="section-copy">${escapeHtml(pulseTitle)}</p>
        </div>
        <div class="submission-report-stage-badges">${badges.join("")}</div>
        <div class="submission-report-stage-foot">
          <span class="submission-stage-pill">${escapeHtml(state.statsOpen ? "Desk live" : state.ratingsOpen ? "Ratings live" : "Closed")}</span>
          <p class="micro-note">${escapeHtml(pulseCopy)}</p>
        </div>
      </div>
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
    const submissionState = matchdayWindowState(matchday);
    const targets = ratingTargetsForPlayer(player);
    const formSummary = formSummaryForPlayer(player.id);
    const peerSnapshot = peerSnapshotForPlayer(player.id);
    const teamBadge = player.team_code
      ? `<span class="team-badge ${escapeHtml(teamClassName(player.team_code))}">${escapeHtml(formatTeamLabel(player.team_code))}</span>`
      : '<span class="tag-pill">Team pending</span>';
    const peerGrade = peerSnapshot.matchGrade;
    const peerGradeNumber = peerGrade !== null ? String(peerGrade) : "--";
    const peerGradeLabel = peerGrade !== null ? matchGradeLabel(peerGrade) : "Waiting on teammate ratings";
    const peerGradeCopy = peerSnapshot.averageGrade !== null
      ? `${formatAverageGrade(peerSnapshot.averageGrade)} / 99 peer average so far`
      : "No teammate ratings have landed on this card yet.";
    const statTag = statSubmission
      ? "Stat line saved"
      : submissionState.statsOpen
        ? "Stat line open"
        : submissionState.ratingsOpen
          ? "Stat line closed"
          : "Matchday closed";
    const statState = statSubmission
      ? "Saved"
      : submissionState.statsOpen
        ? "Open"
        : "Closed";
    const statCopy = statSubmission
      ? "Your numbers are on the board."
      : submissionState.statsOpen
        ? "Goals, keeps, and clean sheet still editable."
        : submissionState.ratingsOpen
          ? "Stats are locked, but teammate ratings can still be submitted."
          : "This matchday no longer accepts live reports.";

    selectedPlayerCard.innerHTML = `
      <div class="submission-identity-card">
        <div class="submission-player-meta">
          <div class="submission-identity-main">
            <div class="section-label">Tonight's card</div>
            <h3>${escapeHtml(playerDisplayName(player))}</h3>
            <p class="section-copy">${escapeHtml(matchday.kickoff_at ? formatDateTime(matchday.kickoff_at) : `Matchday ${matchday.matchday_number}`)}</p>
            <div class="compact-badges">
              ${teamBadge}
              <span class="tag-pill">${escapeHtml(statTag)}</span>
            </div>
          </div>
          <div class="submission-grade-orbit">
            <span class="submission-grade-eyebrow">Current peer rating</span>
            <div class="submission-grade-score">
              <strong>${escapeHtml(peerGradeNumber)}</strong>
              <span>/ 99</span>
            </div>
            <p class="submission-grade-copy">${escapeHtml(peerGradeLabel)}</p>
            <p class="micro-note">${escapeHtml(peerGradeCopy)}</p>
          </div>
        </div>
        <div class="submission-identity-stat-grid">
          <article class="submission-stat-tile">
            <span>Stat line</span>
            <strong>${escapeHtml(statState)}</strong>
            <small>${escapeHtml(statCopy)}</small>
          </article>
          <article class="submission-stat-tile">
            <span>Rating queue</span>
            <strong>${escapeHtml(String(targets.length))}</strong>
            <small>${escapeHtml(targets.length ? "Teammates waiting for a rating." : "No teammate queue is ready yet.")}</small>
          </article>
          <article class="submission-stat-tile">
            <span>Feedback cards</span>
            <strong>${escapeHtml(formSummary.feedbackLabel)}</strong>
            <small>${escapeHtml(formSummary.copy)}</small>
          </article>
        </div>
      </div>
      <div class="submission-form-panel">
        <div class="section-label">Form pulse</div>
        <h4>${escapeHtml(formSummary.title)}</h4>
        <p class="section-copy">${escapeHtml(formSummary.copy)}</p>
        <div class="compact-badges">
          <span class="tag-pill">${escapeHtml(formSummary.feedbackLabel)}</span>
          <span class="tag-pill">${escapeHtml(formSummary.teammateLabel)}</span>
          ${
            peerGrade !== null
              ? `<span class="tag-pill">${escapeHtml(`${peerGrade} / 99 live`)}</span>`
              : ""
          }
        </div>
        <p class="micro-note">
          ${
            peerSnapshot.averageGrade !== null
              ? `Peer average so far: <strong>${escapeHtml(formatAverageGrade(peerSnapshot.averageGrade))} / 99</strong>. `
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
      ? `You played on ${formatTeamLabel(player.team_code)}. Save your own stat line here if you need to report stats, or switch to Ratings if you only want to rate teammates.`
      : "Enter your own goals, goalkeeper points, and clean sheet here if you need to report stats, or switch to Ratings if you only want to rate teammates.";

    if (!statTablesReady) {
      statsNote.textContent = "Live stat saving is not switched on yet.";
      return;
    }

    if (previewMode) {
      statsNote.textContent = statSubmission
        ? "Stats saved. Preview access stays open, and changes here still update the saved live record."
        : "Preview access is on. Saving here still updates the saved live stat record.";
      return;
    }

    if (statSubmission) {
      statsNote.textContent = ratingTablesReady
        ? `Stats saved. Ratings remain open in their own tab until ${formatLongDate(submissionState.ratingsCloseAt)}.`
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
      const selectedRawValue = draft.scores?.[question.key];
      const selectedValue =
        selectedRawValue === undefined || selectedRawValue === null || selectedRawValue === ""
          ? null
          : Number(selectedRawValue);
      const selectedGrade = isValidClubRating(selectedValue) ? selectedValue : null;
      const sliderValue = sliderDisplayValue(selectedValue);

      return `
        <section class="submission-rating-question">
          <div class="submission-rating-question-copy">
            <strong>${escapeHtml(question.label)}</strong>
            <span>${escapeHtml(question.hint)}</span>
          </div>
          <div class="submission-rating-slider-shell ${selectedGrade === null ? "is-pristine" : ""}" role="group" aria-label="${escapeHtml(question.label)}">
            <div class="submission-rating-slider-header">
              <strong data-rating-selection-copy>${escapeHtml(ratingSummaryText(selectedValue, selectedGrade))}</strong>
              <span data-rating-selection-grade>${escapeHtml(ratingSummaryMeta(selectedValue, selectedGrade))}</span>
            </div>
            <label class="submission-rating-slider-field">
              <span class="sr-only">${escapeHtml(question.label)}</span>
                <input
                  class="submission-rating-slider-input"
                  type="range"
                  min="0"
                  max="99"
                  step="1"
                  value="${escapeHtml(String(sliderValue))}"
                  data-rating-slider="${escapeHtml(question.key)}"
                  aria-label="${escapeHtml(question.label)}"
                style="--rating-progress: ${escapeHtml(ratingSliderPercent(selectedValue))};"
              />
            </label>
            <div class="submission-rating-slider-extremes" aria-hidden="true">
              <span>0</span>
              <span>99</span>
            </div>
          </div>
          ${
            question.key === "club_rating"
              ? `
                <div class="submission-rating-grade-card">
                  <span class="submission-grade-eyebrow">Game read</span>
                  <strong data-rating-readout-label>${escapeHtml(matchGradeLabel(selectedGrade))}</strong>
                  <span data-rating-readout-copy>${escapeHtml(matchGradeCopy(selectedGrade))}</span>
                </div>
              `
              : ""
          }
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
      ? "Choose your name to open the rating queue."
      : targets.length
        ? `${savedCount} of ${targets.length} teammate ratings saved.`
        : "No teammate queue is available yet.";
    ratingLiveGrade.textContent = "--";
    ratingLiveGradeCopy.textContent = "Slide to set the club rating.";
    ratingGradeNumber.textContent = "--";
    ratingGradeLabel.textContent = "Slide to preview the live game read.";

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
    const draft = ratingDraftFor(selectedRateeId);
    const selectedRawValue = draft?.scores?.club_rating;
    const selectedValue =
      selectedRawValue === undefined || selectedRawValue === null || selectedRawValue === ""
        ? null
        : Number(selectedRawValue);
    const liveGrade = isValidClubRating(selectedValue) ? selectedValue : null;

    if (!target) {
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "Choose one player from the queue to continue.";
      return;
    }

    ratingsEmpty.hidden = true;
    ratingForm.hidden = false;
    ratingName.textContent = playerDisplayName(target);
    ratingProgressLine.textContent = targets.length
      ? `${savedCount} of ${targets.length} ratings saved${liveGrade !== null ? ` · ${liveGrade} / 99 live` : ""}.`
      : "No queue yet.";
    ratingTeamPill.className = `team-badge ${escapeHtml(teamClassName(target.team_code))}`;
    ratingTeamPill.textContent = formatTeamLabel(target.team_code);
    ratingsCopy.textContent = "Hand out one overall rating per teammate. You can submit ratings even if you skipped stats, and they stay open for up to one week after kickoff.";
    saveRatingButton.disabled = !saveEnabled;
    nextRatingButton.disabled = !targets.length;
    ratingLiveGrade.textContent = liveGrade !== null ? String(liveGrade) : "--";
    ratingLiveGradeCopy.textContent = liveGrade !== null
      ? `${formatClubRating(selectedValue)} / 99 · ${matchGradeLabel(liveGrade)}`
      : "Slide to set the club rating.";
    ratingGradeNumber.textContent = liveGrade !== null ? String(liveGrade) : "--";
    ratingGradeLabel.textContent = liveGrade !== null ? matchGradeCopy(liveGrade) : "Slide to preview the live game read.";
    ratingNote.textContent = !ratingTablesReady
      ? "Live rating saving is not switched on yet."
      : previewMode
        ? "Preview access is on. Saving ratings here still updates the saved live matchday records."
        : submissionState.ratingsOpen
          ? `Ratings stay open until ${formatLongDate(submissionState.ratingsCloseAt)}, even if you never saved stats.`
          : "Ratings are not open for this matchday right now.";

    renderRatingQuestions();
  }

  function syncRatingScorePresentation(score) {
    const liveGrade = isValidClubRating(score) ? score : null;
    const questionNode = ratingQuestionList.querySelector(".submission-rating-question");
    const sliderInput = questionNode?.querySelector("[data-rating-slider]");
    const sliderShell = questionNode?.querySelector(".submission-rating-slider-shell");
    const selectionCopy = questionNode?.querySelector("[data-rating-selection-copy]");
    const selectionGrade = questionNode?.querySelector("[data-rating-selection-grade]");
    const readoutLabel = questionNode?.querySelector("[data-rating-readout-label]");
    const readoutCopy = questionNode?.querySelector("[data-rating-readout-copy]");
    const player = selectedPlayer();
    const targets = ratingTargetsForPlayer(player);
    const savedCount = ratingRowsForPlayer(player?.id).length;

    if (sliderInput) {
      sliderInput.value = String(sliderDisplayValue(score));
      sliderInput.style.setProperty("--rating-progress", ratingSliderPercent(score));
    }

    sliderShell?.classList.toggle("is-pristine", liveGrade === null);

    if (selectionCopy) {
      selectionCopy.textContent = ratingSummaryText(score, liveGrade);
    }
    if (selectionGrade) {
      selectionGrade.textContent = ratingSummaryMeta(score, liveGrade);
    }
    if (readoutLabel) {
      readoutLabel.textContent = matchGradeLabel(liveGrade);
    }
    if (readoutCopy) {
      readoutCopy.textContent = matchGradeCopy(liveGrade);
    }

    ratingLiveGrade.textContent = liveGrade !== null ? String(liveGrade) : "--";
    ratingLiveGradeCopy.textContent = liveGrade !== null
      ? `${formatClubRating(score)} / 99 · ${matchGradeLabel(liveGrade)}`
      : "Slide to set the club rating.";
    ratingGradeNumber.textContent = liveGrade !== null ? String(liveGrade) : "--";
    ratingGradeLabel.textContent = liveGrade !== null ? matchGradeCopy(liveGrade) : "Slide to preview the live game read.";
    ratingProgressLine.textContent = targets.length
      ? `${savedCount} of ${targets.length} ratings saved${liveGrade !== null ? ` · ${liveGrade} / 99 live` : ""}.`
      : "No queue yet.";
  }

  function renderWindowState() {
    const matchday = selectedMatchday();

    if (!matchday) {
      reportTitle.textContent = previewMode ? "Busses Night Desk Preview" : "Night Desk";
      windowNote.textContent = previewMode
        ? "Choose a completed night to inspect the report flow."
        : "Open a matchday from Fixtures to enter the night desk.";
      return;
    }

    const state = matchdayWindowState(matchday);
    reportTitle.textContent = previewMode ? "Busses Night Desk Preview" : "Night Desk";
    windowNote.textContent = (!statTablesReady || !ratingTablesReady)
      ? "The night desk is open in view mode while live saving is being switched on."
      : previewMode
        ? "Preview access is on for busses testing. Saves here still update the saved live matchday records."
        : state.statsOpen && state.ratingsOpen
          ? `Stats and ratings are open right now. Stats close ${formatLongDate(state.statsCloseAt)} and ratings close ${formatLongDate(state.ratingsCloseAt)}.`
        : state.ratingsOpen
          ? `Stat entry is closed. Ratings stay open until ${formatLongDate(state.ratingsCloseAt)} whether or not stats were submitted.`
          : "This matchday is closed.";
  }

  function updateHeaderCopy() {
    const matchday = selectedMatchday();
    const viewingSuggestions = activeSubmissionView === "suggestions";
    const viewingRatings = activeSubmissionView === "ratings";

    if (pageLabel) {
      pageLabel.textContent = viewingSuggestions
        ? "Match Centre · Club board"
        : viewingRatings
          ? "Match Centre · Teammate ratings"
          : "Match Centre · Night report";
    }

    if (pageTitle) {
      pageTitle.textContent = viewingSuggestions
        ? "Club Board"
        : viewingRatings
          ? "Teammate Ratings"
          : "Night Report";
    }

    document.title = viewingSuggestions
      ? "Match Centre · Club Board"
      : viewingRatings
        ? "Match Centre · Teammate Ratings"
        : "Match Centre · Night Report";

    heroCopy.textContent = previewMode
      ? viewingSuggestions
        ? "Choose a completed night, pick your name first, then test suggestion posts, replies, and likes. Preview saves still update the live saved board."
        : viewingRatings
          ? "Choose a completed night, pick your name first, then test teammate ratings with the live club rating. Preview saves still update saved records."
          : "Choose a completed night, pick your name first, then test a full night report with stats and teammate ratings. Preview saves still update saved records."
      : matchday
        ? viewingSuggestions
          ? "Choose your name first, then use the suggestion board to raise ideas, reply to threads, or like the notes that matter."
          : viewingRatings
            ? "Open your match card first, then move through teammate ratings with a live 0-to-99 club rating."
            : "Open your match card first. Your team and scores load automatically, then lock your stat line or swing straight into teammate ratings."
        : viewingSuggestions
          ? "Open a matchday from Fixtures, then choose your name to post or reply on the suggestion board."
          : viewingRatings
            ? "Open a matchday from Fixtures, then choose your name to hand out teammate ratings."
            : "Open a matchday from Fixtures, then choose your name to open the full night report.";

    playerCopy.textContent = previewMode
      ? "Open the desk by choosing your name from the players who appeared on this saved matchday. Preview saves still update the saved live record."
      : "Open the desk by choosing your name from the players who were on the field for this matchday.";

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
    renderSuggestions();
    renderCompletionCard();
    renderWindowState();
    updateHeaderCopy();
    setSubmissionView(activeSubmissionView, { updateHistory: false });
    syncSubmissionWizard();

    const scheduleHref = activeSeasonId ? `./schedule.html?season_id=${activeSeasonId}` : "./schedule.html";
    scheduleLink.href = scheduleHref;
  }

  async function loadSeason() {
    setStatus("Loading night desk...");

    try {
      playerSelectionFallbackNote = "";
      const bundle = await fetchSeasonBundle(activeSeasonId);
      matchdayWindowMap = await fetchMatchdayWindows(activeSeasonId);
      activeBundle = mergeMatchdayWindows(bundle);

      if (!(activeBundle?.matchdays || []).some((row) => Number(row.id) === Number(selectedMatchdayId))) {
        const activeMatchday = newestLiveWindowMatchday(activeBundle?.matchdays || []);
        selectedMatchdayId = activeMatchday?.id || defaultMatchdayId(activeBundle);
      }

      if (!previewMode && !playersForMatchday(selectedMatchdayId).length) {
        const fallbackMatchdayId = latestSelectableMatchdayId(activeBundle);
        if (fallbackMatchdayId && Number(fallbackMatchdayId) !== Number(selectedMatchdayId)) {
          selectedMatchdayId = fallbackMatchdayId;
          playerSelectionFallbackNote =
            "The report jumped to the latest matchday that is open for player selection.";
        }
      }

      if (!previewMode && !playersForMatchday(selectedMatchdayId).length) {
        const activeRef = await detectActiveMatchdayRef();
        if (activeRef && (activeRef.seasonId !== activeSeasonId || activeRef.matchdayId !== selectedMatchdayId)) {
          activeSeasonId = activeRef.seasonId;
          selectedMatchdayId = activeRef.matchdayId;
          renderSeasonOptions();
          await loadSeason();
          setStatus("The report jumped to the latest matchday that is open for player selection.", "warning");
          return;
        }
      }

      await Promise.all([loadSubmissionsForMatchday(), loadDiscussionForMatchday()]);

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
      if (playerSelectionFallbackNote) {
        setStatus(playerSelectionFallbackNote, "warning");
      } else {
        const statusState = loadedStatusState();
        setStatus(statusState.message, statusState.tone);
      }
    } catch (error) {
      const message = readableSubmissionError(error);
      setStatus(message, "error");
      reportCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      selectedPlayerCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      matchScoresCard.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      playerSelect.innerHTML = `<option value="">${escapeHtml(message)}</option>`;
      playerSelect.disabled = true;
      ratingTargets.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      suggestionThreadList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
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
      setStatus("The stat window is not open for this matchday right now.", "warning");
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
      setStatus(
        previewMode
          ? "Preview save complete. The live stat line was updated."
          : "Your stat line has been saved.",
        "success"
      );
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
      const rawValue = draft.scores?.[question.key];
      const value =
        rawValue === undefined || rawValue === null || rawValue === ""
          ? null
          : Number(rawValue);
      return !isValidClubRating(value);
    });

    if (missingQuestions.length) {
      setStatus(`Add an overall rating for ${playerDisplayName(target)} before saving.`, "warning");
      return;
    }

    try {
      saveRatingButton.disabled = true;
      saveRatingButton.textContent = "Saving rating...";

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
      setStatus(
        previewMode
          ? `Preview save complete. ${playerDisplayName(target)}'s live rating record was updated.`
          : `Rating saved for ${playerDisplayName(target)}.`,
        "success"
      );
    } catch (error) {
      setStatus(readableSubmissionError(error), "error");
    } finally {
      saveRatingButton.disabled = false;
      saveRatingButton.textContent = "Save rating";
    }
  }

  async function saveSuggestionThread(event) {
    event.preventDefault();

    const player = selectedPlayer();
    const matchday = selectedMatchday();
    const title = normalizeText(suggestionTitleInput.value || "");
    const body = normalizeText(suggestionBodyInput.value || "");

    if (!matchday) {
      setStatus("Choose a matchday first.", "warning");
      return;
    }

    if (!discussionTablesReady) {
      setStatus("Discussion saving is not switched on yet.", "warning");
      return;
    }

    if (!player) {
      setStatus("Choose your name first to post a suggestion.", "warning");
      return;
    }

    if (title.length < 3) {
      setStatus("Add a short title for the suggestion before posting.", "warning");
      suggestionTitleInput.focus();
      return;
    }

    if (!body.length) {
      setStatus("Write the suggestion details before posting.", "warning");
      suggestionBodyInput.focus();
      return;
    }

    try {
      savingSuggestion = true;
      renderSuggestionComposer();

      const { error } = await supabaseClient.from("matchday_suggestions").insert({
        matchday_id: matchday.id,
        author_player_id: player.id,
        title,
        body,
      });

      if (error) {
        throw error;
      }

      suggestionTitleInput.value = "";
      suggestionBodyInput.value = "";
      await loadDiscussionForMatchday();
      renderSuggestions();
      setStatus(
        previewMode
          ? "Preview post complete. The live suggestion board was updated."
          : "Suggestion posted to the matchday board.",
        "success"
      );
    } catch (error) {
      setStatus(readableSubmissionError(error), "error");
    } finally {
      savingSuggestion = false;
      renderSuggestionComposer();
    }
  }

  async function saveSuggestionReply(suggestionId) {
    const player = selectedPlayer();
    const matchday = selectedMatchday();
    const body = normalizeText(replyDrafts.get(Number(suggestionId)) || "");

    if (!matchday) {
      setStatus("Choose a matchday first.", "warning");
      return;
    }

    if (!discussionTablesReady) {
      setStatus("Discussion saving is not switched on yet.", "warning");
      return;
    }

    if (!player) {
      setStatus("Choose your name first to reply.", "warning");
      return;
    }

    if (!body.length) {
      setStatus("Write the reply before saving it.", "warning");
      return;
    }

    try {
      savingReplySuggestionId = Number(suggestionId);
      renderSuggestionThreads();

      const { error } = await supabaseClient.from("matchday_suggestion_replies").insert({
        suggestion_id: suggestionId,
        author_player_id: player.id,
        body,
      });

      if (error) {
        throw error;
      }

      replyDrafts.delete(Number(suggestionId));
      activeReplySuggestionId = null;
      await loadDiscussionForMatchday();
      renderSuggestions();
      setStatus(
        previewMode
          ? "Preview reply complete. The live suggestion board was updated."
          : "Reply posted to the suggestion thread.",
        "success"
      );
    } catch (error) {
      setStatus(readableSubmissionError(error), "error");
    } finally {
      savingReplySuggestionId = null;
      renderSuggestionThreads();
    }
  }

  async function toggleSuggestionLike(target) {
    const player = selectedPlayer();
    const matchday = selectedMatchday();
    const targetKey = `${target.type}:${target.id}`;

    if (!matchday) {
      setStatus("Choose a matchday first.", "warning");
      return;
    }

    if (!discussionTablesReady) {
      setStatus("Discussion saving is not switched on yet.", "warning");
      return;
    }

    if (!player) {
      setStatus("Choose your name first to like suggestions or replies.", "warning");
      return;
    }

    try {
      pendingLikeTargetKey = targetKey;
      renderSuggestionThreads();

      const existingLike = suggestionLikeRowForPlayer(target, player.id);

      if (existingLike) {
        const { error } = await supabaseClient
          .from("matchday_suggestion_likes")
          .delete()
          .eq("id", existingLike.id);

        if (error) {
          throw error;
        }

        setStatus(
          previewMode
            ? "Preview unlike complete. The live suggestion board was updated."
            : "Like removed from the suggestion board.",
          "success"
        );
      } else {
        const payload =
          target.type === "reply"
            ? { suggestion_reply_id: target.id, liked_by_player_id: player.id }
            : { suggestion_id: target.id, liked_by_player_id: player.id };
        const { error } = await supabaseClient.from("matchday_suggestion_likes").insert(payload);

        if (error) {
          throw error;
        }

        setStatus(
          previewMode
            ? "Preview like complete. The live suggestion board was updated."
            : "Like saved to the suggestion board.",
          "success"
        );
      }

      await loadDiscussionForMatchday();
      renderSuggestions();
    } catch (error) {
      setStatus(readableSubmissionError(error), "error");
    } finally {
      pendingLikeTargetKey = "";
      renderSuggestionThreads();
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
    await Promise.all([loadSubmissionsForMatchday(), loadDiscussionForMatchday()]);
    renderAll();
  });

  playerSelect.addEventListener("change", () => {
    selectedPlayerId = Number(playerSelect.value) || null;
    selectedRateeId = null;
    renderAll();
  });

  submissionViewTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      setSubmissionView(button.dataset.submissionViewTrigger, {
        focus: true,
        scroll: true,
      });
    });
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

  function handleRatingScoreChange(input) {
    if (!input || !selectedRateeId) {
      return;
    }

    const question = input.dataset.ratingSlider;
    const score = Math.round(Number(input.value || 0));
    const draft = ratingDraftFor(selectedRateeId);

    if (!draft || !question) {
      return;
    }

    draft.scores = {
      ...(draft.scores || {}),
      [question]: score,
      overall: clubRatingToLegacyScore(score),
    };
    ratingDrafts.set(selectedRateeId, draft);
    syncRatingScorePresentation(score);
  }

  ratingQuestionList.addEventListener("input", (event) => {
    handleRatingScoreChange(event.target.closest("[data-rating-slider]"));
  });

  ratingQuestionList.addEventListener("change", (event) => {
    handleRatingScoreChange(event.target.closest("[data-rating-slider]"));
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
  suggestionForm.addEventListener("submit", saveSuggestionThread);

  nextRatingButton.addEventListener("click", () => {
    const nextId = nextTargetId();
    if (!nextId) {
      return;
    }

    selectedRateeId = nextId;
    renderAll();
  });

  refreshSuggestionsButton.addEventListener("click", async () => {
    try {
      await loadDiscussionForMatchday();
      renderSuggestions();
      setStatus(
        discussionTablesReady
          ? "Suggestion board refreshed."
          : "Suggestion board is still waiting on the discussion migration.",
        discussionTablesReady ? "success" : "warning"
      );
    } catch (error) {
      setStatus(readableSubmissionError(error), "error");
    }
  });

  suggestionThreadList.addEventListener("click", async (event) => {
    const likeThreadButton = event.target.closest("[data-suggestion-like-id]");
    if (likeThreadButton) {
      await toggleSuggestionLike({
        type: "thread",
        id: Number(likeThreadButton.dataset.suggestionLikeId),
      });
      return;
    }

    const likeReplyButton = event.target.closest("[data-reply-like-id]");
    if (likeReplyButton) {
      await toggleSuggestionLike({
        type: "reply",
        id: Number(likeReplyButton.dataset.replyLikeId),
      });
      return;
    }

    const toggleReplyButton = event.target.closest("[data-toggle-reply-id]");
    if (toggleReplyButton) {
      const suggestionId = Number(toggleReplyButton.dataset.toggleReplyId);
      activeReplySuggestionId =
        Number(activeReplySuggestionId) === suggestionId ? null : suggestionId;
      renderSuggestionThreads();
      return;
    }

    const cancelReplyButton = event.target.closest("[data-cancel-reply-id]");
    if (cancelReplyButton) {
      activeReplySuggestionId = null;
      renderSuggestionThreads();
      return;
    }

    const saveReplyButton = event.target.closest("[data-save-reply-id]");
    if (saveReplyButton) {
      await saveSuggestionReply(Number(saveReplyButton.dataset.saveReplyId));
    }
  });

  suggestionThreadList.addEventListener("input", (event) => {
    const textarea = event.target.closest("[data-reply-draft-id]");
    if (!textarea) {
      return;
    }

    replyDrafts.set(Number(textarea.dataset.replyDraftId), textarea.value);
  });

  window.addEventListener("resize", () => {
    syncSubmissionWizard();
  });

  async function ensurePreviewAccess() {
    if (!previewRequested) {
      previewMode = false;
      return true;
    }

    const adminAuth = window.MandarinasAdminAuth;
    const fallbackHref = window.MandarinasShell?.bussesAccessHref?.(window.location.href) || "./busses.html";

    if (!adminAuth) {
      window.location.replace(fallbackHref);
      return false;
    }

    const access = await adminAuth.resolveAccess();
    if (!access.ok || !access.isAdmin) {
      window.location.replace(adminAuth.accessPageHref(window.location.href));
      return false;
    }

    previewMode = true;
    return true;
  }

  async function init() {
    try {
      if (!(await ensurePreviewAccess())) {
        return;
      }

      setSubmissionView(activeSubmissionView, { updateHistory: false });
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
