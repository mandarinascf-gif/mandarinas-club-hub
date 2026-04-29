const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, authHeaders } = require("./supabase_config.js");
const ACTIVE_SEASON_NAME = "2026 Spring";

const ROTATION_LABELS = new Set([
  "CHAVITO",
  "COTI",
  "EFRAIN",
  "FABIAN",
  "ALEXIS",
  "LOPEZ",
  "KEVIN",
  "MIKE",
  "URIEL",
  "GUSTAVO",
]);

const CORE_LABELS = new Set([
  "ALEX",
  "ALEX MENESES",
  "ANDRES",
  "ASDRUVAL",
  "CARLOS S",
  "CEVALLOS",
  "CHATO",
  "CUNIS",
  "DAVID",
  "EDER",
  "GABO",
  "GERARDO",
  "GUS",
  "JAVIER",
  "JESUS",
  "JORDAN",
  "JOSE BLANCO",
  "JOSE SARZA",
  "MIGUEL A",
  "MIKEY",
  "NICKY",
  "NIZAMA",
  "PIRLO",
  "RAMON",
  "RODOLFO",
  "RODRIGO",
  "RUBEN",
  "RUDY",
  "SERGIO",
  "VALENCIA",
  "VALVERDE",
  "WALTER ACERO",
]);

function canonicalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function displayLabel(player) {
  const nickname = String(player.nickname || "").trim();
  if (nickname) {
    return nickname;
  }
  return [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
}

function targetTierForPlayer(player) {
  const label = canonicalize(displayLabel(player));
  if (ROTATION_LABELS.has(label)) {
    return "rotation";
  }
  if (CORE_LABELS.has(label)) {
    return "core";
  }
  return "flex_sub";
}

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

async function updatePlayers(players) {
  const updates = players.filter((player) => {
    const targetTier = targetTierForPlayer(player);
    return player.status !== targetTier || player.desired_tier !== targetTier;
  });

  const grouped = new Map();
  for (const player of updates) {
    const targetTier = targetTierForPlayer(player);
    if (!grouped.has(targetTier)) {
      grouped.set(targetTier, []);
    }
    grouped.get(targetTier).push(player);
  }

  for (const [targetTier, rows] of grouped) {
    const ids = rows.map((row) => row.id).join(",");
    await supabaseRequest(
      `players?id=in.(${ids})`,
      {
        method: "PATCH",
        body: JSON.stringify({
          desired_tier: targetTier,
          status: targetTier,
        }),
      }
    );
  }

  return updates.map((player) => ({
    id: player.id,
    label: displayLabel(player),
    next: targetTierForPlayer(player),
  }));
}

async function updateSeasonRoster(players) {
  const seasons = await supabaseRequest("seasons?select=id,name");
  const activeSeason = seasons.find(
    (season) => canonicalize(season.name) === canonicalize(ACTIVE_SEASON_NAME)
  );

  if (!activeSeason) {
    return { seasonName: null, updates: [] };
  }

  const rosterRows = await supabaseRequest(
    `season_players?select=id,player_id,tier_status&season_id=eq.${activeSeason.id}`
  );

  const playerById = new Map(players.map((player) => [player.id, player]));
  const updates = rosterRows.filter((row) => {
    const player = playerById.get(row.player_id);
    if (!player) {
      return false;
    }
    return row.tier_status !== targetTierForPlayer(player);
  });

  const grouped = new Map();
  for (const row of updates) {
    const player = playerById.get(row.player_id);
    const targetTier = targetTierForPlayer(player);
    if (!grouped.has(targetTier)) {
      grouped.set(targetTier, []);
    }
    grouped.get(targetTier).push(row);
  }

  for (const [targetTier, rows] of grouped) {
    const ids = rows.map((row) => row.id).join(",");
    await supabaseRequest(
      `season_players?id=in.(${ids})`,
      {
        method: "PATCH",
        body: JSON.stringify({
          tier_status: targetTier,
        }),
      }
    );
  }

  return {
    seasonName: activeSeason.name,
    updates: updates.map((row) => {
      const player = playerById.get(row.player_id);
      return {
        id: row.id,
        label: displayLabel(player),
        next: targetTierForPlayer(player),
      };
    }),
  };
}

async function main() {
  const players = await supabaseRequest(
    "players?select=id,first_name,last_name,nickname,status,desired_tier"
  );

  const playerUpdates = await updatePlayers(players);
  const rosterResult = await updateSeasonRoster(players);

  const summary = {
    playersUpdated: playerUpdates.length,
    rosterSeason: rosterResult.seasonName,
    rosterUpdated: rosterResult.updates.length,
    playerUpdates,
    rosterUpdates: rosterResult.updates,
  };

  console.log(JSON.stringify(summary, null, 2));
}

module.exports = {
  canonicalize,
  displayLabel,
  targetTierForPlayer,
  ROTATION_LABELS,
  CORE_LABELS,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
