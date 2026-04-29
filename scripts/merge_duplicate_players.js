const { SUPABASE_URL, authHeaders } = require("./supabase_config.js");
const PROTECTED_SEASON_NAME = "2026 Spring";
const fs = require("node:fs");
const path = require("node:path");

const {
  displayLabel,
  targetTierForPlayer,
} = require("./apply_player_tier_statuses.js");

const DEFAULT_MERGE_MAP = {
  58: 10,
  60: 68,
  66: 68,
  76: 12,
  79: 54,
  81: 44,
  82: 45,
  83: 35,
  84: 14,
  86: 31,
  87: 4,
  88: 25,
  89: 21,
  90: 13,
  91: 13,
  92: 40,
  93: 18,
  94: 20,
  96: 47,
  97: 50,
  99: 43,
  100: 19,
  101: 30,
  102: 68,
  103: 27,
  104: 73,
  105: 11,
  106: 3,
  107: 38,
  109: 2,
};

const TIER_PRIORITY = {
  core: 3,
  rotation: 2,
  flex_sub: 1,
};

const ATTENDANCE_PRIORITY = {
  attended: 6,
  in: 5,
  no_show: 4,
  late_cancel: 3,
  available: 2,
  out: 1,
};

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

function parseArgs(argv) {
  const options = {
    dryRun: false,
    includeCurrentSeason: false,
    reviewCsvPath: null,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--include-current-season") {
      options.includeCurrentSeason = true;
      continue;
    }
    if (arg.startsWith("--review-csv=")) {
      options.reviewCsvPath = arg.slice("--review-csv=".length);
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

function loadMergeMapFromReviewCsv(reviewCsvPath) {
  const resolvedPath = path.resolve(reviewCsvPath);
  const raw = fs.readFileSync(resolvedPath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2) {
    throw new Error(`Review CSV is empty: ${resolvedPath}`);
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });

  const mergeMap = {};
  const approvedRows = rows.filter((row) => {
    const action = String(row.approved_action || "").trim().toLowerCase();
    const reviewStatus = String(row.review_status || "").trim().toLowerCase();
    const isApproved =
      !reviewStatus || ["approved", "yes", "y", "ok", "merge"].includes(reviewStatus);
    return action === "merge" && isApproved;
  });

  for (const row of approvedRows) {
    const sourceId = Number(row.duplicate_id);
    const targetId = Number(row.suggested_keeper_id);
    if (!Number.isInteger(sourceId) || !Number.isInteger(targetId)) {
      throw new Error(`Invalid keeper/source ids in review CSV row: ${JSON.stringify(row)}`);
    }
    if (sourceId === targetId) {
      continue;
    }
    mergeMap[sourceId] = targetId;
  }

  return {
    resolvedPath,
    mergeMap,
    approvedRows,
    totalRows: rows.length,
  };
}

function uniqueLines(...values) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => String(value || "").split("\n"))
        .map((part) => part.trim())
        .filter(Boolean)
    )
  ).join("\n");
}

function mergeTierStatus(left, right) {
  const leftPriority = TIER_PRIORITY[left || "flex_sub"] || 0;
  const rightPriority = TIER_PRIORITY[right || "flex_sub"] || 0;
  return rightPriority > leftPriority ? right : left;
}

function mergeAttendanceStatus(left, right) {
  const leftPriority = ATTENDANCE_PRIORITY[left || "out"] || 0;
  const rightPriority = ATTENDANCE_PRIORITY[right || "out"] || 0;
  return rightPriority > leftPriority ? right : left;
}

