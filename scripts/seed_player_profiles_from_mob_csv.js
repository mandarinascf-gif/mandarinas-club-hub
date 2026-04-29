const fs = require("node:fs");
const path = require("node:path");

const { SUPABASE_URL, authHeaders } = require("./supabase_config.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CSV_PATH = "/Users/andresaguayo/Downloads/Mandarinas CF Player Profile and Ratings - MOB.csv";
const DEFAULT_PROFILE_CSV_PATH =
  "/Users/andresaguayo/Downloads/Mandarinas CF Player Profile and Ratings - PLAYER_PROFILE.csv";
const DEFAULT_REPORT_PATH = path.join(
  ROOT,
  "data",
  "reseed_reports",
  "mob_player_profile_seed_report.json"
);

const MANUAL_NAME_OVERRIDES = new Map([["alex", "Alex Meneses"]]);
const ALLOWED_POSITIONS = new Set(["GK", "DEF", "MID", "ATT"]);

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
    profileCsvPath: DEFAULT_PROFILE_CSV_PATH,
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
    if (arg.startsWith("--profile-csv=")) {
      options.profileCsvPath = path.resolve(arg.slice("--profile-csv=".length));
      continue;
    }
    if (arg.startsWith("--report=")) {
      options.reportPath = path.resolve(arg.slice("--report=".length));
      continue;
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

function parseBirthDate(monthYearText) {
  const normalized = normalizeSpace(monthYearText);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Unsupported MONTHYEARBIRTH value: ${monthYearText}`);
  }

  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid birth month in MONTHYEARBIRTH: ${monthYearText}`);
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}

function fullName(player) {
  return [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
}

function addMultiValue(map, key, value) {
  if (!key) {
    return;
  }
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

function uniqueById(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
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

function buildPlayerIndexes(players) {
  const byFullName = new Map();
  const byNickname = new Map();
  const byFirstName = new Map();

  for (const player of players) {
    addMultiValue(byFullName, normalize(fullName(player)), player);
    addMultiValue(byFirstName, normalize(player.first_name), player);

    const nickname = normalizeSpace(player.nickname);
    if (!nickname) {
      continue;
    }

    addMultiValue(byNickname, normalize(nickname), player);
    for (const token of nickname.split(/[\/;]+/)) {
      addMultiValue(byNickname, normalize(token), player);
    }
  }

  return {
    byFullName,
    byNickname,
    byFirstName,
  };
}

function buildIdentityIndexes(identityRows) {
  const canonicalRows = new Map();
  const aliasToCanonical = new Map();

  for (const row of identityRows) {
    const canonicalKey = normalize(row.canonical_name);
    if (canonicalKey && !canonicalRows.has(canonicalKey)) {
      canonicalRows.set(canonicalKey, row);
    }

    const aliasValues = [row.canonical_name, row.first_name, row.nickname, ...(row.aliases || "").split(";")];
    for (const value of aliasValues) {
      const aliasKey = normalize(value);
      if (aliasKey && !aliasToCanonical.has(aliasKey)) {
        aliasToCanonical.set(aliasKey, row.canonical_name);
      }
    }
  }

  return {
    canonicalRows,
    aliasToCanonical,
  };
}

function formatCandidate(player) {
  return {
    id: player.id,
    name: fullName(player),
    nickname: player.nickname || null,
  };
}

function resolvePlayer(csvName, playerIndexes, identityIndexes) {
  const normalizedName = normalize(csvName);
  const manualTarget = MANUAL_NAME_OVERRIDES.get(normalizedName);

  const manualMatches = manualTarget
    ? uniqueById(playerIndexes.byFullName.get(normalize(manualTarget)) || [])
    : [];
  const exactFullMatches = uniqueById(playerIndexes.byFullName.get(normalizedName) || []);
  const exactNicknameMatches = uniqueById(playerIndexes.byNickname.get(normalizedName) || []);
  const exactFirstNameMatches = uniqueById(playerIndexes.byFirstName.get(normalizedName) || []);

  const canonicalName = identityIndexes.aliasToCanonical.get(normalizedName) || null;
  const canonicalKey = canonicalName ? normalize(canonicalName) : null;
  const canonicalFullMatches = canonicalKey
    ? uniqueById(playerIndexes.byFullName.get(canonicalKey) || [])
    : [];
  const canonicalRow = canonicalKey ? identityIndexes.canonicalRows.get(canonicalKey) : null;
  const canonicalNicknameMatches =
    canonicalRow && normalizeSpace(canonicalRow.nickname)
      ? uniqueById(playerIndexes.byNickname.get(normalize(canonicalRow.nickname)) || [])
      : [];

  if (manualMatches.length === 1) {
    return {
      player: manualMatches[0],
      method: "manual-override",
      canonicalName,
    };
  }

  if (exactFullMatches.length === 1) {
    return {
      player: exactFullMatches[0],
      method: "exact-full",
      canonicalName,
    };
  }

  if (exactNicknameMatches.length === 1) {
    return {
      player: exactNicknameMatches[0],
      method: "exact-nickname",
      canonicalName,
    };
  }

  if (canonicalFullMatches.length === 1) {
    return {
      player: canonicalFullMatches[0],
      method: "identity-full",
      canonicalName,
    };
  }

  if (canonicalNicknameMatches.length === 1) {
    return {
      player: canonicalNicknameMatches[0],
      method: "identity-nickname",
      canonicalName,
    };
  }

  if (exactFirstNameMatches.length === 1) {
    return {
      player: exactFirstNameMatches[0],
      method: "unique-first",
      canonicalName,
    };
  }

  return {
    player: null,
    method: null,
    canonicalName,
    candidates: {
      manualMatches: manualMatches.map(formatCandidate),
      exactFullMatches: exactFullMatches.map(formatCandidate),
      exactNicknameMatches: exactNicknameMatches.map(formatCandidate),
      canonicalFullMatches: canonicalFullMatches.map(formatCandidate),
      canonicalNicknameMatches: canonicalNicknameMatches.map(formatCandidate),
      exactFirstNameMatches: exactFirstNameMatches.map(formatCandidate),
    },
  };
}

function buildUpdatePayload(player, csvRow) {
  const csvNationality = normalizeSpace(csvRow.Nationality);
  const csvBirthDate = parseBirthDate(csvRow.MONTHYEARBIRTH);
  const changes = {};

  if (csvNationality && csvNationality !== player.nationality) {
    changes.nationality = {
      from: player.nationality,
      to: csvNationality,
    };
  }

  if (csvBirthDate && csvBirthDate !== player.birth_date) {
    changes.birth_date = {
      from: player.birth_date,
      to: csvBirthDate,
    };
  }

  return changes;
}

function isTruthyMarker(value) {
  const normalized = normalizeSpace(value).toLowerCase();
  return ["1", "y", "yes", "true", "x"].includes(normalized);
}

function derivePositions(profileRow) {
  const rankedPositions = ["1st Position", "2nd Position", "3rd Position"]
    .map((column) => normalizeSpace(profileRow[column]).toUpperCase())
    .filter((value) => ALLOWED_POSITIONS.has(value));

  const fallbackPositions = [...ALLOWED_POSITIONS].filter((position) => isTruthyMarker(profileRow[position]));
  const sourcePositions = rankedPositions.length ? rankedPositions : fallbackPositions;
  const uniquePositions = [];
  const seen = new Set();

  for (const position of sourcePositions) {
    if (!seen.has(position)) {
      seen.add(position);
      uniquePositions.push(position);
    }
  }

  return uniquePositions;
}

function positionsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildProfileUpdatePayload(player, profileRow) {
  const positions = derivePositions(profileRow);
  if (!positions.length || positionsEqual(player.positions, positions)) {
    return {};
  }

  return {
    positions: {
      from: Array.isArray(player.positions) ? player.positions : [],
      to: positions,
    },
  };
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeReport(filePath, payload) {
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function updatePlayer(playerId, payload) {
  return supabaseRequest(`players?id=eq.${playerId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csvRows = parseCsvFile(options.csvPath);
  const profileRows = fs.existsSync(options.profileCsvPath) ? parseCsvFile(options.profileCsvPath) : [];
  const [players, identityRows] = await Promise.all([
    supabaseRequest(
      "players?select=id,first_name,last_name,nickname,nationality,birth_date,phone,positions,skill_rating,desired_tier,status,dominant_foot,notes&limit=5000"
    ),
    Promise.resolve(parseCsvFile(path.join(ROOT, "data", "reseed_config", "identity_map.csv"))),
  ]);

  const playerIndexes = buildPlayerIndexes(players);
  const identityIndexes = buildIdentityIndexes(identityRows);

  const targetRows = new Map();
  const unresolvedMobRows = [];
  const unresolvedProfileRows = [];

  function upsertTargetRow(player, csvName, matchMethod, rowNumber) {
    if (!targetRows.has(player.id)) {
      targetRows.set(player.id, {
        matched_player_id: player.id,
        matched_player_name: fullName(player),
        matched_player_nickname: player.nickname || null,
        match_sources: [],
        current_values: {
          nationality: player.nationality,
          birth_date: player.birth_date,
          positions: Array.isArray(player.positions) ? player.positions : [],
        },
        changes: {},
      });
    }

    const entry = targetRows.get(player.id);
    entry.match_sources.push({
      csv_name: csvName,
      row_number: rowNumber,
      match_method: matchMethod,
    });
    return entry;
  }

  for (const csvRow of csvRows) {
    const csvName = normalizeSpace(csvRow["Player Name"]);
    const resolution = resolvePlayer(csvName, playerIndexes, identityIndexes);

    if (!resolution.player) {
      unresolvedMobRows.push({
        csv_name: csvName,
        row_number: csvRow.__rowNumber,
        canonical_name: resolution.canonicalName,
        candidates: resolution.candidates,
      });
      continue;
    }

    const entry = upsertTargetRow(resolution.player, csvName, resolution.method, csvRow.__rowNumber);
    const changes = buildUpdatePayload(resolution.player, csvRow);
    entry.source_values = {
      ...(entry.source_values || {}),
      nationality: normalizeSpace(csvRow.Nationality) || null,
      birth_date: parseBirthDate(csvRow.MONTHYEARBIRTH),
    };
    Object.assign(entry.changes, changes);
  }

  for (const profileRow of profileRows) {
    const csvName = normalizeSpace(profileRow["Player Name"]);
    const resolution = resolvePlayer(csvName, playerIndexes, identityIndexes);

    if (!resolution.player) {
      unresolvedProfileRows.push({
        csv_name: csvName,
        row_number: profileRow.__rowNumber,
        canonical_name: resolution.canonicalName,
        candidates: resolution.candidates,
      });
      continue;
    }

    const entry = upsertTargetRow(resolution.player, csvName, resolution.method, profileRow.__rowNumber);
    const changes = buildProfileUpdatePayload(resolution.player, profileRow);
    entry.source_values = {
      ...(entry.source_values || {}),
      positions: derivePositions(profileRow),
    };
    Object.assign(entry.changes, changes);
  }

  if (unresolvedMobRows.length) {
    const error = new Error(`Could not resolve ${unresolvedMobRows.length} MOB CSV rows to exactly one player.`);
    error.unresolved = unresolvedMobRows;
    throw error;
  }

  const matchedRows = [...targetRows.values()].sort((left, right) => left.matched_player_id - right.matched_player_id);
  const updates = matchedRows.filter((row) => Object.keys(row.changes).length > 0);
  const noOpRows = matchedRows.filter((row) => Object.keys(row.changes).length === 0);

  const report = {
    generated_at: new Date().toISOString(),
    csv_path: options.csvPath,
    profile_csv_path: profileRows.length ? options.profileCsvPath : null,
    dry_run: options.dryRun,
    summary: {
      csv_rows: csvRows.length,
      profile_csv_rows: profileRows.length,
      matched_player_rows: matchedRows.length,
      updates_needed: updates.length,
      no_op_rows: noOpRows.length,
      unresolved_profile_rows: unresolvedProfileRows.length,
    },
    unresolved_profile_rows: unresolvedProfileRows,
    matched_rows: matchedRows,
  };

  if (options.dryRun) {
    writeReport(options.reportPath, report);
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`report=${options.reportPath}`);
    return;
  }

  let updatedCount = 0;
  for (const row of updates) {
    const payload = {};
    for (const [field, change] of Object.entries(row.changes)) {
      payload[field] = change.to;
    }
    await updatePlayer(row.matched_player_id, payload);
    updatedCount += 1;
  }

  const finalReport = {
    ...report,
    summary: {
      ...report.summary,
      updated_rows: updatedCount,
    },
  };

  writeReport(options.reportPath, finalReport);
  console.log(JSON.stringify(finalReport.summary, null, 2));
  console.log(`report=${options.reportPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  if (error.unresolved) {
    console.error(JSON.stringify(error.unresolved, null, 2));
  }
  process.exit(1);
});
