(function () {
  "use strict";

  // FIX: Guard against missing Supabase CDN — if the CDN script did not load, `supabase` is
  // undefined and createClient would throw, silently preventing MandarinasPublic from existing.
  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    console.error("[MandarinasPublic] FATAL: Supabase JS library did not load. Check network/CDN.");
    window.MandarinasPublic = null;
    return;
  }

  if (!window.MandarinasLogic) {
    console.error("[MandarinasPublic] FATAL: MandarinasLogic (club_logic.js) did not load.");
    window.MandarinasPublic = null;
    return;
  }

  const supabaseConfig = window.MandarinasSupabaseConfig;
  if (!supabaseConfig?.hasCredentials) {
    console.error("[MandarinasPublic] FATAL: Supabase runtime config is missing.");
    window.MandarinasPublic = null;
    return;
  }

  const { url: SUPABASE_URL } = supabaseConfig;
  const supabaseClient = supabaseConfig.createClient();

  const {
    TEAM_ORDER,
    normalizeText,
    normalizeTeamDisplayConfig,
    teamDisplayLabel,
    applyTeamDisplayConfig,
    sortSeasonsChronologically,
    nationalityCode,
    nationalityFlag,
    flagAssetPath,
    flagIconMarkup,
    escapeHtml,
    fullName,
    stripSubPrefix,
    playerDisplayName,
    playerNameParts,
    calculateAge,
    formatStatusLabel,
    formatTrendLabel,
    badgeIconMarkup,
    tierIconMarkup,
    trendIconMarkup,
    normalizeTierValue,
    normalizePlayerDesiredTier,
    historicalSeasonIds,
    attendanceStatus,
    buildCompletedMatchdays,
    compareStandingsPriority,
    summarizeMatchdayProgress,
    buildStandings,
    buildPlayerMatchdayDetails,
    sortStandings,
  } = window.MandarinasLogic;

  const TEAM_CLASS_NAMES = Object.freeze({
    magenta: "magenta",
    blue: "blue",
    green: "green",
    orange: "orange",
  });
  const BASE_SEASON_SELECT =
    "id, name, total_matchdays, core_spots, rotation_spots, attendance_points, win_points, draw_points, loss_points, goal_keep_points, team_goal_points, created_at";
  const SEASON_SELECT_WITH_TEAM_DISPLAY = `${BASE_SEASON_SELECT}, team_display_config`;
  const PLAYER_DIRECTORY_SELECT =
    "id, first_name, last_name, nickname, nationality, birth_date, positions, skill_rating, desired_tier, status, dominant_foot, created_at";
  const PLAYER_DIRECTORY_SELECT_FALLBACK =
    "id, first_name, last_name, nickname, nationality, birth_date, positions, skill_rating, status, dominant_foot, created_at";
  const SUPABASE_PAGE_SIZE = 1000;

  let activeTeamDisplayConfig = applyTeamDisplayConfig(null);

  function formatDateTime(value) {
    if (!value) {
      return "Not scheduled";
    }

    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatDay(value) {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  function formatLongDate(value) {
    if (!value) {
      return "Date pending";
    }

    return new Date(value).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatTeamLabel(code) {
    return teamDisplayLabel(activeTeamDisplayConfig, code);
  }

  function teamClassName(code) {
    return TEAM_CLASS_NAMES[code] || "";
  }

  function hasMissingTeamDisplayColumn(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      (message.includes("column") || message.includes("schema cache")) &&
      message.includes("team_display_config")
    );
  }

  function hasMissingDesiredTierColumn(error) {
    const message = String(error?.message || "").toLowerCase();
    return (
      (message.includes("column") || message.includes("schema cache")) &&
      message.includes("desired_tier")
    );
  }

  function normalizeSeasonTeamDisplay(season) {
    if (!season) {
      return season;
    }

    const teamDisplayConfig = normalizeTeamDisplayConfig(season.team_display_config);
    return {
      ...season,
      team_display_config: teamDisplayConfig,
    };
  }

  function activateSeasonTeamDisplay(season) {
    const normalizedSeason = normalizeSeasonTeamDisplay(season);
    activeTeamDisplayConfig = applyTeamDisplayConfig(normalizedSeason?.team_display_config || null);
    return normalizedSeason;
  }

  function normalizeSeasonTierStatus(value, fallback = "flex") {
    return normalizeTierValue(value, fallback);
  }

  function normalizeTierViewRow(row) {
    if (!row) {
      return row;
    }

    const defaultStatus = normalizeSeasonTierStatus(row.default_status, "sub");
    const tierStatus = normalizeSeasonTierStatus(row.tier_status, defaultStatus);
    const preliminarySuggestedStatus = normalizeSeasonTierStatus(
      row.preliminary_recommended_tier_status || row.recommended_tier_status,
      tierStatus
    );

    return {
      ...row,
      default_status: defaultStatus,
      tier_status: tierStatus,
      registration_tier: normalizeSeasonTierStatus(row.registration_tier, defaultStatus),
      preliminary_recommended_tier_status: preliminarySuggestedStatus,
      recommended_tier_status: normalizeSeasonTierStatus(
        row.recommended_tier_status,
        preliminarySuggestedStatus
      ),
    };
  }

  function readableError(error) {
    const message = error?.message || "Unknown error";
    const lower = message.toLowerCase();

    if (lower.includes("relation")) {
      return "This screen cannot open until live club data is ready.";
    }

    if (lower.includes("column") || lower.includes("schema cache")) {
      return "This screen is waiting for the latest live club update. Refresh shortly.";
    }

    return message;
  }

  async function fetchPagedRows(buildQuery, pageSize = SUPABASE_PAGE_SIZE) {
    const rows = [];
    let from = 0;

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await buildQuery(from, to);

      if (error) {
        throw error;
      }

      const page = data || [];
      rows.push(...page);

      if (page.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return rows;
  }

  // FIX: Lightweight health check — surfaces auth or connectivity problems before the first real
  // query so pages can show a specific diagnostic instead of a generic blank state.
  async function checkConnection() {
    try {
      const { error } = await supabaseClient.from("seasons").select("id").limit(1);
        if (error) {
          const msg = String(error.message || "").toLowerCase();
          if (msg.includes("apikey") || msg.includes("jwt") || msg.includes("invalid") || msg.includes("unauthorized")) {
          return { ok: false, reason: "Live club data access is unavailable right now." };
          }
        if (msg.includes("relation") || msg.includes("does not exist")) {
          return { ok: false, reason: "Core club data is not ready for this screen yet." };
        }
        return { ok: false, reason: `Club data error: ${error.message}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: `Cannot reach live club data right now. ${err.message}` };
    }
  }

  async function fetchSeasons() {
    let { data, error } = await supabaseClient
      .from("seasons")
      .select(SEASON_SELECT_WITH_TEAM_DISPLAY)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error && hasMissingTeamDisplayColumn(error)) {
      ({ data, error } = await supabaseClient
        .from("seasons")
        .select(BASE_SEASON_SELECT)
        .order("created_at", { ascending: false })
        .limit(100));
    }

    if (error) {
      throw error;
    }

    return sortSeasonsChronologically((data || []).map(normalizeSeasonTeamDisplay));
  }

  function pickSeason(seasons, requestedId) {
    const orderedSeasons = sortSeasonsChronologically(seasons || []);

    if (!orderedSeasons.length) {
      return null;
    }

    if (requestedId) {
      return (
        orderedSeasons.find((season) => Number(season.id) === Number(requestedId)) ||
        orderedSeasons[orderedSeasons.length - 1]
      );
    }

    return orderedSeasons[orderedSeasons.length - 1];
  }

  async function fetchSeasonBundle(seasonId) {
    let [{ data: season, error: seasonError }, { data: seasonPlayers, error: playersError }, { data: matchdays, error: matchdaysError }, { data: tiers, error: tiersError }, { data: rotationPriority, error: rotationError }] =
      await Promise.all([
        supabaseClient
          .from("seasons")
          .select(SEASON_SELECT_WITH_TEAM_DISPLAY)
          .eq("id", seasonId)
          .single(),
        supabaseClient
          .from("season_players")
          .select(
            "id, tier_status, registration_tier, is_eligible, player:players(id, first_name, last_name, nickname, nationality, birth_date, positions, skill_rating, desired_tier, status, dominant_foot, created_at)"
          )
          .eq("season_id", seasonId)
          .limit(5000),
        supabaseClient
          .from("matchdays")
          .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
          .eq("season_id", seasonId)
          .order("matchday_number", { ascending: true })
          .limit(200),
        supabaseClient
          .from("v_season_tier_transparency")
          .select("*")
          .eq("season_id", seasonId)
          .limit(5000),
        supabaseClient
          .from("v_rotation_priority")
          .select("*")
          .eq("season_id", seasonId)
          .order("rotation_priority_rank", { ascending: true })
          .limit(5000),
      ]);

    let normalizedSeason = season;

    if (seasonError && hasMissingTeamDisplayColumn(seasonError)) {
      const fallbackSeasonResponse = await supabaseClient
        .from("seasons")
        .select(BASE_SEASON_SELECT)
        .eq("id", seasonId)
        .single();

      normalizedSeason = fallbackSeasonResponse.data;

      if (fallbackSeasonResponse.error) {
        throw fallbackSeasonResponse.error;
      }
    }

    if (seasonError && !hasMissingTeamDisplayColumn(seasonError)) {
      throw seasonError;
    }

    if (playersError && hasMissingDesiredTierColumn(playersError)) {
      ({ data: seasonPlayers, error: playersError } = await supabaseClient
        .from("season_players")
        .select(
          "id, tier_status, registration_tier, is_eligible, player:players(id, first_name, last_name, nickname, nationality, birth_date, positions, skill_rating, status, dominant_foot, created_at)"
        )
        .eq("season_id", seasonId));
    }

    if (playersError) {
      throw playersError;
    }

    if (matchdaysError) {
      throw matchdaysError;
    }

    // Tier/rotation views are optional — pages like home.html don't need them.
    // Only log a warning instead of throwing so the rest of the bundle still loads.
    if (tiersError) {
      console.warn("[MandarinasPublic] v_season_tier_transparency query failed:", tiersError.message);
    }

    if (rotationError) {
      console.warn("[MandarinasPublic] v_rotation_priority query failed:", rotationError.message);
    }

    const players = (seasonPlayers || [])
      .map((row) => {
        const registryPlayer = normalizePlayerDesiredTier(row.player, "flex");
        const seasonStatus = normalizeSeasonTierStatus(row.tier_status, registryPlayer.desired_tier);
        const registrationTier = normalizeSeasonTierStatus(
          row.registration_tier,
          registryPlayer.desired_tier
        );
        return {
          ...registryPlayer,
          season_player_id: row.id,
          status: registryPlayer.desired_tier,
          season_status: seasonStatus,
          tier_status: seasonStatus,
          registration_tier: registrationTier,
          base_status: registryPlayer.desired_tier,
          is_eligible: row.is_eligible,
        };
      })
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

    const matchdayIds = (matchdays || []).map((matchday) => matchday.id);
    let matches = [];
    let assignments = [];
    let playerStats = [];

    if (matchdayIds.length) {
      [matches, assignments, playerStats] = await Promise.all([
        fetchPagedRows((from, to) =>
          supabaseClient
            .from("matchday_matches")
            .select("*")
            .in("matchday_id", matchdayIds)
            .order("matchday_id", { ascending: true })
            .order("round_number", { ascending: true })
            .order("match_order", { ascending: true })
            .range(from, to)
        ),
        fetchPagedRows((from, to) =>
          supabaseClient
            .from("matchday_assignments")
            .select("*")
            .in("matchday_id", matchdayIds)
            .order("matchday_id", { ascending: true })
            .order("player_id", { ascending: true })
            .range(from, to)
        ),
        fetchPagedRows((from, to) =>
          supabaseClient
            .from("matchday_player_stats")
            .select("*")
            .in("matchday_id", matchdayIds)
            .order("matchday_id", { ascending: true })
            .order("player_id", { ascending: true })
            .range(from, to)
        ),
      ]);
    }

    return {
      season: activateSeasonTeamDisplay(normalizedSeason),
      players: players || [],
      matchdays: matchdays || [],
      matches,
      assignments,
      playerStats,
      tiers: (tiers || []).map((row) => normalizeTierViewRow(row)),
      rotationPriority: (rotationPriority || []).map((row) => normalizeTierViewRow(row)),
    };
  }

  async function fetchHistoricalTierAttendance(seasons, seasonId, playerIds) {
    const targetPlayerIds = [...new Set((playerIds || []).map(Number).filter(Number.isFinite))];
    const priorSeasonIds = historicalSeasonIds(seasons, seasonId);

    if (!priorSeasonIds.length || !targetPlayerIds.length) {
      return {
        matchdays: [],
        matches: [],
        playerStats: [],
      };
    }

    const { data: historicalMatchdays, error: historicalMatchdaysError } = await supabaseClient
      .from("matchdays")
      .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
      .in("season_id", priorSeasonIds)
      .order("season_id", { ascending: true })
      .order("matchday_number", { ascending: true })
      .limit(5000);

    if (historicalMatchdaysError) {
      throw historicalMatchdaysError;
    }

    const historicalMatchdayIds = (historicalMatchdays || []).map((matchday) => matchday.id);
    if (!historicalMatchdayIds.length) {
      return {
        matchdays: historicalMatchdays || [],
        matches: [],
        playerStats: [],
      };
    }

    return {
      matchdays: historicalMatchdays || [],
      matches: await fetchPagedRows((from, to) =>
        supabaseClient
          .from("matchday_matches")
          .select("*")
          .in("matchday_id", historicalMatchdayIds)
          .order("matchday_id", { ascending: true })
          .order("round_number", { ascending: true })
          .order("match_order", { ascending: true })
          .range(from, to)
      ),
      playerStats: await fetchPagedRows((from, to) =>
        supabaseClient
          .from("matchday_player_stats")
          .select("*")
          .in("matchday_id", historicalMatchdayIds)
          .in("player_id", targetPlayerIds)
          .order("matchday_id", { ascending: true })
          .order("player_id", { ascending: true })
          .range(from, to)
      ),
    };
  }

  function mergeStandingsEntryTotals(target, source) {
    target.seasons_participated += Number(source.seasons_participated || 0);
    target.total_points += Number(source.total_points || 0);
    target.attendance_points += Number(source.attendance_points || 0);
    target.days_attended += Number(source.days_attended || 0);
    target.games_played += Number(source.games_played || 0);
    target.wins += Number(source.wins || 0);
    target.draws += Number(source.draws || 0);
    target.losses += Number(source.losses || 0);
    target.goalie_points += Number(source.goalie_points || 0);
    target.goal_keeps += Number(source.goal_keeps || 0);
    target.goal_keep_points_earned += Number(source.goal_keep_points_earned || 0);
    target.team_goals += Number(source.team_goals || 0);
    target.team_goal_points_earned += Number(source.team_goal_points_earned || 0);
    target.result_points += Number(source.result_points || 0);
    target.goals += Number(source.goals || 0);
    target.clean_sheets += Number(source.clean_sheets || 0);
    target.no_shows += Number(source.no_shows || 0);
    target.late_cancels += Number(source.late_cancels || 0);
  }

  function badgePointsPerGame(entry) {
    const points = Number(entry?.total_points || 0);
    const apps = Number(entry?.days_attended || 0);
    return apps ? Number((points / apps).toFixed(2)) : 0;
  }

  function compareBadgeStandings(left, right) {
    const pointsDiff = Number(right?.total_points || 0) - Number(left?.total_points || 0);
    if (pointsDiff !== 0) {
      return pointsDiff;
    }

    const ppgDiff = badgePointsPerGame(right) - badgePointsPerGame(left);
    if (Math.abs(ppgDiff) > 0.0001) {
      return ppgDiff;
    }

    const appsDiff = Number(right?.days_attended || 0) - Number(left?.days_attended || 0);
    if (appsDiff !== 0) {
      return appsDiff;
    }

    return compareStandingsPriority(left, right);
  }

  function finalizeBadgeStandings(entries) {
    return [...(entries || [])]
      .map((entry) => ({
        ...entry,
        points_per_game: badgePointsPerGame(entry),
      }))
      .sort(compareBadgeStandings)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  function buildBadgeStandings(players, assignments, playerStats, completedMatchdays, scoringSource) {
    const standings = buildStandings(
      players,
      assignments,
      playerStats,
      completedMatchdays,
      scoringSource
    );
    return finalizeBadgeStandings(standings);
  }

  function buildAllTimeStandings(players, seasons, matchdays, matches, assignments, playerStats) {
    const normalizedPlayers = (players || []).map((player) =>
      normalizePlayerDesiredTier(player, "flex")
    );
    const standingsSeed = new Map(
      normalizedPlayers.map((player) => [
        Number(player.id),
        {
          player_id: Number(player.id),
          player,
          seasons_participated: 0,
          total_points: 0,
          attendance_points: 0,
          days_attended: 0,
          games_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalie_points: 0,
          goal_keeps: 0,
          goal_keep_points_earned: 0,
          team_goals: 0,
          team_goal_points_earned: 0,
          result_points: 0,
          goals: 0,
          clean_sheets: 0,
          no_shows: 0,
          late_cancels: 0,
        },
      ])
    );
    const seasonMap = new Map(
      sortSeasonsChronologically(seasons || []).map((season) => [Number(season.id), season])
    );
    const seasonMatchdays = new Map();
    const seasonMatches = new Map();
    const seasonAssignments = new Map();
    const seasonPlayerStats = new Map();
    const matchdaySeasonMap = new Map();

    (matchdays || []).forEach((matchday) => {
      const seasonId = Number(matchday.season_id);
      if (!Number.isFinite(seasonId)) {
        return;
      }

      const existing = seasonMatchdays.get(seasonId) || [];
      existing.push(matchday);
      seasonMatchdays.set(seasonId, existing);
      matchdaySeasonMap.set(Number(matchday.id), seasonId);
    });

    (matches || []).forEach((match) => {
      const seasonId = matchdaySeasonMap.get(Number(match.matchday_id));
      if (!Number.isFinite(seasonId)) {
        return;
      }

      const existing = seasonMatches.get(seasonId) || [];
      existing.push(match);
      seasonMatches.set(seasonId, existing);
    });

    (assignments || []).forEach((assignment) => {
      const seasonId = matchdaySeasonMap.get(Number(assignment.matchday_id));
      if (!Number.isFinite(seasonId)) {
        return;
      }

      const existing = seasonAssignments.get(seasonId) || [];
      existing.push(assignment);
      seasonAssignments.set(seasonId, existing);
    });

    (playerStats || []).forEach((stat) => {
      const seasonId = matchdaySeasonMap.get(Number(stat.matchday_id));
      if (!Number.isFinite(seasonId)) {
        return;
      }

      const existing = seasonPlayerStats.get(seasonId) || [];
      existing.push(stat);
      seasonPlayerStats.set(seasonId, existing);
    });

    seasonMap.forEach((season, seasonId) => {
      const matchdaysForSeason = seasonMatchdays.get(seasonId) || [];
      if (!matchdaysForSeason.length) {
        return;
      }

      const matchesForSeason = seasonMatches.get(seasonId) || [];
      const completedMatchdays = buildCompletedMatchdays(matchdaysForSeason, matchesForSeason);
      const standings = buildStandings(
        normalizedPlayers,
        seasonAssignments.get(seasonId) || [],
        seasonPlayerStats.get(seasonId) || [],
        completedMatchdays,
        season
      );

      standings.forEach((entry) => {
        const playerId = Number(entry.player_id || entry.player?.id);
        if (!Number.isFinite(playerId) || !standingsSeed.has(playerId)) {
          return;
        }

        mergeStandingsEntryTotals(standingsSeed.get(playerId), {
          ...entry,
          seasons_participated: 1,
        });
      });
    });

    return finalizeBadgeStandings(
      Array.from(standingsSeed.values()).filter((entry) => entry.days_attended > 0)
    );
  }

  async function fetchAllTimeStandings(options = {}) {
    const upToSeasonId = Number(options?.upToSeasonId);
    const hasSeasonLimit = Number.isFinite(upToSeasonId) && upToSeasonId > 0;
    let playerPromise = supabaseClient
      .from("players")
      .select(PLAYER_DIRECTORY_SELECT)
      .order("created_at", { ascending: true })
      .limit(5000);
    const [{ data: seasons, error: seasonsError }, { data: players, error: playersError }] =
      await Promise.all([
        supabaseClient
          .from("seasons")
          .select(BASE_SEASON_SELECT)
          .order("created_at", { ascending: true })
          .limit(500),
        playerPromise,
      ]);

    let normalizedPlayers = players;
    let normalizedPlayersError = playersError;

    if (normalizedPlayersError && hasMissingDesiredTierColumn(normalizedPlayersError)) {
      ({ data: normalizedPlayers, error: normalizedPlayersError } = await supabaseClient
        .from("players")
        .select(PLAYER_DIRECTORY_SELECT_FALLBACK)
        .order("created_at", { ascending: true })
        .limit(5000));
    }

    if (seasonsError) {
      throw seasonsError;
    }
    if (normalizedPlayersError) {
      throw normalizedPlayersError;
    }

    const orderedSeasons = sortSeasonsChronologically(seasons || []);
    const seasonScope = hasSeasonLimit
      ? (() => {
          const selectedIndex = orderedSeasons.findIndex(
            (season) => Number(season.id) === Number(upToSeasonId)
          );
          return selectedIndex >= 0 ? orderedSeasons.slice(0, selectedIndex + 1) : orderedSeasons;
        })()
      : orderedSeasons;
    const scopedSeasonIds = seasonScope
      .map((season) => Number(season.id))
      .filter(Number.isFinite);

    if (!scopedSeasonIds.length) {
      return [];
    }

    const { data: matchdays, error: matchdaysError } = await supabaseClient
      .from("matchdays")
      .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
      .in("season_id", scopedSeasonIds)
      .order("season_id", { ascending: true })
      .order("matchday_number", { ascending: true })
      .limit(5000);

    if (matchdaysError) {
      throw matchdaysError;
    }

    const scopedMatchdayIds = (matchdays || [])
      .map((matchday) => Number(matchday.id))
      .filter(Number.isFinite);

    if (!scopedMatchdayIds.length) {
      return [];
    }

    const [matches, assignments, allPlayerStats] = await Promise.all([
      fetchPagedRows((from, to) =>
        supabaseClient
          .from("matchday_matches")
          .select("*")
          .in("matchday_id", scopedMatchdayIds)
          .order("matchday_id", { ascending: true })
          .order("round_number", { ascending: true })
          .order("match_order", { ascending: true })
          .range(from, to)
      ),
      fetchPagedRows((from, to) =>
        supabaseClient
          .from("matchday_assignments")
          .select("*")
          .in("matchday_id", scopedMatchdayIds)
          .order("matchday_id", { ascending: true })
          .order("player_id", { ascending: true })
          .range(from, to)
      ),
      fetchPagedRows((from, to) =>
        supabaseClient
          .from("matchday_player_stats")
          .select("*")
          .in("matchday_id", scopedMatchdayIds)
          .order("matchday_id", { ascending: true })
          .order("player_id", { ascending: true })
          .range(from, to)
      ),
    ]);

    return buildAllTimeStandings(
      normalizedPlayers || [],
      seasonScope,
      matchdays || [],
      matches,
      assignments,
      allPlayerStats
    );
  }

  function buildLeaderboards(standings) {
    const source = standings || [];
    const byMetric = (sortFn) => [...source].sort(sortFn).slice(0, 8);

    return {
      table: source.slice(0, 8),
      attendance: byMetric((left, right) => {
        if (right.days_attended !== left.days_attended) {
          return right.days_attended - left.days_attended;
        }
        return right.total_points - left.total_points;
      }),
      scorer: byMetric((left, right) => {
        if (right.goals !== left.goals) {
          return right.goals - left.goals;
        }
        return right.total_points - left.total_points;
      }),
      goalie: byMetric((left, right) => {
        if (right.goalie_points !== left.goalie_points) {
          return right.goalie_points - left.goalie_points;
        }
        return right.total_points - left.total_points;
      }),
      clean: byMetric((left, right) => {
        if (right.clean_sheets !== left.clean_sheets) {
          return right.clean_sheets - left.clean_sheets;
        }
        return right.total_points - left.total_points;
      }),
    };
  }

  function matchdayState(matchday, matches) {
    const progress = summarizeMatchdayProgress(matchday, matches);
    const kickoffTime = matchday.kickoff_at ? new Date(matchday.kickoff_at).getTime() : null;
    const kickoffPassed = Number.isFinite(kickoffTime) && kickoffTime < Date.now();

    if (progress.isComplete) {
      return {
        key: "played",
        label: "Played",
        detail: `${progress.scoredMatchCount} of 4 scores saved`,
        isOverdue: false,
      };
    }

    // FIX: distinguish partially scored matchdays from untouched scheduled matchdays so the
    // schedule screen explains why standings are still waiting on more results.
    if (progress.scoredMatchCount > 0) {
      return {
        key: "in_progress",
        label: "In progress",
        detail: `${progress.scoredMatchCount} of 4 scores saved`,
        isOverdue: true,
      };
    }

    if (progress.assignedMatchCount > 0) {
      return {
        key: "scheduled",
        label: "Scheduled",
        detail: kickoffPassed
          ? "Kickoff passed; scores not saved"
          : `${progress.assignedMatchCount} of 4 bracket slots seeded`,
        isOverdue: kickoffPassed,
      };
    }

    if (matchday.kickoff_at) {
      return {
        key: "scheduled",
        label: "Scheduled",
        detail: kickoffPassed ? "Kickoff passed; scores not saved" : "Kickoff assigned",
        isOverdue: kickoffPassed,
      };
    }

    return { key: "pending", label: "Pending", detail: "Kickoff pending", isOverdue: false };
  }

  function buildScorersForMatchday(matchdayId, assignments, playerStats, players) {
    const playerMap = new Map((players || []).map((player) => [player.id, player]));
    const assignmentMap = new Map(
      (assignments || [])
        .filter((assignment) => assignment.matchday_id === matchdayId)
        .map((assignment) => [assignment.player_id, assignment.team_code])
    );

    const grouped = {
      magenta: [],
      blue: [],
      green: [],
      orange: [],
    };

    (playerStats || [])
      .filter((stat) => stat.matchday_id === matchdayId && Number(stat.goals || 0) > 0)
      .forEach((stat) => {
        const player = playerMap.get(stat.player_id);
        const teamCode = assignmentMap.get(stat.player_id);

        if (!player || !teamCode || !grouped[teamCode]) {
          return;
        }

        grouped[teamCode].push({
          name: playerDisplayName(player),
          goals: Number(stat.goals || 0),
        });
      });

    return grouped;
  }

  function buildGoalkeepingForMatchday(matchdayId, assignments, playerStats, players) {
    const playerMap = new Map((players || []).map((player) => [player.id, player]));
    const assignmentMap = new Map(
      (assignments || [])
        .filter((assignment) => assignment.matchday_id === matchdayId)
        .map((assignment) => [assignment.player_id, assignment.team_code])
    );

    const grouped = {
      magenta: [],
      blue: [],
      green: [],
      orange: [],
    };

    (playerStats || [])
      .filter((stat) => stat.matchday_id === matchdayId)
      .forEach((stat) => {
        const player = playerMap.get(stat.player_id);
        const teamCode = assignmentMap.get(stat.player_id);
        const goalKeeps = Number(stat.goal_keeps || 0);
        const cleanSheet = Boolean(stat.clean_sheet);

        if (!player || !teamCode || !grouped[teamCode] || (!goalKeeps && !cleanSheet)) {
          return;
        }

        grouped[teamCode].push({
          name: playerDisplayName(player),
          goal_keeps: goalKeeps,
          clean_sheet: cleanSheet,
        });
      });

    Object.values(grouped).forEach((entries) => {
      entries.sort((left, right) => {
        if (right.clean_sheet !== left.clean_sheet) {
          return Number(right.clean_sheet) - Number(left.clean_sheet);
        }

        if (right.goal_keeps !== left.goal_keeps) {
          return right.goal_keeps - left.goal_keeps;
        }

        return left.name.localeCompare(right.name);
      });
    });

    return grouped;
  }

  function querySeasonIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const seasonId = Number(params.get("season_id"));
    return Number.isFinite(seasonId) && seasonId > 0 ? seasonId : null;
  }

  // FIX: Global error handler surfaces script failures visually instead of leaving a blank page.
  function showFatalError(message) {
    if (typeof document === "undefined") return;
    const existing = document.getElementById("mcf-fatal-error");
    if (existing) { existing.textContent = message; return; }
    const banner = document.createElement("p");
    banner.id = "mcf-fatal-error";
    banner.setAttribute("role", "alert");
    banner.textContent = message;
    (document.body || document.documentElement).appendChild(banner);
  }

  window.MandarinasPublic = {
    supabaseClient,
    TEAM_ORDER,
    normalizeText,
    nationalityCode,
    nationalityFlag,
    flagAssetPath,
    flagIconMarkup,
    escapeHtml,
    fullName,
    stripSubPrefix,
    playerDisplayName,
    playerNameParts,
    calculateAge,
    formatStatusLabel,
    formatTrendLabel,
    badgeIconMarkup,
    tierIconMarkup,
    trendIconMarkup,
    normalizeTierValue,
    formatDateTime,
    formatDay,
    formatLongDate,
    formatTeamLabel,
    teamClassName,
    readableError,
    sortSeasonsChronologically,
    fetchSeasons,
    pickSeason,
    fetchSeasonBundle,
    fetchAllTimeStandings,
    fetchHistoricalTierAttendance,
    buildCompletedMatchdays,
    buildBadgeStandings,
    buildStandings,
    buildAllTimeStandings,
    buildPlayerMatchdayDetails,
    sortStandings,
    buildLeaderboards,
    matchdayState,
    buildScorersForMatchday,
    buildGoalkeepingForMatchday,
    querySeasonIdFromUrl,
    showFatalError,
    checkConnection,
  };
})();
