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
      key: "overall",
      label: "Overall rating",
      hint: "How did they do overall for your team that day? Half stars are allowed.",
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
    return ratingSubmissions.filter(
      (row) =>
        Number(row.rater_player_id) === Number(playerId) &&
        isTeammateRelationship(row.relationship)
    );
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

    return rows
      .map((player) => {
        const teammateTargetCount = player.team_code
          ? assignments.filter(
              (assignment) =>
                Number(assignment.player_id) !== Number(player.id) &&
                normalizeText(assignment.team_code) === normalizeText(player.team_code)
            ).length
          : 0;

        return {
          ...player,
          stat_saved: Boolean(statSubmissionForPlayer(player.id)),
          ratings_saved: ratingRowsForPlayer(player.id).length,
          ratings_total: teammateTargetCount,
        };
      })
      .sort((left, right) => playerDisplayName(left).localeCompare(playerDisplayName(right)));
  }

  function filteredPlayersForSelect() {
    return eligiblePlayers();
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
      .filter(
        (assignment) =>
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

  function ratingProgressText(targetCount, savedCount) {
    if (!targetCount) {
      return "No teammate queue is ready for this player yet.";
    }

    if (savedCount === targetCount) {
      return "Every teammate in this queue has been rated.";
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
            : submissionState.ratingsClosed
              ? "Closed"
              : "Waiting";

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
        ? "Open a matchday first. Busses can test the ratings flow while official records stay locked."
        : "No live player ratings window is open right now.";
    }

    if (!submissionTablesReady) {
      return "Live rating saving is not switched on for this screen yet.";
    }

    const state = matchdayWindowState(matchday);

    if (previewMode) {
      return "Open access is on right now so busses can test the ratings flow.";
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
    } else if (state.ratingsClosed) {
      badges.push('<span class="tag-pill">Closed</span>');
    } else {
      badges.push('<span class="tag-pill">Waiting</span>');
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
          return `
            <option value="${player.id}" ${Number(player.id) === Number(selectedPlayerId) ? "selected" : ""}>
              ${escapeHtml(playerDisplayName(player))} · ${escapeHtml(teamLabel)}
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
        <span class="tag-pill">${player.stat_saved ? "Stats saved" : "No stats submitted"}</span>
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
    const teammateCount = targets.length;
    const savedCount = ratingRowsForPlayer(player?.id).length;

    ensureRateeSelection();

    ratingTeammateCount.textContent = String(teammateCount);
    ratingSavedCount.textContent = String(savedCount);

    if (!player || !matchday) {
      ratingTargets.innerHTML = '<div class="empty-state">Choose your name first.</div>';
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "Choose your name first.";
      return;
    }

    if (!targets.length) {
      ratingTargets.innerHTML = '<div class="empty-state">No teammate queue is available until teams are saved for this matchday.</div>';
      ratingForm.hidden = true;
      ratingsEmpty.hidden = false;
      ratingsEmpty.textContent = "No teammate queue is available until teams are saved for this matchday.";
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
            <span class="mini-sub">Teammate</span>
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
    ratingRelationship.textContent = "Teammate";
    ratingName.textContent = playerDisplayName(target);
    ratingTeamPill.className = `team-badge ${escapeHtml(teamClassName(target.team_code))}`;
    ratingTeamPill.textContent = formatTeamLabel(target.team_code);
    ratingProgressCopy.textContent = ratingProgressText(targets.length, savedCount);
    ratingsCopy.textContent = submissionTablesReady
      ? "Give one overall star rating from 0.5 to 5 for each teammate."
      : "Live rating saving is not switched on for this screen yet.";
    saveRatingButton.disabled = !saveEnabled;
    nextRatingButton.disabled = !targets.length;
    ratingNote.textContent = !submissionTablesReady
      ? "Saving is disabled until live rating saving is switched on."
      : previewMode
        ? "Open access is on right now so busses can test the ratings flow."
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
      : "Choose your name from the current roster. Ratings stay separate from stats, so either form can be handled on its own.";

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
        ? `${activeBundle.season.name} ratings desk is open for busses testing. Open any matchday, pick a player, and inspect the rating queue.`
        : selectedMatchdayId
          ? `${activeBundle.season.name} player ratings are live for the current matchday. Pick yourself and work through the queue whenever ratings are open.`
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

    const submissionState = matchdayWindowState(matchday);
    if (!submissionState.ratingsOpen) {
      setStatus("The rating window is not open for this matchday right now.", "warning");
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
