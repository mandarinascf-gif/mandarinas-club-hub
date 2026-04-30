document.addEventListener("DOMContentLoaded", async () => {
  if (!window.MandarinasPublic) {
    const msg = "MandarinasPublic failed to load. Check browser console for script errors.";
    document.getElementById("status-text").textContent = msg;
    console.error("[MandarinasPublic] Fatal:", msg);
    return;
  }

  const supabaseClient = window.MandarinasSupabaseConfig.createClient();
  const {
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    fetchAllTimeStandings,
    buildBadgeStandings,
    normalizeText,
    escapeHtml,
    playerDisplayName,
    playerNameParts,
    nationalityFlag,
    calculateAge,
    formatStatusLabel,
    readableError,
    buildCompletedMatchdays,
    buildPlayerMatchdayDetails,
    querySeasonIdFromUrl,
  } = window.MandarinasPublic;

  const seasonSelect = document.getElementById("season-select");
  const rosterSearch = document.getElementById("roster-search");
  const playerList = document.getElementById("player-list");
  const playerDetail = document.getElementById("player-detail");
  const statusLine = document.getElementById("status-line");
  const statusText = document.getElementById("status-text");
  const totalPlayersEl = document.getElementById("total-players");
  const rotationPlayersEl = document.getElementById("rotation-players");
  const corePlayersEl = document.getElementById("core-players");
  const seasonNameEl = document.getElementById("season-name");
  const rosterRequestCopy = document.getElementById("roster-request-copy");
  const rosterRequestStatus = document.getElementById("roster-request-status");
  const existingRequestForm = document.getElementById("roster-existing-request-form");
  const existingDirectoryPlayerSelect = document.getElementById("roster-request-directory-player");
  const existingTierSelect = document.getElementById("roster-request-existing-tier");
  const existingContactInput = document.getElementById("roster-request-existing-contact");
  const existingNoteInput = document.getElementById("roster-request-existing-note");
  const existingRequestButton = document.getElementById("roster-request-existing-button");
  const newRequestForm = document.getElementById("roster-new-request-form");
  const newFirstNameInput = document.getElementById("roster-request-first-name");
  const newLastNameInput = document.getElementById("roster-request-last-name");
  const newNicknameInput = document.getElementById("roster-request-nickname");
  const newNationalityInput = document.getElementById("roster-request-nationality");
  const newPositionSelect = document.getElementById("roster-request-position");
  const newTierSelect = document.getElementById("roster-request-new-tier");
  const newContactInput = document.getElementById("roster-request-contact");
  const newNoteInput = document.getElementById("roster-request-note");
  const newRequestButton = document.getElementById("roster-request-new-button");

  let seasons = [];
  let activeSeasonId = querySeasonIdFromUrl();
  let allPlayers = [];
  let allStandings = [];
  let playerDetailsMap = new Map();
  let directoryPlayers = [];
  let seasonRosterRequests = [];
  let rosterRequestsSupported = true;
  let positionFilter = "all";
  let tierFilter = "all";
  let selectedPlayerId = null;
  let rosterLoadedMessage = "";
  let allTimeStandingsCache = new Map();
  let allTimeStandingsPromiseCache = new Map();
  let pendingAllTimePlayerId = null;
  let playerStatViewById = new Map();
  let html2CanvasPromise = null;
  const ALL_TIME_CACHE_KEY = "all";

  function hasMissingDesiredTierColumn(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      (message.includes("column") || message.includes("schema cache")) &&
      message.includes("desired_tier")
    );
  }

  function hasMissingRosterRequestTable(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      message.includes("season_roster_requests") &&
      (
        message.includes("relation") ||
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find")
      )
    );
  }

  function normalizeDirectoryPlayer(player) {
    const desiredTier = normalizeText(player?.desired_tier || player?.status || "rotation").toLowerCase();
    return {
      ...player,
      desired_tier: desiredTier,
      status: desiredTier,
      positions: Array.isArray(player?.positions) && player.positions.length ? player.positions : ["MID"],
    };
  }

  function normalizeRosterRequestRow(row) {
    return {
      ...row,
      request_type: normalizeText(row?.request_type || "directory").toLowerCase(),
      requester_name: normalizeText(row?.requester_name || ""),
      requester_contact: normalizeText(row?.requester_contact || ""),
      first_name: normalizeText(row?.first_name || ""),
      last_name: normalizeText(row?.last_name || ""),
      nickname: normalizeText(row?.nickname || ""),
      nationality: normalizeText(row?.nationality || ""),
      preferred_positions:
        Array.isArray(row?.preferred_positions) && row.preferred_positions.length
          ? row.preferred_positions.map((value) => normalizeText(value).toUpperCase())
          : ["MID"],
      requested_tier: normalizeText(row?.requested_tier || "rotation").toLowerCase(),
      status: normalizeText(row?.status || "pending").toLowerCase(),
      note: normalizeText(row?.note || ""),
    };
  }

  function setRosterRequestStatus(message, tone = "") {
    if (!rosterRequestStatus) {
      return;
    }

    rosterRequestStatus.hidden = !message;
    rosterRequestStatus.textContent = message || "";
    rosterRequestStatus.className = tone ? `status-line ${tone}` : "status-line";
  }

  function updateSeasonUrl() {
    const url = new URL(window.location.href);

    if (activeSeasonId) {
      url.searchParams.set("season_id", String(activeSeasonId));
    } else {
      url.searchParams.delete("season_id");
    }

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

  function buildStandingsMap(standings) {
    const map = new Map();
    (standings || []).forEach((entry) => {
      map.set(entry.player_id || entry.player?.id, entry);
    });
    return map;
  }

  function activePlayerStatView(playerId) {
    return playerStatViewById.get(Number(playerId)) || "season";
  }

  function restoreRosterLoadedStatus() {
    if (!rosterLoadedMessage) {
      return;
    }

    statusLine.classList.remove("loading", "error", "warning");
    statusLine.classList.add("success");
    statusText.textContent = rosterLoadedMessage;
  }

  function setAllTimeErrorStatus(error) {
    statusLine.classList.remove("loading", "success", "error");
    statusLine.classList.add("warning");
    statusText.textContent = `All-time badge stats are unavailable right now. ${readableError(error)}`;
  }

  function allTimeStandingsForActiveSeason() {
    return allTimeStandingsCache.get(ALL_TIME_CACHE_KEY) || null;
  }

  async function ensureAllTimeStandingsLoaded() {
    if (!seasons.length) {
      return new Map();
    }

    if (allTimeStandingsCache.has(ALL_TIME_CACHE_KEY)) {
      return allTimeStandingsCache.get(ALL_TIME_CACHE_KEY);
    }

    if (allTimeStandingsPromiseCache.has(ALL_TIME_CACHE_KEY)) {
      return allTimeStandingsPromiseCache.get(ALL_TIME_CACHE_KEY);
    }

    const promise = (async () => {
      const standings = await fetchAllTimeStandings();
      const standingsMap = buildStandingsMap(standings);
      allTimeStandingsCache.set(ALL_TIME_CACHE_KEY, standingsMap);
      return standingsMap;
    })().finally(() => {
      allTimeStandingsPromiseCache.delete(ALL_TIME_CACHE_KEY);
    });

    allTimeStandingsPromiseCache.set(ALL_TIME_CACHE_KEY, promise);
    return promise;
  }

  function buildBadgeFilename(player) {
    const rawName = playerDisplayName(player)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `mandarinas-${rawName || "player"}-badge.png`;
  }

  function ensureHtml2CanvasLoaded() {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("Browser share tools are unavailable in this context."));
    }

    if (typeof window.html2canvas === "function") {
      return Promise.resolve(window.html2canvas);
    }

    if (html2CanvasPromise) {
      return html2CanvasPromise;
    }

    html2CanvasPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-html2canvas-loader="true"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.html2canvas), { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("html2canvas failed to load.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.async = true;
      script.dataset.html2canvasLoader = "true";
      script.addEventListener("load", () => resolve(window.html2canvas), { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("html2canvas failed to load.")),
        { once: true }
      );
      document.head.appendChild(script);
    }).finally(() => {
      if (typeof window?.html2canvas !== "function") {
        html2CanvasPromise = null;
      }
    });

    return html2CanvasPromise;
  }

  function getPlayerStats(playerId, standingsMap) {
    return standingsMap.get(playerId) || {
      seasons_participated: 0,
      goals: 0,
      goal_keep_points_earned: 0,
      clean_sheets: 0,
      days_attended: 0,
      total_points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points_per_game: 0,
      rank: "-",
    };
  }

  function formatWholeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : "0";
  }

  function formatRecord(stats) {
    return `${formatWholeNumber(stats.wins)}-${formatWholeNumber(stats.draws)}-${formatWholeNumber(
      stats.losses
    )}`;
  }

  function formatBadgePpg(stats) {
    const value = Number(stats?.points_per_game || 0);
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  }

  function renderBadgeSummaryMarkup(view, stats) {
    const primaryLabel = view === "all_time" ? "Seasons" : "Season";
    const primaryValue =
      view === "all_time"
        ? formatWholeNumber(stats.seasons_participated)
        : normalizeText(seasonNameEl.textContent, "Current");

    return `
      <div class="player-badge-summary" aria-label="Player badge summary">
        <div class="player-badge-summary-stat">
          <span>${escapeHtml(primaryLabel)}</span>
          <strong>${escapeHtml(primaryValue)}</strong>
        </div>
        <div class="player-badge-summary-stat">
          <span>Record</span>
          <strong>${escapeHtml(formatRecord(stats))}</strong>
        </div>
        <div class="player-badge-summary-stat">
          <span>PPG</span>
          <strong>${escapeHtml(formatBadgePpg(stats))}</strong>
        </div>
        <div class="player-badge-summary-stat">
          <span>Apps</span>
          <strong>${escapeHtml(formatWholeNumber(stats.days_attended))}</strong>
        </div>
      </div>
    `;
  }

  function getPositionCategory(positions) {
    if (!positions || !positions.length) {
      return "ATT";
    }

    const first = String(positions[0]).toUpperCase();
    if (first.startsWith("GK")) {
      return "GK";
    }
    if (first.startsWith("D")) {
      return "DEF";
    }
    if (first.startsWith("M")) {
      return "MID";
    }
    return "ATT";
  }

  function tierSortRank(status) {
    if (status === "core") {
      return 0;
    }
    if (status === "rotation") {
      return 1;
    }
    if (status === "flex_sub") {
      return 2;
    }
    return 3;
  }

  function comparePlayersForRoster(left, right) {
    const tierDifference = tierSortRank(left?.status) - tierSortRank(right?.status);
    if (tierDifference !== 0) {
      return tierDifference;
    }

    const displayDifference = playerDisplayName(left).localeCompare(playerDisplayName(right));
    if (displayDifference !== 0) {
      return displayDifference;
    }

    const leftFullName = `${left?.first_name || ""} ${left?.last_name || ""}`.trim();
    const rightFullName = `${right?.first_name || ""} ${right?.last_name || ""}`.trim();
    return leftFullName.localeCompare(rightFullName);
  }

  function visiblePlayers() {
    const query = normalizeText(rosterSearch.value).toLowerCase();

    return allPlayers
      .filter((player) => {
        if (positionFilter !== "all" && getPositionCategory(player.positions) !== positionFilter) {
          return false;
        }

        if (tierFilter !== "all" && player.status !== tierFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          player.first_name,
          player.last_name,
          player.nickname || "",
          player.nationality || "",
          ...(player.positions || []),
          player.status || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort(comparePlayersForRoster);
  }

  function ensureSelectedPlayerStillVisible() {
    const rows = visiblePlayers();

    if (!rows.length) {
      selectedPlayerId = null;
      return;
    }

    if (selectedPlayerId == null) {
      return;
    }

    if (!rows.some((player) => Number(player.id) === Number(selectedPlayerId))) {
      selectedPlayerId = null;
    }
  }

  function formatFoot(value) {
    const normalized = normalizeText(value).toLowerCase();

    if (normalized === "left" || normalized === "right" || normalized === "both") {
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    return "Right";
  }

  function playerBadgeMonogram(player) {
    const initials = [player?.first_name, player?.last_name]
      .map((value) => normalizeText(value).charAt(0).toUpperCase())
      .filter(Boolean)
      .join("")
      .slice(0, 2);

    if (initials) {
      return initials;
    }

    return playerDisplayName(player).slice(0, 2).toUpperCase();
  }

  function playerRankDisplay(value) {
    const rank = Number(value);
    return Number.isFinite(rank) && rank > 0 ? String(rank) : "--";
  }

  function positionRoleLabel(position) {
    const map = {
      GK: "Goalkeeper",
      DEF: "Defender",
      MID: "Midfielder",
      ATT: "Forward",
    };

    return map[position] || position || "Player";
  }

  function badgePositionCode(positions) {
    const normalized = (Array.isArray(positions) ? positions : [])
      .map((value) => normalizeText(value).toUpperCase())
      .filter(Boolean);

    if (!normalized.length) {
      return "CM";
    }

    const codeSet = new Set(normalized);
    if (codeSet.has("GK")) {
      return "GK";
    }
    if (codeSet.has("MID") && codeSet.has("ATT")) {
      return "AM";
    }
    if (codeSet.has("MID") && codeSet.has("DEF")) {
      return "DM";
    }
    if (codeSet.has("ATT")) {
      return "ST";
    }
    if (codeSet.has("MID")) {
      return "CM";
    }
    if (codeSet.has("DEF")) {
      return "CB";
    }

    return normalized[0];
  }

  function badgePositionPillsMarkup(positions) {
    const normalized = (Array.isArray(positions) ? positions : [])
      .map((value) => normalizeText(value).toUpperCase())
      .filter(Boolean)
      .slice(0, 3);

    if (!normalized.length) {
      return "";
    }

    return `
      <div class="roster-orbit-position-row" aria-label="Player positions">
        ${normalized
          .map(
            (position) =>
              `<span class="roster-orbit-position-pill">${escapeHtml(position)}</span>`
          )
          .join("")}
      </div>
    `;
  }

  function badgeHeaderMarkup(player) {
    const badgeKey = `roster-badge-${Number(player?.id) || "player"}`;
    const topArcId = `${badgeKey}-top-arc`;
    const subArcId = `${badgeKey}-sub-arc`;

    return `
      <div class="roster-orbit-header" aria-hidden="true">
        <svg class="roster-orbit-header-svg" viewBox="0 0 320 186" role="presentation">
          <defs>
            <path id="${topArcId}" d="M 40 134 A 120 120 0 0 1 280 134"></path>
            <path id="${subArcId}" d="M 64 136 A 96 96 0 0 1 256 136"></path>
          </defs>
          <text class="roster-orbit-wordmark-svg">
            <textPath href="#${topArcId}" startOffset="50%" text-anchor="middle">
              MANDARINAS
            </textPath>
          </text>
          <text class="roster-orbit-submark-svg">
            <textPath href="#${subArcId}" startOffset="50%" text-anchor="middle">
              CALIFORNIA CLUB DE FUTBOL
            </textPath>
          </text>
        </svg>
      </div>
    `;
  }

  function renderPlayerDetailMarkup(player) {
    const seasonStandingsMap = buildStandingsMap(allStandings);
    const view = activePlayerStatView(player.id);
    const loadingAllTime = Number(pendingAllTimePlayerId) === Number(player.id);
    const allTimeStandingsByPlayerId = allTimeStandingsForActiveSeason();
    const activeStandingsMap =
      view === "all_time" && allTimeStandingsByPlayerId instanceof Map
        ? allTimeStandingsByPlayerId
        : seasonStandingsMap;
    const stats = getPlayerStats(player.id, activeStandingsMap);
    const positions =
      Array.isArray(player.positions) && player.positions.length ? player.positions : [];
    const nationality = player.nationality || "";
    const flag = nationalityFlag(player.nationality || "");
    const overall = Number.isFinite(Number(player.skill_rating)) ? Number(player.skill_rating) : 0;
    const points = Number(stats.total_points || 0);
    const pointsPerGame = Number(Number(stats.points_per_game || 0).toFixed(2));
    const attendance = Number(stats.days_attended || 0);
    const goals = Number(stats.goals || 0);
    const positionLabel = positions.length
      ? positions
          .slice(0, 3)
          .map((value) => normalizeText(value).toUpperCase())
          .filter(Boolean)
          .join(" · ")
      : normalizeText(player.position_label || player.primary_position || "", "N/A");
    const badgePlayer = {
      name: playerDisplayName(player) || "Player",
      nationality,
      flag,
      birth_date: player.birth_date,
      overall_rating: overall,
      rank: playerRankDisplay(stats.rank),
      ppg: Number(pointsPerGame),
      primary_position: positions[0] || normalizeText(player.primary_position || "", "N/A"),
      position_label: positionLabel,
      positions,
    };
    const badgeStats = {
      points,
      apps: attendance,
      goals,
      wins: Number(stats.wins || 0),
      draws: Number(stats.draws || 0),
      losses: Number(stats.losses || 0),
      goal_keeps: Number(stats.goal_keeps || 0),
      clean_sheets: Number(stats.clean_sheets || 0),
      rank: playerRankDisplay(stats.rank),
      ppg: pointsPerGame,
      points_per_game: pointsPerGame,
    };
    const badgeMarkup = window.renderPlayerBadge
      ? window.renderPlayerBadge(badgePlayer, badgeStats).outerHTML
      : "";
    const viewNote = loadingAllTime
      ? "Loading club totals across all recorded seasons..."
      : view === "all_time"
        ? "All completed club seasons loaded into the archive."
        : `${normalizeText(seasonNameEl.textContent) || "Current season"} badge totals.`;
    const seasonActive = view === "season" || loadingAllTime;
    const allTimeActive = view === "all_time" && !loadingAllTime;
    const badgeSummaryMarkup = !loadingAllTime ? renderBadgeSummaryMarkup(view, stats) : "";
    const viewNoteMarkup = viewNote
      ? `<p class="player-badge-view-note">${escapeHtml(viewNote)}</p>`
      : "";

    return `
      <div class="player-badge-toolbar">
        <div class="player-badge-view-toggle season-toggle" role="tablist" aria-label="${escapeHtml(
          `${playerDisplayName(player)} badge stat range`
        )}">
          <button
            class="view-chip player-badge-view-chip pill ${seasonActive ? "active" : ""}"
            type="button"
            data-player-stat-view="season"
            data-player-id="${player.id}"
            aria-pressed="${seasonActive ? "true" : "false"}"
            ${loadingAllTime ? "disabled" : ""}
          >
            CURRENT SEASON
          </button>
          <button
            class="view-chip player-badge-view-chip pill ${allTimeActive ? "active" : ""}"
            type="button"
            data-player-stat-view="all_time"
            data-player-id="${player.id}"
            aria-pressed="${allTimeActive ? "true" : "false"}"
            ${loadingAllTime ? "disabled" : ""}
          >
            ALL TIME
          </button>
        </div>
        ${viewNoteMarkup}
        <button
          class="secondary-button player-badge-share-button"
          type="button"
          data-share-badge-player-id="${player.id}"
          ${loadingAllTime ? "disabled" : ""}
        >
          Share Badge
        </button>
      </div>
      ${badgeSummaryMarkup}
      <div id="shareBadgeCard" class="player-badge-share-card">
        <div class="roster-player-badge ${loadingAllTime ? "is-loading" : ""}">
          ${badgeMarkup}
        </div>
      </div>
    `;
  }
  function renderRoster() {
    const rows = visiblePlayers();

    if (!allPlayers.length) {
      playerList.innerHTML = '<div class="empty-state">No players on this season squad yet.</div>';
      return;
    }

    if (!rows.length) {
      playerList.innerHTML = '<div class="empty-state">No players match the current filters.</div>';
      return;
    }

    playerList.innerHTML = rows
      .map((player) => {
        const nameParts = playerNameParts(player);
        const subtitle = [nameParts.secondary, formatStatusLabel(player.status)]
          .filter(Boolean)
          .join(" · ");
        const isActive = Number(player.id) === Number(selectedPlayerId);

        return `
          <article class="list-item roster-player-card ${isActive ? "active expanded" : ""}" data-player-id="${player.id}">
            <div class="roster-player-header">
              <div class="roster-player-header-copy">
                <div class="list-item-title">${escapeHtml(nameParts.primary || playerDisplayName(player))}</div>
                <div class="compact-row-copy">${escapeHtml(subtitle || "Club player")}</div>
              </div>
              <div class="list-actions">
                <span class="tier-pill ${escapeHtml(player.status)}">${escapeHtml(formatStatusLabel(player.status))}</span>
                <button class="secondary-button" type="button">${isActive ? "Hide" : "View"}</button>
              </div>
            </div>
            ${
              isActive
                ? `<div class="roster-inline-detail">${renderPlayerDetailMarkup(player)}</div>`
                : ""
            }
          </article>
        `;
      })
      .join("");
  }

  function renderRecentHistory(details) {
    const recent = [...(details || [])].slice(-3).reverse();

    if (!recent.length) {
      return "";
    }

    return `
      <div class="roster-player-badge-history-row">
        ${recent
          .map(
            (row) => `
              <article class="roster-player-badge-history-chip">
                <span class="roster-player-badge-history-chip-kicker">MD ${escapeHtml(row.matchday_number)}</span>
                <strong>${escapeHtml(
                  normalizeText(row.attendance_status || (row.attended ? "in" : "out")).replaceAll("_", " ")
                )}</strong>
                <small>${escapeHtml(`${row.goals || 0}G · ${row.goal_keeps || 0} GK`)}</small>
                <small>${escapeHtml(`${row.wins}-${row.draws}-${row.losses}${row.clean_sheet ? " · CS" : ""}`)}</small>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderDetail() {
    const player = allPlayers.find((entry) => Number(entry.id) === Number(selectedPlayerId));

    if (!player) {
      playerDetail.innerHTML = '<div class="empty-state">Select a player from the list.</div>';
      return;
    }

    playerDetail.innerHTML = renderPlayerDetailMarkup(player);
  }

  async function shareBadgeForPlayer(playerIdValue) {
    const player = allPlayers.find((entry) => Number(entry.id) === Number(playerIdValue));
    const shareButton = document.querySelector(
      `[data-share-badge-player-id="${Number(playerIdValue)}"]`
    );
    const shareCard = document.getElementById("shareBadgeCard");

    if (!player || !shareButton || !shareCard) {
      return;
    }

    const originalLabel = shareButton.textContent;
    shareButton.disabled = true;
    shareButton.textContent = "Preparing...";

    try {
      const html2canvas = await ensureHtml2CanvasLoaded();
      const canvas = await html2canvas(shareCard, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

      if (!blob) {
        throw new Error("Could not export the badge image.");
      }

      const filename = buildBadgeFilename(player);
      const file = new File([blob], filename, {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Mandarinas CF Player Badge",
        });
      } else {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(downloadUrl);
      }

      restoreRosterLoadedStatus();
    } catch (error) {
      if (error?.name !== "AbortError") {
        statusLine.classList.remove("loading", "success", "error");
        statusLine.classList.add("warning");
        statusText.textContent = `Badge share is unavailable right now. ${readableError(error)}`;
      }
    } finally {
      shareButton.disabled = false;
      shareButton.textContent = originalLabel;
    }
  }

  function updateSummaryStats() {
    totalPlayersEl.textContent = String(allPlayers.length);
    corePlayersEl.textContent = String(allPlayers.filter((player) => player.status === "core").length);
    rotationPlayersEl.textContent = String(
      allPlayers.filter((player) => player.status === "rotation").length
    );
  }

  function requestableDirectoryPlayers() {
    const rosterPlayerIds = new Set(allPlayers.map((player) => Number(player.id)));
    return directoryPlayers
      .filter((player) => !rosterPlayerIds.has(Number(player.id)))
      .sort(comparePlayersForRoster);
  }

  function pendingRequestsForSeason() {
    return seasonRosterRequests.filter(
      (row) => Number(row.season_id) === Number(activeSeasonId) && row.status === "pending"
    );
  }

  function findDirectoryPlayerByName(firstName, lastName) {
    const normalizedFirst = normalizeText(firstName).toLowerCase();
    const normalizedLast = normalizeText(lastName).toLowerCase();

    return (
      directoryPlayers.find(
        (player) =>
          normalizeText(player.first_name).toLowerCase() === normalizedFirst &&
          normalizeText(player.last_name).toLowerCase() === normalizedLast
      ) || null
    );
  }

  function setRequestInputsDisabled(disabled) {
    [
      existingDirectoryPlayerSelect,
      existingTierSelect,
      existingContactInput,
      existingNoteInput,
      existingRequestButton,
      newFirstNameInput,
      newLastNameInput,
      newNicknameInput,
      newNationalityInput,
      newPositionSelect,
      newTierSelect,
      newContactInput,
      newNoteInput,
      newRequestButton,
    ].forEach((element) => {
      if (element) {
        element.disabled = disabled;
      }
    });
  }

  function syncExistingRequestTierFromSelection() {
    const selectedPlayerIdValue = Number(existingDirectoryPlayerSelect.value);
    const player = requestableDirectoryPlayers().find((entry) => entry.id === selectedPlayerIdValue);
    const fallbackTier = player?.desired_tier || player?.status || "rotation";
    existingTierSelect.value = fallbackTier;
  }

  function resetNewRequestForm() {
    newRequestForm.reset();
    newPositionSelect.value = "MID";
    newTierSelect.value = "rotation";
  }

  function renderRosterRequestTools() {
    const selectedSeason = pickSeason(seasons, activeSeasonId);

    if (!selectedSeason) {
      directoryPlayers = [];
      seasonRosterRequests = [];
      existingDirectoryPlayerSelect.innerHTML =
        '<option value="">Select your name from the full squad</option>';
      rosterRequestCopy.textContent =
        "Launch a season first. Season-squad requests only open after a live season is available.";
      setRequestInputsDisabled(true);
      return;
    }

    if (!rosterRequestsSupported) {
      existingDirectoryPlayerSelect.innerHTML =
        '<option value="">Self-request tools are waiting for the latest club update</option>';
      rosterRequestCopy.textContent =
        "Self-request tools will open after the latest live club update adds season-squad request tracking.";
      setRequestInputsDisabled(true);
      return;
    }

    const addablePlayers = requestableDirectoryPlayers();
    const pendingRequests = pendingRequestsForSeason();
    const pendingPlayerIds = new Set(
      pendingRequests.filter((row) => row.player_id).map((row) => Number(row.player_id))
    );
    const availableDirectoryRequests = addablePlayers.filter(
      (player) => !pendingPlayerIds.has(Number(player.id))
    );

    rosterRequestCopy.textContent = `${selectedSeason.name} is using ${allPlayers.length} live season-squad players. If you are missing from this season but already in the full squad register, request your spot here. If you are new to the club, send a full-squad request first. Admin approval is required before your name reaches the live season squad.`;

    if (!addablePlayers.length) {
      existingDirectoryPlayerSelect.innerHTML =
        '<option value="">Everyone in the full squad register is already on this season squad</option>';
    } else {
      existingDirectoryPlayerSelect.innerHTML = `
        <option value="">Select your name from the full squad</option>
        ${addablePlayers
          .map((player) => {
            const pending = pendingPlayerIds.has(Number(player.id));
            const pendingLabel = pending ? " · pending request" : "";
            return `<option value="${player.id}" ${pending ? "disabled" : ""}>${escapeHtml(
              playerDisplayName(player)
            )} · full squad current/next-season ${escapeHtml(formatStatusLabel(player.status))}${escapeHtml(
              pendingLabel
            )}</option>`;
          })
          .join("")}
      `;
    }

    if (!availableDirectoryRequests.length) {
      existingDirectoryPlayerSelect.value = "";
    } else if (
      !availableDirectoryRequests.some(
        (player) => Number(player.id) === Number(existingDirectoryPlayerSelect.value)
      )
    ) {
      existingDirectoryPlayerSelect.value = String(availableDirectoryRequests[0].id);
    }

    syncExistingRequestTierFromSelection();
    setRequestInputsDisabled(false);
    existingDirectoryPlayerSelect.disabled = !addablePlayers.length;
    existingRequestButton.disabled = !availableDirectoryRequests.length;
  }

  async function loadDirectoryPlayers() {
    let { data, error } = await supabaseClient
      .from("players")
      .select("id, first_name, last_name, nickname, nationality, phone, positions, desired_tier, status")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error && hasMissingDesiredTierColumn(error)) {
      ({ data, error } = await supabaseClient
        .from("players")
        .select("id, first_name, last_name, nickname, nationality, phone, positions, status")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }));
    }

    if (error) {
      throw error;
    }

    directoryPlayers = (data || []).map(normalizeDirectoryPlayer);
  }

  async function loadSeasonRosterRequests() {
    if (!activeSeasonId || !rosterRequestsSupported) {
      seasonRosterRequests = [];
      return;
    }

    const { data, error } = await supabaseClient
      .from("season_roster_requests")
      .select(
        "id, season_id, player_id, request_type, requester_name, requester_contact, first_name, last_name, nickname, nationality, preferred_positions, requested_tier, note, status, created_at"
      )
      .eq("season_id", activeSeasonId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error && hasMissingRosterRequestTable(error)) {
      rosterRequestsSupported = false;
      seasonRosterRequests = [];
      return;
    }

    if (error) {
      throw error;
    }

    seasonRosterRequests = (data || []).map(normalizeRosterRequestRow);
  }

  async function loadSeason() {
    const selectedSeason = pickSeason(seasons, activeSeasonId);
    pendingAllTimePlayerId = null;
    playerStatViewById = new Map();

    if (!selectedSeason) {
      seasonSelect.innerHTML = '<option value="">No seasons available</option>';
      seasonSelect.disabled = true;
      seasonNameEl.textContent = "-";
      allPlayers = [];
      allStandings = [];
      playerDetailsMap = new Map();
      selectedPlayerId = null;
      rosterLoadedMessage = "No seasons found.";
      statusLine.classList.remove("loading", "success", "error");
      statusLine.classList.add("warning");
      statusText.textContent = rosterLoadedMessage;
      playerList.innerHTML = '<div class="empty-state">No seasons are available yet.</div>';
      playerDetail.innerHTML = '<div class="empty-state">Launch a season to view the season squad.</div>';
      updateSummaryStats();
      renderRosterRequestTools();
      return;
    }

    activeSeasonId = selectedSeason.id;
    renderSeasonOptions();
    updateSeasonUrl();
    seasonSelect.disabled = false;
    seasonNameEl.textContent = selectedSeason.name;
    statusLine.classList.remove("success", "error", "warning");
    statusLine.classList.add("loading");
    statusText.textContent = "Loading the season squad...";

    try {
      const bundle = await fetchSeasonBundle(selectedSeason.id);
      allPlayers = bundle.players || [];

      const completedMatchdays = buildCompletedMatchdays(bundle.matchdays, bundle.matches);
      allStandings = buildBadgeStandings(
        bundle.players,
        bundle.assignments,
        bundle.playerStats,
        completedMatchdays,
        selectedSeason
      );
      playerDetailsMap = buildPlayerMatchdayDetails(
        bundle.players,
        bundle.assignments,
        bundle.playerStats,
        completedMatchdays
      );

      ensureSelectedPlayerStillVisible();

      updateSummaryStats();
      renderRoster();
      renderDetail();

      try {
        await Promise.all([loadDirectoryPlayers(), loadSeasonRosterRequests()]);
      } catch (requestSupportError) {
        directoryPlayers = [];
        seasonRosterRequests = [];
        setRosterRequestStatus(readableError(requestSupportError), "warning");
      }

      renderRosterRequestTools();

      statusLine.classList.remove("loading", "error", "warning");
      statusLine.classList.add("success");
      rosterLoadedMessage = `${selectedSeason.name} · ${allPlayers.length} players loaded`;
      statusText.textContent = rosterLoadedMessage;
    } catch (error) {
      const message = readableError(error);
      rosterLoadedMessage = "";
      directoryPlayers = [];
      seasonRosterRequests = [];
      statusLine.classList.remove("loading", "success", "warning");
      statusLine.classList.add("error");
      statusText.textContent = message;
      playerList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      playerDetail.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      renderRosterRequestTools();
    }
  }

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", (event) => {
      const filterType = event.currentTarget.dataset.filter;
      const filterValue = event.currentTarget.dataset.value;

      document.querySelectorAll(`[data-filter="${filterType}"]`).forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.value === filterValue);
      });

      if (filterType === "position") {
        positionFilter = filterValue;
      } else if (filterType === "tier") {
        tierFilter = filterValue;
      }

      ensureSelectedPlayerStillVisible();
      renderRoster();
      renderDetail();
    });
  });

  rosterSearch.addEventListener("input", () => {
    ensureSelectedPlayerStillVisible();
    renderRoster();
    renderDetail();
  });

  async function handlePlayerStatViewClick(event) {
    const viewButton = event.target.closest("[data-player-stat-view]");
    if (!viewButton) {
      return false;
    }

    const nextView = normalizeText(viewButton.dataset.playerStatView).toLowerCase();
    const playerIdValue = Number(viewButton.dataset.playerId);
    if (!Number.isFinite(playerIdValue) || (nextView !== "season" && nextView !== "all_time")) {
      return true;
    }

    if (nextView === activePlayerStatView(playerIdValue)) {
      return true;
    }

    if (nextView === "season") {
      playerStatViewById.set(playerIdValue, "season");
      restoreRosterLoadedStatus();
      renderRoster();
      renderDetail();
      return true;
    }

    pendingAllTimePlayerId = playerIdValue;
    renderRoster();
    renderDetail();

    try {
      await ensureAllTimeStandingsLoaded();
      playerStatViewById.set(playerIdValue, "all_time");
      restoreRosterLoadedStatus();
    } catch (error) {
      playerStatViewById.set(playerIdValue, "season");
      setAllTimeErrorStatus(error);
    } finally {
      pendingAllTimePlayerId = null;
      renderRoster();
      renderDetail();
    }

    return true;
  }

  playerList.addEventListener("click", async (event) => {
    if (await handlePlayerStatViewClick(event)) {
      return;
    }

    const shareButton = event.target.closest("[data-share-badge-player-id]");
    if (shareButton) {
      await shareBadgeForPlayer(Number(shareButton.dataset.shareBadgePlayerId));
      return;
    }

    if (event.target.closest(".roster-inline-detail")) {
      return;
    }

    const item = event.target.closest("[data-player-id]");
    if (!item) {
      return;
    }

    const nextPlayerId = Number(item.dataset.playerId);
    selectedPlayerId = Number(selectedPlayerId) === nextPlayerId ? null : nextPlayerId;
    renderRoster();
    renderDetail();
  });

  playerDetail.addEventListener("click", async (event) => {
    if (await handlePlayerStatViewClick(event)) {
      return;
    }

    const shareButton = event.target.closest("[data-share-badge-player-id]");
    if (!shareButton) {
      return;
    }

    await shareBadgeForPlayer(Number(shareButton.dataset.shareBadgePlayerId));
  });

  seasonSelect.addEventListener("change", async () => {
    activeSeasonId = Number(seasonSelect.value) || null;
    setRosterRequestStatus("");
    await loadSeason();
  });

  existingDirectoryPlayerSelect.addEventListener("change", () => {
    syncExistingRequestTierFromSelection();
  });

  existingRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!activeSeasonId) {
      setRosterRequestStatus("Choose a live season first.", "warning");
      return;
    }

    if (!rosterRequestsSupported) {
      setRosterRequestStatus(
        "Season squad requests are waiting for the latest club update.",
        "warning"
      );
      return;
    }

    const playerId = Number(existingDirectoryPlayerSelect.value);
    const player = directoryPlayers.find((entry) => Number(entry.id) === playerId);

    if (!playerId || !player) {
      setRosterRequestStatus("Choose your full-squad profile first.", "warning");
      return;
    }

    if (
      pendingRequestsForSeason().some((row) => Number(row.player_id) === Number(playerId) && row.status === "pending")
    ) {
      setRosterRequestStatus("A pending season-squad request already exists for that full-squad player.", "warning");
      return;
    }

    existingRequestButton.disabled = true;
    existingRequestButton.textContent = "Sending...";
    setRosterRequestStatus(`Sending a season squad request for ${playerDisplayName(player)}...`);

    const { error } = await supabaseClient.from("season_roster_requests").insert({
      season_id: activeSeasonId,
      player_id: player.id,
      request_type: "directory",
      requester_name: playerDisplayName(player),
      requester_contact: normalizeText(existingContactInput.value || player.phone || "") || null,
      first_name: player.first_name,
      last_name: player.last_name,
      nickname: normalizeText(player.nickname || "") || null,
      nationality: player.nationality,
      preferred_positions: Array.isArray(player.positions) && player.positions.length ? player.positions : ["MID"],
      requested_tier: normalizeText(existingTierSelect.value || player.status || "rotation").toLowerCase(),
      note: normalizeText(existingNoteInput.value) || null,
      status: "pending",
    });

    existingRequestButton.disabled = false;
    existingRequestButton.textContent = "Request season squad spot";

    if (error) {
      setRosterRequestStatus(readableError(error), "error");
      return;
    }

    existingContactInput.value = "";
    existingNoteInput.value = "";
    await loadSeasonRosterRequests();
    renderRosterRequestTools();
    setRosterRequestStatus(
      `${playerDisplayName(player)} was sent to the busses for season squad approval.`,
      "success"
    );
  });

  newRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!activeSeasonId) {
      setRosterRequestStatus("Choose a live season first.", "warning");
      return;
    }

    if (!rosterRequestsSupported) {
      setRosterRequestStatus(
        "Season squad requests are waiting for the latest club update.",
        "warning"
      );
      return;
    }

    const firstName = normalizeText(newFirstNameInput.value);
    const lastName = normalizeText(newLastNameInput.value);
    const nickname = normalizeText(newNicknameInput.value);
    const nationality = normalizeText(newNationalityInput.value);
    const contact = normalizeText(newContactInput.value);
    const requestedTier = normalizeText(newTierSelect.value || "rotation").toLowerCase();
    const position = normalizeText(newPositionSelect.value || "MID").toUpperCase();
    const note = normalizeText(newNoteInput.value);
    const requesterName = normalizeText(`${firstName} ${lastName}`);

    if (!firstName || !lastName || !nationality || !contact) {
      setRosterRequestStatus("Add your name, nationality, and contact before requesting full-squad review.", "warning");
      return;
    }

    const existingDirectoryPlayer = findDirectoryPlayerByName(firstName, lastName);
    if (existingDirectoryPlayer) {
      setRosterRequestStatus(
        `${playerDisplayName(existingDirectoryPlayer)} is already in the full squad register. Use the full-squad request above instead.`,
        "warning"
      );
      return;
    }

    if (
      pendingRequestsForSeason().some(
        (row) =>
          row.player_id == null &&
          normalizeText(row.first_name).toLowerCase() === firstName.toLowerCase() &&
          normalizeText(row.last_name).toLowerCase() === lastName.toLowerCase()
      )
    ) {
      setRosterRequestStatus("A pending full-squad request already exists for that name.", "warning");
      return;
    }

    newRequestButton.disabled = true;
    newRequestButton.textContent = "Sending...";
    setRosterRequestStatus(`Sending a full-squad review for ${requesterName}...`);

    const { error } = await supabaseClient.from("season_roster_requests").insert({
      season_id: activeSeasonId,
      player_id: null,
      request_type: "new_directory",
      requester_name: requesterName,
      requester_contact: contact,
      first_name: firstName,
      last_name: lastName,
      nickname: nickname || null,
      nationality,
      preferred_positions: [position],
      requested_tier: requestedTier,
      note: note || null,
      status: "pending",
    });

    newRequestButton.disabled = false;
    newRequestButton.textContent = "Request full squad + season review";

    if (error) {
      setRosterRequestStatus(readableError(error), "error");
      return;
    }

    resetNewRequestForm();
    await loadSeasonRosterRequests();
    renderRosterRequestTools();
    setRosterRequestStatus(
      `${requesterName} was sent to the busses for full-squad and season review.`,
      "success"
    );
  });

  try {
    seasons = await fetchSeasons();
    await loadSeason();
  } catch (error) {
    const message = readableError(error);
    seasonSelect.innerHTML = '<option value="">Season unavailable</option>';
    seasonSelect.disabled = true;
    statusLine.classList.remove("loading", "success", "warning");
    statusLine.classList.add("error");
    statusText.textContent = message;
    playerList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    playerDetail.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    renderRosterRequestTools();
  }
});
