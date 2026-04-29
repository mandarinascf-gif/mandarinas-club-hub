const supabaseConfig = window.MandarinasSupabaseConfig;
const supabaseClient = supabaseConfig.createClient();
const normalizePlayerDesiredTier =
  window.MandarinasLogic?.normalizePlayerDesiredTier || ((player) => player);

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
const notesInput = document.getElementById("notes");
const ratingValue = document.getElementById("rating-value");
const submitButton = document.getElementById("submit-button");
const clearButton = document.getElementById("clear-button");
const refreshButton = document.getElementById("refresh-button");
const statusLine = document.getElementById("status-line");
const searchInput = document.getElementById("search-input");
const filterRow = document.getElementById("filter-row");
const rosterGrid = document.getElementById("roster-grid");
const heroPlayerCount = document.getElementById("hero-player-count");
const heroAverageRating = document.getElementById("hero-average-rating");
const heroActiveCount = document.getElementById("hero-active-count");
const seasonPrepCopy = document.getElementById("season-prep-copy");
const playerWorkspace = document.getElementById("player-workspace");
const playerWorkspaceFrame = document.getElementById("player-workspace-frame");
const playerViewTriggers = Array.from(document.querySelectorAll("[data-player-view-trigger]"));
const playerViewPanes = Array.from(document.querySelectorAll("[data-player-view]"));

let players = [];
let activeFilter = "all";
let activePlayerView = "browse";
let selectedRoles = ["GK"];
let savingTierPlayerIds = new Set();

function hasMissingDesiredTierColumn(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("column") || message.includes("schema cache")) &&
    message.includes("desired_tier")
  );
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function stripSubPrefix(value) {
  return normalizeText(value).replace(/^\(sub\)\s*/i, "");
}

function fullName(player) {
  const first = normalizeText(player.first_name || "");
  const last = normalizeText(player.last_name || "");

  if (!last || ["player", "sub"].includes(last.toLowerCase())) {
    return stripSubPrefix(first);
  }

  return stripSubPrefix(`${first} ${last}`);
}

function displayName(player) {
  return stripSubPrefix(player.nickname) || fullName(player);
}

function isSubPlaceholder(player) {
  return [player.first_name, player.last_name, player.nickname]
    .map((value) => normalizeText(value).toLowerCase())
    .some((value) => value.includes("(sub)") || value === "sub");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatStatusLabel(value) {
  if (value === "flex_sub") {
    return "Flex/Sub";
  }
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Rotation";
}

function tierSortRank(status) {
  if (status === "core") {
    return 0;
  }
  if (status === "rotation") {
    return 1;
  }
  if (status === "flex_sub") {
    return 2;
  }
  return 3;
}

function comparePlayersForRoster(left, right) {
  const tierDifference = tierSortRank(left?.status) - tierSortRank(right?.status);
  if (tierDifference !== 0) {
    return tierDifference;
  }

  const displayDifference = displayName(left).localeCompare(displayName(right));
  if (displayDifference !== 0) {
    return displayDifference;
  }

  return fullName(left).localeCompare(fullName(right));
}

function tierOptionsMarkup(selectedValue) {
  return ["core", "rotation", "flex_sub"]
    .map(
      (value) =>
        `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(
          formatStatusLabel(value)
        )}</option>`
    )
    .join("");
}

function readableError(error) {
  const message = error?.message || "Unknown error";
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("relation") &&
    (lowerMessage.includes("players") || lowerMessage.includes("season_players"))
  ) {
    return "Full Squad cannot open until live club data is ready.";
  }

  if (lowerMessage.includes("column") || lowerMessage.includes("schema cache")) {
    return "Full Squad is waiting for the latest live club update.";
  }

  if (error?.code === "23505") {
    return "That player already exists in the full squad register.";
  }

  return message;
}

function setStatus(message, tone = "") {
  statusLine.textContent = message;
  statusLine.className = tone ? `status-line ${tone}` : "status-line";
}

function playerViewHash(view) {
  return view === "add" ? "#add-player" : "#player-list-panel";
}

function resolvePlayerView(hash = window.location.hash) {
  const normalizedHash = String(hash || "").toLowerCase();
  return normalizedHash === "#add-player" ? "add" : "browse";
}

function updatePlayerViewUrl(view) {
  const url = new URL(window.location.href);
  url.hash = playerViewHash(view);
  window.history.replaceState({}, "", url);
}

