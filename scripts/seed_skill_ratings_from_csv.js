const fs = require("node:fs");
const path = require("node:path");

const { SUPABASE_URL, authHeaders } = require("./supabase_config.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CSV_PATH = path.join(
  ROOT,
  "data",
  "reseed_reports",
  "player_skill_ratings_db_import.csv"
);
const DEFAULT_REPORT_PATH = path.join(
  ROOT,
  "data",
  "reseed_reports",
  "player_skill_ratings_seed_report.json"
);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSpace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parseArgs(argv) {
  const options = {
    csvPath: DEFAULT_CSV_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith("--csv=")) {
      options.csvPath = path.resolve(arg.slice("--csv=".length));
      continue;
    }
    if (arg.startsWith("--report=")) {
      options.reportPath = path.resolve(arg.slice("--report=".length));
    }
  }

  return options;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2) {
    throw new Error(`CSV is empty: ${filePath}`);
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    return {
      __rowNumber: index + 2,
      ...Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ""])),
    };
  });
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeReport(filePath, payload) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function supabaseRequest(requestPath, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${requestPath}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || "GET"} ${requestPath} failed: ${response.status} ${body}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchPlayers() {
  return supabaseRequest("players?select=id,first_name,last_name,skill_rating&limit=5000");
}

async function updatePlayerSkillRating(playerId, skillRating) {
  return supabaseRequest(`players?id=eq.${playerId}`, {
    method: "PATCH",
    body: JSON.stringify({
      skill_rating: skillRating,
    }),
  });
}

function mainNameForRow(row) {
  return normalizeSpace(row.player_name);
}

function fullName(player) {
  return normalizeSpace([player.first_name, player.last_name].filter(Boolean).join(" "));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csvRows = parseCsvFile(options.csvPath);
  const players = await fetchPlayers();
  const playersById = new Map(players.map((player) => [Number(player.id), player]));

  const updates = [];
  const unchanged = [];
  const missingPlayers = [];
  const invalidRows = [];
  const nameMismatches = [];

  for (const row of csvRows) {
    const playerId = Number(row.player_id);
    const skillRating = Number(row.skill_rating);
    const csvName = mainNameForRow(row);

    if (!Number.isInteger(playerId) || !Number.isInteger(skillRating)) {
      invalidRows.push({
        row_number: row.__rowNumber,
        row,
      });
      continue;
    }

    const player = playersById.get(playerId);
    if (!player) {
      missingPlayers.push({
        row_number: row.__rowNumber,
        player_id: playerId,
        player_name: csvName,
      });
      continue;
    }

    const databaseName = fullName(player);
    if (csvName && normalize(csvName) !== normalize(databaseName)) {
      nameMismatches.push({
        row_number: row.__rowNumber,
        player_id: playerId,
        csv_name: csvName,
        database_name: databaseName,
      });
      continue;
    }

    const currentSkillRating = Number(player.skill_rating);
    const entry = {
      player_id: playerId,
      player_name: databaseName,
      current_skill_rating: currentSkillRating,
      next_skill_rating: skillRating,
    };

    if (currentSkillRating === skillRating) {
      unchanged.push(entry);
      continue;
    }

    updates.push(entry);
  }

  if (invalidRows.length || missingPlayers.length || nameMismatches.length) {
    const error = new Error("CSV validation failed; refusing to seed skill ratings.");
    error.reportPath = options.reportPath;
    error.report = {
      generated_at: new Date().toISOString(),
      csv_path: options.csvPath,
      dry_run: options.dryRun,
      summary: {
        csv_rows: csvRows.length,
        invalid_rows: invalidRows.length,
        missing_players: missingPlayers.length,
        name_mismatches: nameMismatches.length,
        updates_needed: updates.length,
        unchanged_rows: unchanged.length,
      },
      invalid_rows: invalidRows,
      missing_players: missingPlayers,
      name_mismatches: nameMismatches,
      updates,
      unchanged,
    };
    throw error;
  }

  const report = {
    generated_at: new Date().toISOString(),
    csv_path: options.csvPath,
    dry_run: options.dryRun,
    summary: {
      csv_rows: csvRows.length,
      updates_needed: updates.length,
      unchanged_rows: unchanged.length,
    },
    updates,
    unchanged,
  };

  if (options.dryRun) {
    writeReport(options.reportPath, report);
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`report=${options.reportPath}`);
    return;
  }

  let updatedRows = 0;
  for (const update of updates) {
    await updatePlayerSkillRating(update.player_id, update.next_skill_rating);
    updatedRows += 1;
  }

  const finalReport = {
    ...report,
    summary: {
      ...report.summary,
      updated_rows: updatedRows,
    },
  };

  writeReport(options.reportPath, finalReport);
  console.log(JSON.stringify(finalReport.summary, null, 2));
  console.log(`report=${options.reportPath}`);
}

main().catch((error) => {
  if (error.report) {
    writeReport(error.reportPath || DEFAULT_REPORT_PATH, error.report);
  }
  console.error(error.message || error);
  if (error.report) {
    console.error(JSON.stringify(error.report.summary, null, 2));
    console.error(`report=${error.reportPath || DEFAULT_REPORT_PATH}`);
  }
  process.exit(1);
});
