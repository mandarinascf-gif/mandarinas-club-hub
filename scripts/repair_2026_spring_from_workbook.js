const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");
const { SUPABASE_URL, authHeaders } = require("./supabase_config.js");
const { ROOT, resolveSeasonWorkbookPath } = require("./reseed_paths.js");
const SEASON_NAME = "2026 Spring";
const EXPORT_SCRIPT = path.join(__dirname, "export_2026_spring_seed_data.py");

function resolveWorkbookPath() {
  const explicitPath =
    process.argv[3] || process.env.MCF_WORKBOOK_PATH || resolveSeasonWorkbookPath(SEASON_NAME);
  return path.resolve(explicitPath);
}

function canonicalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function displayName(player) {
  return String(player?.nickname || "").trim() ||
    [player?.first_name, player?.last_name].filter(Boolean).join(" ").trim();
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${response.status} ${body}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchSeason() {
  const seasons = await supabaseRequest("seasons?select=id,name,created_at");
  return seasons.find((season) => canonicalize(season.name) === canonicalize(SEASON_NAME)) || null;
}

async function inspectCurrentSeason() {
  const season = await fetchSeason();
  if (!season) {
    throw new Error(`${SEASON_NAME} not found`);
  }

  const matchdays = await supabaseRequest(
    `matchdays?select=id,matchday_number&season_id=eq.${season.id}&order=matchday_number.asc`
  );
  const matchdayIds = matchdays.map((row) => row.id);
  const idFilter = `in.(${matchdayIds.join(",")})`;

  const [roster, assignments, stats, players] = await Promise.all([
    supabaseRequest(
      `season_players?select=id,player_id,tier_status,is_eligible&season_id=eq.${season.id}&limit=5000`
    ),
    supabaseRequest(
      `matchday_assignments?select=id,matchday_id,player_id,team_code&matchday_id=${idFilter}&limit=5000`
    ),
    supabaseRequest(
      `matchday_player_stats?select=id,matchday_id,player_id,attendance_status,goals,goal_keeps,clean_sheet&matchday_id=${idFilter}&limit=5000`
    ),
    supabaseRequest("players?select=id,first_name,last_name,nickname,status,desired_tier&limit=5000"),
  ]);

  const playerMap = new Map(players.map((player) => [player.id, player]));
  const rosterIds = new Set(roster.map((row) => row.player_id));
  const assignmentIds = new Set(assignments.map((row) => row.player_id));
  const statIds = new Set(stats.map((row) => row.player_id));

  return {
    season,
    matchdays,
    roster,
    assignments,
    stats,
    players,
    assignedNotRoster: Array.from(assignmentIds)
      .filter((id) => !rosterIds.has(id))
      .map((id) => ({ id, name: displayName(playerMap.get(id)) }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    statsNotRoster: Array.from(statIds)
      .filter((id) => !rosterIds.has(id))
      .map((id) => ({ id, name: displayName(playerMap.get(id)) }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    rosterWithoutActivity: roster
      .filter((row) => !assignmentIds.has(row.player_id) && !statIds.has(row.player_id))
      .map((row) => ({
        id: row.player_id,
        tier_status: row.tier_status,
        name: displayName(playerMap.get(row.player_id)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function regenerateSeed() {
  const python = spawnSync("python3", ["scripts/generate_2026_spring_seed.py", resolveWorkbookPath()], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (python.status !== 0) {
    throw new Error(python.stderr || python.stdout || "Failed to regenerate Spring seed");
  }

  return python.stdout.trim();
}

function exportWorkbookPayload() {
  const python = spawnSync("python3", [EXPORT_SCRIPT, resolveWorkbookPath()], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (python.status !== 0) {
    throw new Error(python.stderr || python.stdout || "Failed to export workbook payload");
  }

  return JSON.parse(python.stdout);
}

async function deleteByIds(table, ids) {
  if (!ids.length) {
    return;
  }
  await supabaseRequest(`${table}?id=in.(${ids.join(",")})`, { method: "DELETE" });
}

async function insertRows(table, rows, chunkSize = 250) {
  if (!rows.length) {
    return;
  }

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await supabaseRequest(table, {
      method: "POST",
      body: JSON.stringify(chunk),
    });
  }
}

function keyForPlayer(player) {
  return `${canonicalize(player.first_name)}|${canonicalize(player.last_name)}`;
}

async function restoreCurrentSeason() {
  const workbookPath = resolveWorkbookPath();

  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook not found: ${workbookPath}`);
  }

  const payload = exportWorkbookPayload();
  const season = await fetchSeason();
  if (!season) {
    throw new Error(`${SEASON_NAME} not found`);
  }

  const existingPlayers = await supabaseRequest(
    "players?select=id,first_name,last_name,nickname,nationality,positions,desired_tier,status&limit=5000"
  );
  const existingByKey = new Map(existingPlayers.map((player) => [keyForPlayer(player), player]));

  const createdPlayers = [];
  let updatedPlayers = 0;

  for (const player of payload.players) {
    const key = keyForPlayer(player);
    const existing = existingByKey.get(key);

    if (existing) {
      await supabaseRequest(`players?id=eq.${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nickname: player.nickname,
          nationality: player.nationality,
          positions: player.positions,
          desired_tier: player.desired_tier,
          status: player.status,
        }),
      });
      updatedPlayers += 1;
      continue;
    }

    const created = await supabaseRequest("players", {
      method: "POST",
      body: JSON.stringify([player]),
    });
    if (created?.[0]) {
      createdPlayers.push(created[0]);
      existingByKey.set(key, created[0]);
    }
  }

  const allPlayers = await supabaseRequest(
    "players?select=id,first_name,last_name,nickname,desired_tier,status&limit=5000"
  );
  const playerByKey = new Map(allPlayers.map((player) => [keyForPlayer(player), player]));

  const aliasLookup = new Map();
  for (const alias of payload.aliases) {
    const player = playerByKey.get(
      `${canonicalize(alias.first_name)}|${canonicalize(alias.last_name)}`
    );
    if (!player) {
      throw new Error(`Missing restored player for alias ${alias.import_label}`);
    }
    aliasLookup.set(alias.import_label, player);
  }

  await supabaseRequest(`seasons?id=eq.${season.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload.season),
  });

  let matchdays = await supabaseRequest(
    `matchdays?select=id,matchday_number&season_id=eq.${season.id}&order=matchday_number.asc`
  );
  const matchdayByNumber = new Map(matchdays.map((row) => [row.matchday_number, row]));
  const missingMatchdays = payload.matchdays.filter(
    (row) => !matchdayByNumber.has(row.matchday_number)
  );

  if (missingMatchdays.length) {
    await insertRows(
      "matchdays",
      missingMatchdays.map((row) => ({ season_id: season.id, ...row }))
    );
    matchdays = await supabaseRequest(
      `matchdays?select=id,matchday_number&season_id=eq.${season.id}&order=matchday_number.asc`
    );
  }

  for (const row of payload.matchdays) {
    const matchday = matchdays.find((item) => item.matchday_number === row.matchday_number);
    if (!matchday) {
      throw new Error(`Missing matchday ${row.matchday_number}`);
    }
    await supabaseRequest(`matchdays?id=eq.${matchday.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        kickoff_at: row.kickoff_at,
        goals_count_as_points: row.goals_count_as_points,
      }),
    });
  }

  const refreshedMatchdays = await supabaseRequest(
    `matchdays?select=id,matchday_number&season_id=eq.${season.id}&order=matchday_number.asc`
  );
  const refreshedByNumber = new Map(refreshedMatchdays.map((row) => [row.matchday_number, row]));
  const matchdayIds = refreshedMatchdays.map((row) => row.id);
  const idFilter = `in.(${matchdayIds.join(",")})`;

  const [existingMatches, existingAssignments, existingStats, existingSeasonPlayers] = await Promise.all([
    supabaseRequest(
      `matchday_matches?select=id,matchday_id&matchday_id=${idFilter}&limit=5000`
    ),
    supabaseRequest(
      `matchday_assignments?select=id,matchday_id&matchday_id=${idFilter}&limit=5000`
    ),
    supabaseRequest(
      `matchday_player_stats?select=id,matchday_id&matchday_id=${idFilter}&limit=5000`
    ),
    supabaseRequest(
      `season_players?select=id&season_id=eq.${season.id}&limit=5000`
    ),
  ]);

  await deleteByIds("matchday_matches", existingMatches.map((row) => row.id));
  await deleteByIds("matchday_assignments", existingAssignments.map((row) => row.id));
  await deleteByIds("matchday_player_stats", existingStats.map((row) => row.id));
  await deleteByIds("season_players", existingSeasonPlayers.map((row) => row.id));

  await insertRows(
    "matchday_matches",
    payload.matches.map((row) => ({
      matchday_id: refreshedByNumber.get(row.matchday_number).id,
      round_number: row.round_number,
      match_order: row.match_order,
      home_team_code: row.home_team_code,
      away_team_code: row.away_team_code,
      home_score: row.home_score,
      away_score: row.away_score,
    }))
  );

  await insertRows(
    "matchday_assignments",
    payload.assignments.map((row) => ({
      matchday_id: refreshedByNumber.get(row.matchday_number).id,
      player_id: aliasLookup.get(row.import_label).id,
      team_code: row.team_code,
    }))
  );

  await insertRows(
    "matchday_player_stats",
    payload.stats.map((row) => ({
      matchday_id: refreshedByNumber.get(row.matchday_number).id,
      player_id: aliasLookup.get(row.import_label).id,
      attended: row.attended,
      attendance_status: row.attendance_status,
      goals: row.goals,
      goal_keeps: row.goal_keeps,
      clean_sheet: row.clean_sheet,
    }))
  );

  await insertRows(
    "season_players",
    payload.season_players.map((row) => ({
      season_id: season.id,
      player_id: aliasLookup.get(row.import_label).id,
      tier_status: row.tier_status,
      tier_reason: row.tier_reason,
      movement_note: row.movement_note,
      is_eligible: row.is_eligible,
    }))
  );

  const tierSync = spawnSync("node", ["scripts/apply_player_tier_statuses.js"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (tierSync.status !== 0) {
    throw new Error(tierSync.stderr || tierSync.stdout || "Tier sync failed after restore");
  }

  return {
    seasonId: season.id,
    updatedPlayers,
    createdPlayers: createdPlayers.length,
    restoredMatchdays: payload.matchdays.length,
    restoredMatches: payload.matches.length,
    restoredAssignments: payload.assignments.length,
    restoredStats: payload.stats.length,
    restoredSeasonPlayers: payload.season_players.length,
    tierSync: tierSync.stdout ? JSON.parse(tierSync.stdout) : null,
  };
}

async function main() {
  const mode = process.argv[2] || "inspect";

  if (mode === "inspect") {
    const inspection = await inspectCurrentSeason();
    console.log(
      JSON.stringify(
        {
          seasonId: inspection.season.id,
          rosterCount: inspection.roster.length,
          assignmentRows: inspection.assignments.length,
          statRows: inspection.stats.length,
          assignedNotRosterCount: inspection.assignedNotRoster.length,
          statsNotRosterCount: inspection.statsNotRoster.length,
          rosterWithoutActivityCount: inspection.rosterWithoutActivity.length,
          assignedNotRoster: inspection.assignedNotRoster,
          statsNotRoster: inspection.statsNotRoster,
          rosterWithoutActivity: inspection.rosterWithoutActivity,
        },
        null,
        2
      )
    );
    return;
  }

  if (mode === "generate-seed") {
    const output = regenerateSeed();
    console.log(output || "Generated sql/season_2026_spring_seed.sql");
    return;
  }

  if (mode === "restore") {
    const summary = await restoreCurrentSeason();
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
