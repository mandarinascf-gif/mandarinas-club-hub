const supabaseConfig = window.MandarinasSupabaseConfig;
const supabaseClient = supabaseConfig.createClient();

const params = new URLSearchParams(window.location.search);
const playerId = Number(params.get("player_id"));

const heroCopy = document.getElementById("hero-copy");
const playerIdStat = document.getElementById("player-id-stat");
const playerRatingStat = document.getElementById("player-rating-stat");
const emptyState = document.getElementById("empty-state");
const playerShell = document.getElementById("player-shell");
const playerViewBody = document.getElementById("player-view-body");
const playerEditPanel = document.getElementById("player-edit-panel");
const form = document.getElementById("player-form");
const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const nicknameInput = document.getElementById("nickname");
const phoneInput = document.getElementById("phone");
const nationalityInput = document.getElementById("nationality");
const birthDateInput = document.getElementById("birth-date");
const statusInput = document.getElementById("status-select");
const roleGrid = document.getElementById("role-grid");
const roleNote = document.getElementById("role-note");
const dominantFootInput = document.getElementById("dominant-foot");
const skillRatingInput = document.getElementById("skill-rating");
const ratingValue = document.getElementById("rating-value");
const notesInput = document.getElementById("notes");
const editButton = document.getElementById("edit-button");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const deleteButton = document.getElementById("delete-button");
const statusLine = document.getElementById("status-line");
const historyPanel = document.getElementById("history-panel");
const historySummary = document.getElementById("history-summary");
const historyStatus = document.getElementById("history-status");
const historyShell = document.getElementById("history-shell");

let selectedRoles = [];
let player = null;
let historyRows = [];
let isEditing = false;

if (!window.MandarinasLogic) {
  console.error("[Mandarinas] Fatal: MandarinasLogic is undefined");
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<p id="mcf-fatal-error" role="alert">Core app logic failed to load. Check the browser console for errors.</p>'
  );
  throw new Error("MandarinasLogic is undefined");
}

const {
  normalizeTeamDisplayConfig,
  teamDisplayLabel,
  normalizePlayerDesiredTier,
  nationalityFlag,
} = window.MandarinasLogic;

function hasMissingDesiredTierColumn(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("column") || message.includes("schema cache")) &&
    message.includes("desired_tier")
  );
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function setStatus(message, tone = "") {
  statusLine.textContent = message;
  statusLine.className = tone ? `status-line ${tone}` : "status-line";
}

function syncRoleUi() {
  Array.from(roleGrid.querySelectorAll("[data-role]")).forEach((button) => {
    button.classList.toggle("active", selectedRoles.includes(button.dataset.role));
  });

  roleNote.textContent = `Selected roles: ${selectedRoles.join(", ")}`;
}

function readableError(error) {
  const message = error?.message || "Unknown error";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("relation") && lowerMessage.includes("players")) {
    return "Player Card cannot open until live club data is ready.";
  }

  if (lowerMessage.includes("column") || lowerMessage.includes("schema cache")) {
    return "Player Card is waiting for the latest live club update.";
  }

  if (error?.code === "23505") {
    return "Another player already uses that same first and last name.";
  }

  return message;
}

function showEmptyState(message) {
  emptyState.textContent = message;
  emptyState.hidden = false;
  playerShell.hidden = true;
  editButton.hidden = true;
}

function showShell() {
  emptyState.hidden = true;
  playerShell.hidden = false;
  historyPanel.hidden = false;
  editButton.hidden = false;
}

function formatTier(value) {
  if (value === "flex_sub") {
    return "Flex/Sub";
  }

  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Rotation";
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBirthYear(value) {
  if (!value) {
    return "Not set";
  }

  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) {
    return "Not set";
  }

  return String(birthDate.getFullYear());
}