function normalizeTier(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function bestKnownTier(player) {
  return [player?.desired_tier, player?.status, targetTierForPlayer(player)].reduce(
    (best, candidate) => {
      const normalized = normalizeTier(candidate);
      if ((TIER_PRIORITY[normalized] || 0) > (TIER_PRIORITY[best] || 0)) {
        return normalized;
      }
      return best;
    },
    "flex_sub"
  );
}

function mergePlayerRecord(target, source, nextTier) {
  return {
    first_name: target.first_name || source.first_name,
    last_name: target.last_name || source.last_name,
    nickname: target.nickname || source.nickname || null,
    nationality: target.nationality || source.nationality || "Unknown",
    birth_date: target.birth_date || source.birth_date || null,
    phone: target.phone || source.phone || null,
    positions:
      Array.isArray(target.positions) && target.positions.length
        ? target.positions
        : Array.isArray(source.positions)
          ? source.positions
          : ["GK"],
    skill_rating: Math.max(Number(target.skill_rating || 0), Number(source.skill_rating || 0)),
    desired_tier: nextTier,
    status: nextTier,
    dominant_foot: target.dominant_foot || source.dominant_foot || "right",
    notes: uniqueLines(target.notes, source.notes),
  };
}

function mergeSeasonPlayerRecord(target, source) {
  return {
    tier_status: mergeTierStatus(target.tier_status, source.tier_status),
    is_eligible: Boolean(target.is_eligible) || Boolean(source.is_eligible),
    tier_reason: uniqueLines(target.tier_reason, source.tier_reason),
    movement_note: uniqueLines(target.movement_note, source.movement_note),
  };
}

function mergeMatchdayStatRecord(target, source) {
  return {
    attended: Boolean(target.attended) || Boolean(source.attended),
    attendance_status: mergeAttendanceStatus(target.attendance_status, source.attendance_status),
    goals: Number(target.goals || 0) + Number(source.goals || 0),
    goal_keeps: Number(target.goal_keeps || 0) + Number(source.goal_keeps || 0),
    clean_sheet: Boolean(target.clean_sheet) || Boolean(source.clean_sheet),
  };
}

function mergeAssignmentRecord(target, source) {
  return {
    team_code: target.team_code || source.team_code,
  };
}

function toId(value) {
  return Number(value);
}

function mapByPlayer(rows) {
  const map = new Map();
  for (const row of rows) {
    const playerId = toId(row.player_id);
    if (!map.has(playerId)) {
      map.set(playerId, []);
    }
    map.get(playerId).push(row);
  }
  return map;
}

async function loadLinkedRowsForPlayer(playerId) {
  const id = toId(playerId);
  const [seasonRows, statRows, assignmentRows] = await Promise.all([
    supabaseRequest(
      `season_players?select=id,season_id,player_id,tier_status,registration_tier,payment_status,tier_reason,movement_note,is_eligible&player_id=eq.${id}&limit=5000`
    ),
    supabaseRequest(
      `matchday_player_stats?select=id,matchday_id,player_id,attended,attendance_status,goals,goal_keeps,clean_sheet&player_id=eq.${id}&limit=5000`
    ),
    supabaseRequest(
      `matchday_assignments?select=id,matchday_id,player_id,team_code&player_id=eq.${id}&limit=5000`
    ),
  ]);

  return {
    seasonRows,
    statRows,
    assignmentRows,
  };
}

async function loadState() {
  const [players, seasons, matchdays, seasonPlayers, matchdayStats, assignments] = await Promise.all([
    supabaseRequest(
      "players?select=id,first_name,last_name,nickname,nationality,birth_date,phone,positions,skill_rating,desired_tier,status,dominant_foot,notes,created_at,updated_at&limit=5000"
    ),
    supabaseRequest(
      "seasons?select=id,name&limit=5000"
    ),
    supabaseRequest(
      "matchdays?select=id,season_id,matchday_number&limit=5000"
    ),
    supabaseRequest(
      "season_players?select=id,season_id,player_id,tier_status,registration_tier,payment_status,tier_reason,movement_note,is_eligible&limit=5000"
    ),
    supabaseRequest(
      "matchday_player_stats?select=id,matchday_id,player_id,attended,attendance_status,goals,goal_keeps,clean_sheet&limit=5000"
    ),
    supabaseRequest(
      "matchday_assignments?select=id,matchday_id,player_id,team_code&limit=5000"
    ),
  ]);

  return {
    players,
    seasons,
    matchdays,
    seasonPlayers,
    matchdayStats,
    assignments,
  };
}

function validateMergeTargets(playersById, mergeMap) {
  const missingSources = [];
  const missingTargets = [];
  for (const [sourceRaw, targetRaw] of Object.entries(mergeMap)) {
    const source = Number(sourceRaw);
    const target = Number(targetRaw);
    if (!playersById.has(source)) {
      missingSources.push(source);
    }
    if (!playersById.has(target)) {
      missingTargets.push(target);
    }
  }

  if (missingTargets.length) {
    throw new Error(
      `Merge map is out of sync: ${missingTargets.map((target) => `missing target ${target}`).join(", ")}`
    );
  }

  return { missingSources, missingTargets };
}

async function ensureTargetSeasonRows(targetId, sourceSeasonRows, targetSeasonRows, dryRun) {
  const originalSeasonIds = new Set(targetSeasonRows.map((row) => toId(row.season_id)));

  for (const sourceRow of sourceSeasonRows) {
    const seasonId = toId(sourceRow.season_id);
    if (originalSeasonIds.has(seasonId)) {
      continue;
    }

    const payload = {
      season_id: seasonId,
      player_id: targetId,
      tier_status: sourceRow.tier_status,
      registration_tier: sourceRow.registration_tier,
      payment_status: sourceRow.payment_status,
      tier_reason: sourceRow.tier_reason,
      movement_note: sourceRow.movement_note,
      is_eligible: sourceRow.is_eligible,
    };

    let createdRow = { ...sourceRow, ...payload, id: -Math.abs(toId(sourceRow.id)) };
    if (!dryRun) {
      const created = await supabaseRequest("season_players", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      createdRow = Array.isArray(created) ? created[0] : created;
    }

    targetSeasonRows.push(createdRow);
    originalSeasonIds.add(seasonId);
  }
}

async function mergeGroup(targetId, sourceIds, state, dryRun, summary) {
  const playersById = new Map(state.players.map((row) => [toId(row.id), row]));

  let targetPlayer = playersById.get(targetId);
  if (!targetPlayer) {
    throw new Error(`Target player ${targetId} not found`);
  }

  const groupPlayers = [targetPlayer, ...sourceIds.map((id) => playersById.get(id))];
  const groupTier = groupPlayers
    .map((player) => bestKnownTier(player))
    .sort((left, right) => (TIER_PRIORITY[right] || 0) - (TIER_PRIORITY[left] || 0))[0];

  for (const sourceId of sourceIds) {
    const sourcePlayer = playersById.get(sourceId);
    if (!sourcePlayer) {
      continue;
    }

    const mergedPlayer = mergePlayerRecord(targetPlayer, sourcePlayer, groupTier);
    if (!dryRun) {
      await supabaseRequest(`players?id=eq.${targetId}`, {
        method: "PATCH",
        body: JSON.stringify(mergedPlayer),
      });
    }
    targetPlayer = { ...targetPlayer, ...mergedPlayer, id: targetId };
    playersById.set(targetId, targetPlayer);

    const [
      { seasonRows: targetSeasonRows, statRows: targetStatRows, assignmentRows: targetAssignments },
      { seasonRows: sourceSeasonRows, statRows: sourceStatRows, assignmentRows: sourceAssignments },
    ] = await Promise.all([
      loadLinkedRowsForPlayer(targetId),
      loadLinkedRowsForPlayer(sourceId),
    ]);

    const originalTargetSeasonIds = new Set(targetSeasonRows.map((row) => toId(row.season_id)));
    await ensureTargetSeasonRows(targetId, sourceSeasonRows, targetSeasonRows, dryRun);

    for (const sourceRow of sourceStatRows) {
      const targetRow = targetStatRows.find(
        (row) => toId(row.matchday_id) === toId(sourceRow.matchday_id)
      );
      if (targetRow) {
        const mergedStat = mergeMatchdayStatRecord(targetRow, sourceRow);
        if (!dryRun) {
          await supabaseRequest(`matchday_player_stats?id=eq.${targetRow.id}`, {
            method: "PATCH",
            body: JSON.stringify(mergedStat),
          });
          await supabaseRequest(`matchday_player_stats?id=eq.${sourceRow.id}`, {
            method: "DELETE",
          });
        }
        summary.matchdayStatCollisions += 1;
        Object.assign(targetRow, mergedStat);
      } else if (!dryRun) {
        await supabaseRequest(`matchday_player_stats?id=eq.${sourceRow.id}`, {
          method: "PATCH",
          body: JSON.stringify({ player_id: targetId }),
        });
      }
      if (!targetRow) {
        const movedRow = { ...sourceRow, player_id: targetId };
        targetStatRows.push(movedRow);
      }
      summary.matchdayStatsMoved += 1;
    }
    for (const sourceRow of sourceAssignments) {
      const targetRow = targetAssignments.find(
        (row) => toId(row.matchday_id) === toId(sourceRow.matchday_id)
      );
      if (targetRow) {
        const mergedAssignment = mergeAssignmentRecord(targetRow, sourceRow);
        if (!dryRun) {
          await supabaseRequest(`matchday_assignments?id=eq.${targetRow.id}`, {
            method: "PATCH",
            body: JSON.stringify(mergedAssignment),
          });
          await supabaseRequest(`matchday_assignments?id=eq.${sourceRow.id}`, {
            method: "DELETE",
          });
        }
        summary.assignmentCollisions += 1;
        Object.assign(targetRow, mergedAssignment);
      } else if (!dryRun) {
        await supabaseRequest(`matchday_assignments?id=eq.${sourceRow.id}`, {
          method: "PATCH",
          body: JSON.stringify({ player_id: targetId }),
        });
      }
      if (!targetRow) {
        const movedRow = { ...sourceRow, player_id: targetId };
        targetAssignments.push(movedRow);
      }
      summary.assignmentsMoved += 1;
    }
    for (const sourceRow of sourceSeasonRows) {
      const seasonId = toId(sourceRow.season_id);
      const targetRow = targetSeasonRows.find(
        (row) => toId(row.season_id) === seasonId && toId(row.id) !== toId(sourceRow.id)
      );

      if (originalTargetSeasonIds.has(seasonId) && targetRow) {
        const mergedSeason = mergeSeasonPlayerRecord(targetRow, sourceRow);
        if (!dryRun) {
          await supabaseRequest(`season_players?id=eq.${targetRow.id}`, {
            method: "PATCH",
            body: JSON.stringify(mergedSeason),
          });
        }
        summary.seasonPlayerCollisions += 1;
        Object.assign(targetRow, mergedSeason);
      }

      if (!dryRun) {
        await supabaseRequest(`season_players?id=eq.${sourceRow.id}`, {
          method: "DELETE",
        });
      }
      summary.seasonPlayersMoved += 1;
    }

    if (!dryRun) {
      const remaining = await loadLinkedRowsForPlayer(sourceId);
      if (
        remaining.seasonRows.length ||
        remaining.statRows.length ||
        remaining.assignmentRows.length
      ) {
        throw new Error(
          `Refusing to delete player ${sourceId} while linked rows remain: ` +
            `season=${remaining.seasonRows.length}, stats=${remaining.statRows.length}, assignments=${remaining.assignmentRows.length}`
        );
      }
      await supabaseRequest(`players?id=eq.${sourceId}`, {
        method: "DELETE",
      });
    }

    playersById.delete(sourceId);
    summary.playersDeleted += 1;
    summary.mergedPairs.push({
      sourceId,
      sourceLabel: displayLabel(sourcePlayer),
      targetId,
      targetLabel: displayLabel(targetPlayer),
      finalTier: groupTier,
    });
  }
}

function protectedSeasonInfo(state) {
  const protectedSeason = state.seasons.find(
    (season) => String(season.name || "").trim().toLowerCase() === PROTECTED_SEASON_NAME.toLowerCase()
  );

  if (!protectedSeason) {
    return {
      protectedSeasonId: null,
      protectedMatchdayIds: new Set(),
    };
  }

  return {
    protectedSeasonId: toId(protectedSeason.id),
    protectedMatchdayIds: new Set(
      state.matchdays
        .filter((matchday) => toId(matchday.season_id) === toId(protectedSeason.id))
        .map((matchday) => toId(matchday.id))
    ),
  };
}

function groupTouchesProtectedSeason(targetId, sourceIds, state, protectedSeasonId, protectedMatchdayIds) {
  if (!protectedSeasonId) {
    return false;
  }

  const ids = new Set([targetId, ...sourceIds].map((value) => toId(value)));

  const hasProtectedSeasonRoster = state.seasonPlayers.some(
    (row) => ids.has(toId(row.player_id)) && toId(row.season_id) === toId(protectedSeasonId)
  );
  if (hasProtectedSeasonRoster) {
    return true;
  }

  const hasProtectedStats = state.matchdayStats.some(
    (row) => ids.has(toId(row.player_id)) && protectedMatchdayIds.has(toId(row.matchday_id))
  );
  if (hasProtectedStats) {
    return true;
  }

  return state.assignments.some(
    (row) => ids.has(toId(row.player_id)) && protectedMatchdayIds.has(toId(row.matchday_id))
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dryRun = options.dryRun;
  const includeCurrentSeason = options.includeCurrentSeason;
  const reviewCsvInfo = options.reviewCsvPath ? loadMergeMapFromReviewCsv(options.reviewCsvPath) : null;
  const mergeMap = reviewCsvInfo?.mergeMap || DEFAULT_MERGE_MAP;
  const state = await loadState();
  const playersById = new Map(state.players.map((row) => [toId(row.id), row]));
  const validation = validateMergeTargets(playersById, mergeMap);
  const { protectedSeasonId, protectedMatchdayIds } = protectedSeasonInfo(state);

  const groups = new Map();
  for (const [sourceRaw, targetRaw] of Object.entries(mergeMap)) {
    const sourceId = Number(sourceRaw);
    const targetId = Number(targetRaw);
    if (!groups.has(targetId)) {
      groups.set(targetId, []);
    }
    groups.get(targetId).push(sourceId);
  }

  const summary = {
    dryRun,
    includeCurrentSeason,
    reviewCsvPath: reviewCsvInfo?.resolvedPath || null,
    reviewCsvRows: reviewCsvInfo?.totalRows || null,
    approvedReviewRows: reviewCsvInfo?.approvedRows.length || null,
    groups: groups.size,
    playersDeleted: 0,
    seasonPlayersMoved: 0,
    seasonPlayerCollisions: 0,
    matchdayStatsMoved: 0,
    matchdayStatCollisions: 0,
    assignmentsMoved: 0,
    assignmentCollisions: 0,
    skippedMissingSources: validation.missingSources,
    skippedProtectedGroups: [],
    mergedPairs: [],
  };

  for (const [targetId, sourceIds] of groups.entries()) {
    const existingSourceIds = sourceIds.filter((id) => playersById.has(id));
    if (!existingSourceIds.length) {
      continue;
    }
    if (
      !includeCurrentSeason &&
      groupTouchesProtectedSeason(targetId, existingSourceIds, state, protectedSeasonId, protectedMatchdayIds)
    ) {
      summary.skippedProtectedGroups.push({
        targetId,
        targetLabel: displayLabel(playersById.get(targetId)),
        sourceIds: existingSourceIds,
        sourceLabels: existingSourceIds
          .map((id) => displayLabel(playersById.get(id)))
          .filter(Boolean),
      });
      continue;
    }
    await mergeGroup(targetId, existingSourceIds, state, dryRun, summary);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
