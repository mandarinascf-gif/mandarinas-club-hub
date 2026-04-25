const { SUPABASE_URL, authHeaders } = require("./supabase_config.js");

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${body}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function isSubPlaceholder(player) {
  const values = [player.first_name || "", player.last_name || "", player.nickname || ""].map((value) =>
    String(value).trim().toLowerCase()
  );
  return values.some((value) => value.includes("(sub)")) || values.includes("sub");
}

function fullName(player) {
  return [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
}

function stripSubPrefix(value) {
  return String(value || "")
    .replace(/^\s*\(sub\)\s*/i, "")
    .trim();
}

function normalizedSubPlayer(player) {
  const cleanNickname = stripSubPrefix(player.nickname);
  const cleanFirstName = stripSubPrefix(player.first_name) || cleanNickname || "Player";
  const cleanLastName = stripSubPrefix(player.last_name);
  const genericLastName = cleanLastName.toLowerCase() === "sub" || !cleanLastName;

  return {
    first_name: cleanFirstName,
    last_name: genericLastName ? "Player" : cleanLastName,
    nickname: cleanNickname || cleanFirstName,
  };
}

function nameKey(player) {
  return [player.first_name || "", player.last_name || ""]
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
}

async function loadDirectLinks(playerId) {
  const [stats, assignments] = await Promise.all([
    supabaseRequest(`matchday_player_stats?select=id,matchday_id,player_id&player_id=eq.${Number(playerId)}&limit=5000`),
    supabaseRequest(`matchday_assignments?select=id,matchday_id,player_id&player_id=eq.${Number(playerId)}&limit=5000`),
  ]);

  return { stats, assignments };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const renameActive = process.argv.includes("--rename-active");

  const [players, seasonPlayers] = await Promise.all([
    supabaseRequest("players?select=id,first_name,last_name,nickname,status&limit=5000"),
    supabaseRequest("season_players?select=id,season_id,player_id&limit=5000"),
  ]);

  const targets = players.filter(isSubPlaceholder);
  const targetIds = new Set(targets.map((row) => Number(row.id)));
  const linkedSeasonRows = seasonPlayers.filter((row) => targetIds.has(Number(row.player_id)));
  const directLinks = new Map();
  for (const player of targets) {
    directLinks.set(Number(player.id), await loadDirectLinks(player.id));
  }
  const linkedStatCount = Array.from(directLinks.values()).reduce((sum, links) => sum + links.stats.length, 0);
  const linkedAssignmentCount = Array.from(directLinks.values()).reduce(
    (sum, links) => sum + links.assignments.length,
    0
  );
  const playersByName = new Map(players.map((player) => [nameKey(player), player]));

  const summary = {
    dryRun,
    renameActive,
    playersFound: targets.length,
    seasonPlayersLinked: linkedSeasonRows.length,
    statRowsLinked: linkedStatCount,
    assignmentRowsLinked: linkedAssignmentCount,
    targets: targets.map((row) => ({
      id: row.id,
      name: fullName(row),
      nickname: row.nickname || "",
      status: row.status || "",
      normalized: normalizedSubPlayer(row),
      cleanCollision: playersByName.get(nameKey(normalizedSubPlayer(row))) || null,
    })),
    deletedPlayerIds: [],
    renamedPlayerIds: [],
  };

  if (!dryRun) {
    const directLinked = [];
    for (const player of targets) {
      const direct = directLinks.get(Number(player.id));

      if (direct.stats.length || direct.assignments.length) {
        directLinked.push({
          id: player.id,
          name: fullName(player),
          statRowsLinked: direct.stats.length,
          assignmentRowsLinked: direct.assignments.length,
        });
      }
    }

    if (!renameActive && directLinked.length) {
      throw new Error(
        `Refusing to delete ${targets.length} sub placeholder players while linked activity remains: ` +
          `stats=${linkedStatCount}, assignments=${linkedAssignmentCount}, direct=${JSON.stringify(directLinked)}`
      );
    }

    for (const player of targets) {
      const direct = directLinks.get(Number(player.id));
      if (renameActive && (direct.stats.length || direct.assignments.length)) {
        await supabaseRequest(`players?id=eq.${player.id}`, {
          method: "PATCH",
          body: JSON.stringify(normalizedSubPlayer(player)),
        });
        summary.renamedPlayerIds.push(player.id);
        continue;
      }

      await supabaseRequest(`players?id=eq.${player.id}`, {
        method: "DELETE",
      });
      summary.deletedPlayerIds.push(player.id);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
