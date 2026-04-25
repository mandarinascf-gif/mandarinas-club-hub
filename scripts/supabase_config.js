const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SUPABASE_URL = "https://kreryiryoorlmiqqhpcj.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_aJ-TKJ-t1vr4dCit4s3-lQ_ZcYLuCO-";

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function loadRuntimeEnv() {
  return {
    ...parseDotEnvFile(path.join(ROOT, ".env")),
    ...parseDotEnvFile(path.join(ROOT, ".env.local")),
    ...process.env,
  };
}

const runtimeEnv = loadRuntimeEnv();
const SUPABASE_URL =
  normalizeValue(runtimeEnv.NEXT_PUBLIC_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  normalizeValue(runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

function authHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extraHeaders,
  };
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  authHeaders,
};
