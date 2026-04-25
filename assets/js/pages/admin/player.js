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
let historyExpanded = false;
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

function formatFoot(value) {
  if (!value) {
    return "Right";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
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
    : ["MID"];

  playerViewBody.innerHTML = `
    <div class="detail-card">
      <div class="section-label">Identity</div>
      <h3>${escapeHtml(`${player.first_name || ""} ${player.last_name || ""}`.trim())}</h3>
      <ul>
        <li>Nickname: <strong>${escapeHtml(player.nickname || "Not set")}</strong></li>
        <li>Nationality: <strong>${escapeHtml(player.nationality || "Not set")}</strong></li>
        <li>Birth date: <strong>${escapeHtml(formatDate(player.birth_date))}</strong></li>
        <li>Phone: <strong>${escapeHtml(player.phone || "Not set")}</strong></li>
      </ul>
    </div>
    <div class="detail-card">
      <div class="section-label">Playing Profile</div>
      <ul>
        <li>Current / next-season tier: <strong>${escapeHtml(formatTier(player.status))}</strong></li>
        <li>Preferred foot: <strong>${escapeHtml(formatFoot(player.dominant_foot))}</strong></li>
        <li>Rating: <strong>${escapeHtml(player.skill_rating || 78)}</strong></li>
        <li>Positions: <strong>${escapeHtml(positions.join(", "))}</strong></li>
      </ul>
    </div>
    <div class="detail-card">
      <div class="section-label">Notes</div>
      <p>${escapeHtml(player.notes || "No notes saved.")}</p>
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

function renderHistory() {
  if (!historyRows.length) {
    historySummary.textContent = "0 entries";
    historyStatus.textContent = "No recent matchday history yet.";
    historyShell.innerHTML =
      '<div class="empty-state">This player does not have saved season history here yet.</div>';
    return;
  }

  const visibleRows = historyExpanded ? historyRows : historyRows.slice(0, 5);

  historySummary.textContent = `${historyRows.length} entries`;
  historyStatus.textContent = historyExpanded
    ? "Showing full matchday history."
    : "Showing the newest matchdays first.";
  historyShell.innerHTML = `
    <div class="timeline-list">
      ${visibleRows
        .map(
          (row) => `
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
          `
        )
        .join("")}
    </div>
    ${
      historyRows.length > 5
        ? `
          <div class="actions">
            <button class="secondary-button" type="button" id="history-toggle-button">
              ${historyExpanded ? "Show recent only" : `Show all ${historyRows.length} entries`}
            </button>
          </div>
        `
        : ""
    }
  `;

  const toggleButton = document.getElementById("history-toggle-button");
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      historyExpanded = !historyExpanded;
      renderHistory();
    });
  }
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

  historyExpanded = false;
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
