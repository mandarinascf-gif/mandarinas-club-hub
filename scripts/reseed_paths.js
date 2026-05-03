const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_ROOT = path.join(ROOT, "data");
const RESEED_CONFIG_ROOT = path.join(DATA_ROOT, "reseed_config");
const RESEED_SOURCE_ROOT = path.join(DATA_ROOT, "reseed_source");
const RESEED_REPORT_ROOT = path.join(DATA_ROOT, "reseed_reports");
const SEASON_INVENTORY_PATH = path.join(RESEED_CONFIG_ROOT, "season_inventory.csv");

function normalizeSpace(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function normalizeSeasonName(value) {
  return normalizeSpace(value).toUpperCase();
}

function relativeToRoot(targetPath) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(ROOT, resolved);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : resolved;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

function readSeasonInventory(configRoot = RESEED_CONFIG_ROOT) {
  const inventoryPath = path.join(configRoot, "season_inventory.csv");
  if (!fs.existsSync(inventoryPath)) {
    return [];
  }

  const lines = fs
    .readFileSync(inventoryPath, "utf8")
    .split(/\r?\n/)
    .filter((line, index) => index === 0 || line.trim());

  if (!lines.length) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((column, index) => [column, values[index] || ""]));
    return {
      season_name: normalizeSpace(row.season_name),
      season_folder: normalizeSpace(row.season_folder),
      workbook_file: normalizeSpace(row.workbook_file) || "workbook.xlsx",
      ready_for_import: ["1", "TRUE", "YES", "Y"].includes(normalizeSpace(row.ready_for_import).toUpperCase()),
    };
  });
}

function resolveSeasonInventoryEntry(seasonName, configRoot = RESEED_CONFIG_ROOT) {
  const normalizedTarget = normalizeSeasonName(seasonName);
  const rows = readSeasonInventory(configRoot);
  const match = rows.find((row) => normalizeSeasonName(row.season_name) === normalizedTarget);
  if (match) {
    return match;
  }

  const knownSeasons = rows.map((row) => row.season_name).join(", ") || "(none)";
  throw new Error(
    `Season ${JSON.stringify(seasonName)} was not found in ${relativeToRoot(
      path.join(configRoot, "season_inventory.csv")
    )}. Known seasons: ${knownSeasons}`
  );
}

function resolveSeasonWorkbookPath(seasonName, configRoot = RESEED_CONFIG_ROOT) {
  const entry = resolveSeasonInventoryEntry(seasonName, configRoot);
  return path.resolve(ROOT, entry.season_folder, entry.workbook_file);
}

module.exports = {
  ROOT,
  DATA_ROOT,
  RESEED_CONFIG_ROOT,
  RESEED_SOURCE_ROOT,
  RESEED_REPORT_ROOT,
  SEASON_INVENTORY_PATH,
  normalizeSpace,
  relativeToRoot,
  readSeasonInventory,
  resolveSeasonInventoryEntry,
  resolveSeasonWorkbookPath,
};