function formatFoot(value) {
  if (!value) {
    return "Right";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function playerFullName(playerRow) {
  return normalizeText(`${playerRow?.first_name || ""} ${playerRow?.last_name || ""}`) || "Player";
}

function playerHeadlineName(playerRow) {
  return normalizeText(playerRow?.nickname) || playerFullName(playerRow);
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

function badgeHeaderMarkup(playerRow) {
  const badgeKey = `player-badge-${Number(playerRow?.id) || "player"}`;
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

function buildHistoryBadgeStats() {
  return (Array.isArray(historyRows) ? historyRows : []).reduce(
    (totals, row) => ({
      attendance: totals.attendance + (row.attendanceLabel === "IN" ? 1 : 0),
      goals: totals.goals + Number(row.goals || 0),
      goalKeeps: totals.goalKeeps + Number(row.goalKeeps || 0),
    }),
    {
      attendance: 0,
      goals: 0,
      goalKeeps: 0,
    }
  );
}

function populateForm(playerRow) {
  player = normalizePlayerDesiredTier(playerRow, "rotation");
  firstNameInput.value = player.first_name || "";
  lastNameInput.value = player.last_name || "";
  nicknameInput.value = player.nickname || "";
  phoneInput.value = player.phone || "";
  nationalityInput.value = player.nationality || "";
  birthDateInput.value = player.birth_date || "";
  statusInput.value = player.status || "rotation";
  dominantFootInput.value = player.dominant_foot || "right";
  skillRatingInput.value = String(player.skill_rating || 78);
  ratingValue.textContent = String(player.skill_rating || 78);
  notesInput.value = player.notes || "";
  selectedRoles =
    Array.isArray(player.positions) && player.positions.length ? [...player.positions] : ["MID"];
  syncRoleUi();

  playerIdStat.textContent = String(player.id);
  playerRatingStat.textContent = String(player.skill_rating || 78);
  heroCopy.textContent = `${player.first_name} ${player.last_name}${player.nickname ? ` · ${player.nickname}` : ""}`;
}

function renderDetail() {
  if (!player) {
    playerViewBody.innerHTML = "";
    return;
  }

  const positions = Array.isArray(player.positions) && player.positions.length
    ? player.positions
    : [];
  const fullName = playerFullName(player);
  const headlineName = playerHeadlineName(player);
  const tierLabel = formatTier(player.status);
  const footLabel = formatFoot(player.dominant_foot);
  const birthYearLabel = formatBirthYear(player.birth_date);
  const nationality = player.nationality || "";
  const scoutNote = player.notes || "No scout note saved yet.";
  const flag = nationalityFlag(player.nationality || "");
  const badgeStats = buildHistoryBadgeStats();
  const badgePlayer = {
    name: headlineName || "Player",
    nationality,
    flag,
    birth_date: player.birth_date,
    overall_rating: Number.isFinite(Number(player.skill_rating)) ? Number(player.skill_rating) : 0,
    rank: "--",
    ppg: 0,
    primary_position: positions[0] || normalizeText(player.primary_position || "", "N/A"),
    position_label: positions.length
      ? positions
          .slice(0, 3)
          .map((value) => normalizeText(value).toUpperCase())
          .filter(Boolean)
          .join(" · ")
      : "N/A",
    positions,
  };
  const badgeTotals = {
    points: 0,
    apps: badgeStats.attendance,
    goals: badgeStats.goals,
  };
  const badgeMarkup = window.renderPlayerBadge
    ? window.renderPlayerBadge(badgePlayer, badgeTotals).outerHTML
    : "";

  playerViewBody.innerHTML = `
    <div class="player-badge-showcase">
      <div class="roster-player-badge player-roster-player-badge">
        ${badgeMarkup}
      </div>

      <div class="detail-card player-badge-support">
        <div class="section-label">Profile Breakdown</div>
        <dl class="player-badge-fact-list">
          <div>
            <dt>Full name</dt>
            <dd>${escapeHtml(fullName)}</dd>
          </div>
          <div>
            <dt>Nickname</dt>
            <dd>${escapeHtml(player.nickname || "Not set")}</dd>
          </div>
          <div>
            <dt>Nationality</dt>
            <dd>${escapeHtml(nationality)}</dd>
          </div>
          <div>
            <dt>Birth year</dt>
            <dd>${escapeHtml(birthYearLabel)}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>${escapeHtml(player.phone || "Not set")}</dd>
          </div>
          <div>
            <dt>Current / next-season tier</dt>
            <dd>${escapeHtml(tierLabel)}</dd>
          </div>
          <div>
            <dt>Dominant foot</dt>
            <dd>${escapeHtml(footLabel)}</dd>
          </div>
          <div>
            <dt>Positions</dt>
            <dd>${escapeHtml(positions.join(", "))}</dd>
          </div>
        </dl>
        <div class="player-crest-note">
          <span class="player-crest-note-label">Scout Note</span>
          <p>${escapeHtml(scoutNote)}</p>
        </div>
      </div>
    </div>
  `;
}

function setEditMode(nextEditing) {
  isEditing = Boolean(nextEditing);
  playerEditPanel.hidden = !isEditing;
  editButton.hidden = isEditing || !player;

  if (isEditing) {
    firstNameInput.focus();
  }
}

function formatAttendanceLabel(value, attended) {
  const normalized =
    value && value !== "out" ? (value === "attended" ? "in" : value) : attended ? "in" : "out";

  switch (normalized) {
    case "in":
      return "IN";
    case "available":
      return "Available";
    case "late_cancel":
      return "Late cancel";
    case "no_show":
      return "No-show";
    default:
      return "Out";
  }
}

function formatTeamBadge(teamCode, teamDisplayConfig) {
  if (!teamCode) {
    return "-";
  }

  const label = teamDisplayLabel(teamDisplayConfig, teamCode);
  return `<span class="team-badge ${escapeHtml(teamCode)}">${escapeHtml(label)}</span>`;
}

function historyRowMarkup(row) {
  return `
    <article class="timeline-item">
      <div class="timeline-head">
        <div>
          <div class="timeline-title">${escapeHtml(row.seasonName)} · MD ${escapeHtml(
            row.matchdayNumber
          )}</div>
          <div class="timeline-copy">${escapeHtml(row.kickoffLabel)}</div>
        </div>
        ${
          row.teamCode
            ? formatTeamBadge(row.teamCode, row.teamDisplayConfig)
            : '<span class="timeline-copy">No team</span>'
        }
      </div>
      <div class="timeline-main">
        <div class="timeline-copy">${escapeHtml(row.attendanceLabel)}</div>
        <div class="compact-badges">
          ${row.goals > 0 ? `<span class="stat-pill">${escapeHtml(row.goals)} goals</span>` : ""}
          ${row.goalKeeps > 0 ? `<span class="stat-pill">${escapeHtml(row.goalKeeps)} GK</span>` : ""}
          ${row.cleanSheet ? '<span class="stat-pill">Clean sheet</span>' : ""}
        </div>
      </div>
    </article>
  `;
}

function renderHistory() {
  if (!historyRows.length) {
    historySummary.textContent = "0 entries";
    historyStatus.textContent = "No recent matchday history yet.";
    historyShell.innerHTML =
      '<div class="empty-state">This player does not have saved season history here yet.</div>';
    return;
  }

  const recentRows = historyRows.slice(0, 5);
  const olderRows = historyRows.slice(5);
  const olderLabel = `${olderRows.length} older entr${olderRows.length === 1 ? "y" : "ies"}`;

  historySummary.textContent = `${historyRows.length} entries`;
  historyStatus.textContent = olderRows.length
    ? "Newest matchdays stay visible. Older history opens on demand."
    : "Showing full matchday history.";
  historyShell.innerHTML = `
    <div class="timeline-list">
      ${recentRows.map((row) => historyRowMarkup(row)).join("")}
    </div>
    ${
      olderRows.length
        ? `
          <details class="disclosure-card">
            <summary class="disclosure-summary">
              <div class="disclosure-copy">
                <div class="disclosure-title">Older history</div>
                <div class="manual-note">Open ${escapeHtml(
                  olderLabel
                )} only when you need the deeper archive.</div>
              </div>
            </summary>
            <div class="disclosure-body">
              <div class="timeline-list">
                ${olderRows.map((row) => historyRowMarkup(row)).join("")}
              </div>
            </div>
          </details>
        `
        : ""
    }
  `;
}

async function loadPlayerHistory() {
  historyStatus.textContent = "Loading recent history...";
  historyShell.innerHTML = "";

  const [{ data: stats, error: statsError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabaseClient
        .from("matchday_player_stats")
        .select("matchday_id, attended, attendance_status, goals, goal_keeps, clean_sheet")
        .eq("player_id", playerId),
      supabaseClient
        .from("matchday_assignments")
        .select("matchday_id, team_code")
        .eq("player_id", playerId),
    ]);

  if (statsError || assignmentsError) {
    historyStatus.textContent = readableError(statsError || assignmentsError);
    historyShell.innerHTML = `<div class="empty-state">${escapeHtml(
      readableError(statsError || assignmentsError)
    )}</div>`;
    return;
  }

  const matchdayIds = Array.from(
    new Set([
      ...(stats || []).map((row) => row.matchday_id),
      ...(assignments || []).map((row) => row.matchday_id),
    ])
  );

  if (!matchdayIds.length) {
    historyRows = [];
    renderHistory();
    return;
  }

  const { data: matchdays, error: matchdaysError } = await supabaseClient
    .from("matchdays")
    .select("id, season_id, matchday_number, kickoff_at")
    .in("id", matchdayIds);

  if (matchdaysError) {
    historyStatus.textContent = readableError(matchdaysError);
    historyShell.innerHTML = `<div class="empty-state">${escapeHtml(
      readableError(matchdaysError)
    )}</div>`;
    return;
  }

  const seasonIds = Array.from(new Set((matchdays || []).map((row) => row.season_id)));
  let { data: seasons, error: seasonsError } = await supabaseClient
    .from("seasons")
    .select("id, name, team_display_config")
    .in("id", seasonIds);

  if (
    seasonsError &&
    String(seasonsError?.message || "").toLowerCase().includes("team_display_config")
  ) {
    ({ data: seasons, error: seasonsError } = await supabaseClient
      .from("seasons")
      .select("id, name")
      .in("id", seasonIds));
  }

  if (seasonsError) {
    historyStatus.textContent = readableError(seasonsError);
    historyShell.innerHTML = `<div class="empty-state">${escapeHtml(
      readableError(seasonsError)
    )}</div>`;
    return;
  }

  const seasonMap = new Map(
    (seasons || []).map((row) => [
      row.id,
      {
        name: row.name,
        teamDisplayConfig: normalizeTeamDisplayConfig(row.team_display_config),
      },
    ])
  );
  const statMap = new Map((stats || []).map((row) => [row.matchday_id, row]));
  const assignmentMap = new Map((assignments || []).map((row) => [row.matchday_id, row]));

  historyRows = (matchdays || [])
    .map((matchday) => {
      const stat = statMap.get(matchday.id) || null;
      const assignment = assignmentMap.get(matchday.id) || null;
      const seasonRow = seasonMap.get(matchday.season_id) || {
        name: "Season",
        teamDisplayConfig: normalizeTeamDisplayConfig(null),
      };

      return {
        seasonName: seasonRow.name,
        teamDisplayConfig: seasonRow.teamDisplayConfig,
        matchdayNumber: matchday.matchday_number,
        kickoffAt: matchday.kickoff_at,
        kickoffLabel: matchday.kickoff_at ? formatDate(matchday.kickoff_at) : "Date pending",
        attendanceLabel: formatAttendanceLabel(stat?.attendance_status, stat?.attended),
        teamCode: assignment?.team_code || null,
        goals: Number(stat?.goals || 0),
        goalKeeps: Number(stat?.goal_keeps || 0),
        cleanSheet: Boolean(stat?.clean_sheet),
      };
    })
    .sort((left, right) => {
      const leftTime = left.kickoffAt ? new Date(left.kickoffAt).getTime() : 0;
      const rightTime = right.kickoffAt ? new Date(right.kickoffAt).getTime() : 0;

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return right.matchdayNumber - left.matchdayNumber;
    });

  renderHistory();
}

async function loadPlayer() {
  if (!Number.isInteger(playerId) || playerId <= 0) {
    showEmptyState("Missing or invalid player ID. Open this page from the player list.");
    return;
  }

  let { data, error } = await supabaseClient
    .from("players")
    .select(
      "id, first_name, last_name, nickname, nationality, birth_date, phone, positions, skill_rating, desired_tier, status, dominant_foot, notes"
    )
    .eq("id", playerId)
    .single();

  if (error && hasMissingDesiredTierColumn(error)) {
    ({ data, error } = await supabaseClient
      .from("players")
      .select(
        "id, first_name, last_name, nickname, nationality, birth_date, phone, positions, skill_rating, status, dominant_foot, notes"
      )
      .eq("id", playerId)
      .single());
  }

  if (error) {
    showEmptyState(readableError(error));
    return;
  }

  showShell();
  populateForm(data);
  renderDetail();
  await loadPlayerHistory();
  renderDetail();
  setEditMode(false);
  setStatus("Profile loaded.", "success");
}

async function savePlayer(event) {
  event.preventDefault();

  const firstName = normalizeText(firstNameInput.value);
  const lastName = normalizeText(lastNameInput.value);
  const nickname = normalizeText(nicknameInput.value);
  const nationality = normalizeText(nationalityInput.value);
  const birthDate = birthDateInput.value || null;
  const phone = normalizeText(phoneInput.value);
  const notes = normalizeText(notesInput.value);
  const skillRating = Number(skillRatingInput.value);

  if (firstName.length < 2 || lastName.length < 1 || nationality.length < 2) {
    setStatus("First name and nationality need at least 2 characters. Last name needs at least 1.", "error");
    return;
  }

  if (!selectedRoles.length || selectedRoles.length > 3) {
    setStatus("Select between 1 and 3 roles for this player.", "error");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  setStatus(`Saving ${firstName} ${lastName}...`);

  let { error } = await supabaseClient
    .from("players")
    .update({
      first_name: firstName,
      last_name: lastName,
      nickname: nickname || null,
      nationality,
      birth_date: birthDate,
      phone: phone || null,
      positions: selectedRoles,
      skill_rating: skillRating,
      desired_tier: statusInput.value,
      status: statusInput.value,
      dominant_foot: dominantFootInput.value,
      notes: notes || null,
    })
    .eq("id", playerId);

  if (error && hasMissingDesiredTierColumn(error)) {
    ({ error } = await supabaseClient
      .from("players")
      .update({
        first_name: firstName,
        last_name: lastName,
        nickname: nickname || null,
        nationality,
        birth_date: birthDate,
        phone: phone || null,
        positions: selectedRoles,
        skill_rating: skillRating,
        status: statusInput.value,
        dominant_foot: dominantFootInput.value,
        notes: notes || null,
      })
      .eq("id", playerId));
  }

  saveButton.disabled = false;
  saveButton.textContent = "Save";

  if (error) {
    setStatus(readableError(error), "error");
    return;
  }

  await loadPlayer();
  setStatus("Profile updated successfully.", "success");
}

skillRatingInput.addEventListener("input", () => {
  ratingValue.textContent = skillRatingInput.value;
  playerRatingStat.textContent = skillRatingInput.value;
});

roleGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-role]");

  if (!button) {
    return;
  }

  const role = button.dataset.role;
  const isActive = selectedRoles.includes(role);

  if (isActive) {
    if (selectedRoles.length === 1) {
      setStatus("Each player needs at least one role.", "warning");
      return;
    }

    selectedRoles = selectedRoles.filter((value) => value !== role);
    syncRoleUi();
    return;
  }

  if (selectedRoles.length >= 3) {
    setStatus("You can select up to 3 roles.", "warning");
    return;
  }

  selectedRoles = [...selectedRoles, role];
  syncRoleUi();
});

editButton.addEventListener("click", () => {
  if (!player) {
    return;
  }

  setEditMode(true);
  setStatus("Edit mode enabled. Save or cancel when finished.");
});

cancelButton.addEventListener("click", () => {
  if (!player) {
    return;
  }

  populateForm(player);
  renderDetail();
  setEditMode(false);
  setStatus("Changes discarded.", "warning");
});

form.addEventListener("submit", savePlayer);

deleteButton.addEventListener("click", async () => {
  if (!player) {
    return;
  }

  const confirmed = window.confirm(
    `Delete ${player.first_name} ${player.last_name}? This cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;
  setStatus(`Deleting ${player.first_name} ${player.last_name}...`);

  const { error } = await supabaseClient.from("players").delete().eq("id", playerId);

  deleteButton.disabled = false;

  if (error) {
    setStatus(readableError(error), "error");
    return;
  }

  window.location.href = "./squad.html";
});

loadPlayer();