function setPlayerView(view, options = {}) {
  const nextView = view === "add" ? "add" : "browse";
  const {
    focus = false,
    scroll = false,
    updateHash = true,
  } = options;

  activePlayerView = nextView;
  if (playerWorkspaceFrame) {
    playerWorkspaceFrame.dataset.playerViewMode = nextView;
  }

  playerViewPanes.forEach((pane) => {
    const isActive = pane.dataset.playerView === nextView;
    pane.hidden = !isActive;
  });

  playerViewTriggers.forEach((button) => {
    const isActive = button.dataset.playerViewTrigger === nextView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (updateHash) {
    updatePlayerViewUrl(nextView);
  }

  if (scroll && playerWorkspace) {
    playerWorkspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (focus) {
    if (nextView === "add") {
      firstNameInput.focus();
    } else {
      searchInput.focus();
    }
  }
}

function syncRoleUi() {
  Array.from(roleGrid.querySelectorAll("[data-role]")).forEach((button) => {
    button.classList.toggle("active", selectedRoles.includes(button.dataset.role));
  });
  roleNote.textContent = `Selected roles: ${selectedRoles.join(", ")}`;
}

function resetForm(options = {}) {
  const { focus = true } = options;
  form.reset();
  selectedRoles = ["GK"];
  statusInput.value = "core";
  dominantFootInput.value = "right";
  skillRatingInput.value = "78";
  ratingValue.textContent = "78";
  syncRoleUi();
  if (focus) {
    firstNameInput.focus();
  }
}

function updateHeroStats() {
  const playerCount = players.length;
  const preferredCoreCount = players.filter((player) => player.status === "core").length;
  const preferredRotationCount = players.filter((player) => player.status === "rotation").length;
  const averageRating = playerCount
    ? Math.round(players.reduce((sum, player) => sum + Number(player.skill_rating || 0), 0) / playerCount)
    : 0;

  heroPlayerCount.textContent = String(playerCount);
  heroActiveCount.textContent = String(preferredCoreCount);
  heroAverageRating.textContent = String(averageRating);

  if (seasonPrepCopy) {
    seasonPrepCopy.textContent = `${preferredCoreCount} full-squad players are currently marked Core and ${preferredRotationCount} are marked Rotation. Season Centre uses those full-squad current / next-season tiers when you bulk-load the next campaign.`;
  }
}

function getFilteredPlayers() {
  const searchValue = normalizeText(searchInput.value).toLowerCase();

  return players
    .filter((player) => activeFilter === "all" || player.status === activeFilter)
    .filter((player) => {
      if (!searchValue) {
        return true;
      }

      const haystack = [
        player.first_name,
        player.last_name,
        player.nickname || "",
        player.nationality || "",
        ...(player.positions || []),
        player.phone || "",
        player.notes || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchValue);
    })
    .sort(comparePlayersForRoster);
}

function renderRoster() {
  const filteredPlayers = getFilteredPlayers();

  if (!players.length) {
    rosterGrid.innerHTML = `<div class="empty-state">No full squad player records exist yet.</div>`;
    return;
  }

  if (!filteredPlayers.length) {
    rosterGrid.innerHTML = `<div class="empty-state">No players match the current search or filter.</div>`;
    return;
  }

  rosterGrid.innerHTML = filteredPlayers
    .map((player) => {
      const subtitleParts = [];
      if (player.nickname) {
        subtitleParts.push(`Nickname: ${stripSubPrefix(player.nickname)}`);
      }
      if (player.nationality) {
        subtitleParts.push(player.nationality);
      }
      if (Array.isArray(player.positions) && player.positions.length) {
        subtitleParts.push(player.positions.join(", "));
      }

      return `
        <article class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${escapeHtml(displayName(player))}</div>
            <div class="compact-row-copy">${escapeHtml(subtitleParts.join(" · ") || fullName(player))}</div>
          </div>
          <div class="list-actions">
            <span class="tier-pill ${escapeHtml(player.status)}">${escapeHtml(formatStatusLabel(player.status))}</span>
            <div class="inline-select-field">
              <label for="player-tier-${player.id}">Full squad current / next-season tier</label>
              <select
                id="player-tier-${player.id}"
                data-player-tier-id="${player.id}"
                ${savingTierPlayerIds.has(player.id) ? "disabled" : ""}
              >
                ${tierOptionsMarkup(player.status)}
              </select>
            </div>
            <a class="secondary-button" href="./player.html?player_id=${player.id}">View</a>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadPlayers() {
  setStatus("Loading players...");

  let { data, error } = await supabaseClient
    .from("players")
    .select(
      "id, first_name, last_name, nickname, nationality, birth_date, phone, positions, skill_rating, desired_tier, status, dominant_foot, notes, created_at"
    )
    .order("created_at", { ascending: false });

  if (error && hasMissingDesiredTierColumn(error)) {
    ({ data, error } = await supabaseClient
      .from("players")
      .select(
        "id, first_name, last_name, nickname, nationality, birth_date, phone, positions, skill_rating, status, dominant_foot, notes, created_at"
      )
      .order("created_at", { ascending: false }));
  }

  if (error) {
    players = [];
    updateHeroStats();
    renderRoster();
    setStatus(readableError(error), "error");
    return;
  }

  players = (data || [])
    .map((player) => normalizePlayerDesiredTier(player, "core"))
    .filter((player) => !isSubPlaceholder(player));

  updateHeroStats();
  renderRoster();
  setStatus("Squad register loaded.", "success");
}

async function addPlayer(event) {
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
    setStatus(
      "First name and nationality must each be at least 2 characters. Last name must be at least 1.",
      "error"
    );
    return;
  }

  if (!selectedRoles.length || selectedRoles.length > 3) {
    setStatus("Select between 1 and 3 positions.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  setStatus(`Saving ${firstName} ${lastName}...`);

  let { error } = await supabaseClient.from("players").insert({
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
  });

  if (error && hasMissingDesiredTierColumn(error)) {
    ({ error } = await supabaseClient.from("players").insert({
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
    }));
  }

  submitButton.disabled = false;
  submitButton.textContent = "Save player";

  if (error) {
    setStatus(readableError(error), "error");
    return;
  }

  resetForm();
  setStatus(`${firstName} ${lastName} added.`, "success");
  await loadPlayers();
}

async function savePlayerTier(playerId, nextTier, select) {
  const player = players.find((entry) => entry.id === playerId);
  if (!player) {
    setStatus("Player not found. Reload the full squad register and try again.", "error");
    renderRoster();
    return;
  }

  if (player.status === nextTier) {
    return;
  }

  savingTierPlayerIds = new Set([...savingTierPlayerIds, playerId]);
  if (select) {
    select.disabled = true;
  }
  setStatus(`Saving ${displayName(player)} as ${formatStatusLabel(nextTier)}...`);

  let error = null;

  ({ error } = await supabaseClient
    .from("players")
    .update({
      desired_tier: nextTier,
      status: nextTier,
    })
    .eq("id", playerId));

  if (error && hasMissingDesiredTierColumn(error)) {
    ({ error } = await supabaseClient
      .from("players")
      .update({ status: nextTier })
      .eq("id", playerId));
  }

  savingTierPlayerIds.delete(playerId);
  if (select) {
    select.disabled = false;
  }

  if (error) {
    if (select) {
      select.value = player.status;
    }
    setStatus(readableError(error), "error");
    return;
  }

  player.status = nextTier;
  player.desired_tier = nextTier;
  updateHeroStats();
  renderRoster();
  setStatus(
    `${displayName(player)} is now marked ${formatStatusLabel(nextTier)} for full-squad current / next-season planning.`,
    "success"
  );
}

skillRatingInput.addEventListener("input", () => {
  ratingValue.textContent = skillRatingInput.value;
});

form.addEventListener("submit", addPlayer);
clearButton.addEventListener("click", () => {
  resetForm();
  setStatus("Form cleared.", "warning");
});
refreshButton.addEventListener("click", loadPlayers);
searchInput.addEventListener("input", renderRoster);
playerViewTriggers.forEach((button) => {
  button.addEventListener("click", () => {
    setPlayerView(button.dataset.playerViewTrigger, {
      focus: true,
      scroll: true,
    });
  });
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
      setStatus("Each player needs at least one position.", "warning");
      return;
    }
    selectedRoles = selectedRoles.filter((value) => value !== role);
    syncRoleUi();
    return;
  }

  if (selectedRoles.length >= 3) {
    setStatus("You can select up to 3 positions.", "warning");
    return;
  }

  selectedRoles = [...selectedRoles, role];
  syncRoleUi();
});

filterRow.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) {
    return;
  }

  activeFilter = button.dataset.filter;
  Array.from(filterRow.querySelectorAll("[data-filter]")).forEach((chip) => {
    chip.classList.toggle("active", chip === button);
  });
  renderRoster();
});

rosterGrid.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-player-tier-id]");
  if (!select) {
    return;
  }

  await savePlayerTier(Number(select.dataset.playerTierId), select.value, select);
});

window.addEventListener("hashchange", () => {
  setPlayerView(resolvePlayerView(), { updateHash: false });
});

setPlayerView(resolvePlayerView(), { updateHash: false });
resetForm({ focus: false });
loadPlayers();
