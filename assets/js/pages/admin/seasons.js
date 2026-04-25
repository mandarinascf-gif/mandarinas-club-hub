      const supabaseConfig = window.MandarinasSupabaseConfig;
      const { url: SUPABASE_URL } = supabaseConfig;

      const supabaseClient = supabaseConfig.createClient();
      const sortSeasonsChronologically =
        window.MandarinasLogic?.sortSeasonsChronologically || ((rows) => [...(rows || [])]);

      const params = new URLSearchParams(window.location.search);
      const seasonForm = document.getElementById("season-form");
      const seasonNameInput = document.getElementById("season-name");
      const totalMatchdaysInput = document.getElementById("total-matchdays");
      const coreSpotsInput = document.getElementById("core-spots");
      const rotationSpotsInput = document.getElementById("rotation-spots");
      const modelStartMatchdayInput = document.getElementById("model-start-matchday");
      const seasonStartDateInput = document.getElementById("season-start-date");
      const seasonWeekdayInput = document.getElementById("season-weekday");
      const seasonKickoffTimeInput = document.getElementById("season-kickoff-time");
      const seasonVenueNameInput = document.getElementById("season-venue-name");
      const seasonSubmitButton = document.getElementById("season-submit-button");
      const seasonRefreshButton = document.getElementById("season-refresh-button");
      const seasonStatusLine = document.getElementById("season-status-line");
      const seasonGrid = document.getElementById("season-grid");
      const rosterBoardCopy = document.getElementById("roster-board-copy");
      const rosterSeasonPill = document.getElementById("roster-season-pill");
      const rosterRefreshButton = document.getElementById("roster-refresh-button");
      const seedRosterButton = document.getElementById("seed-roster-button");
      const syncSeasonTierButton = document.getElementById("sync-season-tier-button");
      const openTiersLink = document.getElementById("open-tiers-link");
      const rosterBulkNote = document.getElementById("roster-bulk-note");
      const selectedCoreSpotsInput = document.getElementById("selected-core-spots");
      const selectedRotationSpotsInput = document.getElementById("selected-rotation-spots");
      const selectedModelStartMatchdayInput = document.getElementById("selected-model-start-matchday");
      const selectedSeasonStartDateInput = document.getElementById("selected-season-start-date");
      const selectedSeasonWeekdayInput = document.getElementById("selected-season-weekday");
      const selectedSeasonKickoffTimeInput = document.getElementById("selected-season-kickoff-time");
      const selectedSeasonVenueNameInput = document.getElementById("selected-season-venue-name");
      const saveSeasonSettingsButton = document.getElementById("save-season-settings-button");
      const applyScheduleDefaultsButton = document.getElementById("apply-schedule-defaults-button");
      const seasonSettingsNote = document.getElementById("season-settings-note");
      const seasonRosterSearch = document.getElementById("season-roster-search");
      const seasonRosterAddSelect = document.getElementById("season-roster-add-select");
      const seasonRosterRegistrationTierSelect = document.getElementById("season-roster-registration-tier");
      const seasonRosterTierStatusSelect = document.getElementById("season-roster-tier-status");
      const seasonRosterPaymentStatusSelect = document.getElementById("season-roster-payment-status");
      const seasonRosterAddButton = document.getElementById("season-roster-add-button");
      const seasonDirectoryPrepSummary = document.getElementById("season-directory-prep-summary");
      const seasonDirectoryPrepWrap = document.getElementById("season-directory-prep-wrap");
      const rosterSummaryGrid = document.getElementById("roster-summary-grid");
      const seasonRosterWrap = document.getElementById("season-roster-wrap");
      const matchdayGrid = document.getElementById("matchday-grid");
      const selectedSeasonPill = document.getElementById("selected-season-pill");
      const matchdayBoardCopy = document.getElementById("matchday-board-copy");
      const seasonCount = document.getElementById("season-count");
      const matchdayCount = document.getElementById("matchday-count");
      const scheduledCount = document.getElementById("scheduled-count");
      const seasonWorkspace = document.getElementById("season-workspace");
      const seasonWorkspaceFrame = document.getElementById("season-workspace-frame");
      const seasonViewTriggers = Array.from(document.querySelectorAll("[data-season-view-trigger]"));
      const seasonViewPanes = Array.from(document.querySelectorAll("[data-season-view]"));
      const seasonSettingsDisclosure = document.getElementById("season-settings-disclosure");
      const seasonRosterToolsDisclosure = document.getElementById("season-roster-tools-disclosure");
      const seasonDirectoryPrepDisclosure = document.getElementById("season-directory-prep-disclosure");
      const seasonRosterListDisclosure = document.getElementById("season-roster-list-disclosure");

      let seasons = [];
      let clubPlayers = [];
      let selectedSeasonId = Number(params.get("season_id")) || null;
      let activeSeasonView = "list";
      let seasonScheduleDefaultsSupported = true;
      let seasonRosterMetadataSupported = true;
      let savingDirectoryTierPlayerIds = new Set();
      let lastRosterDisclosureSeasonId = null;
      const DEFAULT_KICKOFF_LOCAL_TIME = "21:00";
      const DEFAULT_VENUE_NAME = "Alden E. Oliver";
      const DEFAULT_MATCHDAY_WEEKDAY = 4;
      const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const PAYMENT_STATUS_LABELS = Object.freeze({
        unknown: "Unknown",
        pending: "Pending",
        paid: "Paid",
        comped: "Comped",
      });

      function hasMissingDesiredTierColumn(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("column") || message.includes("schema cache")) &&
          message.includes("desired_tier")
        );
      }

      function hasMissingSeasonScheduleColumns(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("column") || message.includes("schema cache")) &&
          (
            message.includes("season_start_date") ||
            message.includes("default_matchday_weekday") ||
            message.includes("default_kickoff_time") ||
            message.includes("venue_name")
          )
        );
      }

      function hasMissingSeasonRosterMetadataColumns(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("column") || message.includes("schema cache")) &&
          (message.includes("registration_tier") || message.includes("payment_status"))
        );
      }

      function normalizeText(value) {
        return String(value || "").trim().replace(/\s+/g, " ");
      }

      function normalizeDesiredTierPlayer(player) {
        const desiredTier = normalizeText(player?.desired_tier || player?.status || "rotation").toLowerCase();
        return {
          ...player,
          desired_tier: desiredTier,
          status: desiredTier,
        };
      }

      function normalizePaymentStatus(value) {
        const normalized = normalizeText(value || "unknown").toLowerCase();
        if (normalized === "pending" || normalized === "paid" || normalized === "comped") {
          return normalized;
        }
        return "unknown";
      }

      function formatPaymentStatusLabel(value) {
        return PAYMENT_STATUS_LABELS[normalizePaymentStatus(value)] || "Unknown";
      }

      function normalizeWeekdayValue(value, fallback = DEFAULT_MATCHDAY_WEEKDAY) {
        const numeric = Number(value);
        if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) {
          return numeric;
        }
        return fallback;
      }

      function weekdayLabel(value) {
        return WEEKDAY_LABELS[normalizeWeekdayValue(value)] || "Thu";
      }

      function normalizeTimeValue(value, fallback = DEFAULT_KICKOFF_LOCAL_TIME) {
        const normalized = normalizeText(value || fallback).slice(0, 5);
        return /^\d{2}:\d{2}$/.test(normalized) ? normalized : fallback;
      }

      function formatTimeLabel(value) {
        const timeValue = normalizeTimeValue(value, DEFAULT_KICKOFF_LOCAL_TIME);
        const stamp = new Date(`2000-01-01T${timeValue}`);
        return stamp.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function setStatus(message, tone = "") {
        seasonStatusLine.className = "status-line";

        if (!message) {
          seasonStatusLine.hidden = true;
          seasonStatusLine.textContent = "";
          return;
        }

        seasonStatusLine.hidden = false;
        seasonStatusLine.textContent = message;

        if (tone) {
          seasonStatusLine.classList.add(tone);
        }
      }

      function formatDateTime(value) {
        return new Date(value).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }

      function formatDateTimeLocalValue(value) {
        const date = new Date(value);
        const offset = date.getTimezoneOffset();
        const adjusted = new Date(date.getTime() - offset * 60000);
        return adjusted.toISOString().slice(0, 16);
      }

      function applyDefaultKickoffTime(value, fallbackTime = DEFAULT_KICKOFF_LOCAL_TIME) {
        const normalized = normalizeText(value || "");

        if (!normalized) {
          return "";
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
          return `${normalized}T${fallbackTime}`;
        }

        if (/^\d{4}-\d{2}-\d{2}T00:00$/.test(normalized)) {
          return `${normalized.slice(0, 10)}T${fallbackTime}`;
        }

        return normalized;
      }

      function maybeApplyInputKickoffDefault(input) {
        if (!input || !input.dataset.defaultKickoffTime) {
          return;
        }

        input.value = applyDefaultKickoffTime(input.value, input.dataset.defaultKickoffTime);
      }

      function combineLocalDateTime(dateValue, timeValue = DEFAULT_KICKOFF_LOCAL_TIME) {
        const normalizedDate = normalizeText(dateValue || "");
        if (!normalizedDate) {
          return null;
        }

        const normalizedTime = normalizeTimeValue(timeValue, DEFAULT_KICKOFF_LOCAL_TIME);
        return new Date(`${normalizedDate}T${normalizedTime}`).toISOString();
      }

      function buildSeasonKickoffSchedule(totalMatchdays, startDate, weekday, kickoffTime) {
        const normalizedStartDate = normalizeText(startDate || "");
        if (!normalizedStartDate) {
          return Array.from({ length: totalMatchdays }, () => null);
        }

        const normalizedWeekday = normalizeWeekdayValue(weekday);
        const normalizedKickoffTime = normalizeTimeValue(kickoffTime, DEFAULT_KICKOFF_LOCAL_TIME);
        const firstDate = new Date(`${normalizedStartDate}T12:00:00`);

        if (Number.isNaN(firstDate.getTime())) {
          return Array.from({ length: totalMatchdays }, () => null);
        }

        const dayOffset = (normalizedWeekday - firstDate.getDay() + 7) % 7;
        firstDate.setDate(firstDate.getDate() + dayOffset);

        return Array.from({ length: totalMatchdays }, (_, index) => {
          const kickoffDate = new Date(firstDate);
          kickoffDate.setDate(firstDate.getDate() + index * 7);
          const year = kickoffDate.getFullYear();
          const month = String(kickoffDate.getMonth() + 1).padStart(2, "0");
          const day = String(kickoffDate.getDate()).padStart(2, "0");
          return combineLocalDateTime(`${year}-${month}-${day}`, normalizedKickoffTime);
        });
      }

      function fullName(player) {
        const first = normalizeText(player.first_name || "");
        const last = normalizeText(player.last_name || "");

        if (!last || ["player", "sub"].includes(last.toLowerCase())) {
          return stripSubPrefix(first);
        }

        return stripSubPrefix(normalizeText(`${first} ${last}`));
      }

      function stripSubPrefix(value) {
        return normalizeText(value || "").replace(/^\(sub\)\s*/i, "");
      }

      function displayName(player) {
        return stripSubPrefix(player.nickname) || fullName(player);
      }

      function getSelectedSeason() {
        return seasons.find((season) => season.id === selectedSeasonId) || null;
      }

      function comparePlayers(left, right) {
        return displayName(left).localeCompare(displayName(right));
      }

      function seasonRosterRowsForSeason(selectedSeason) {
        const playerMap = new Map(clubPlayers.map((player) => [player.id, player]));

        return (selectedSeason?.seasonPlayers || [])
          .map((row) => ({
            ...normalizeSeasonPlayerRow(row),
            player: playerMap.get(row.player_id) || null,
          }))
          .filter((row) => row.player)
          .sort((left, right) => comparePlayers(left.player, right.player));
      }

      function rosterTierSyncRows(rows) {
        return (rows || []).filter((row) => row.player && row.player.status !== row.tier_status);
      }

      function formatTierLabel(value) {
        if (value === "flex_sub") {
          return "Flex/Sub";
        }

        return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Rotation";
      }

      function seasonViewHash(view) {
        if (view === "create") {
          return "#create-season";
        }

        if (view === "roster") {
          return "#active-roster";
        }

        if (view === "schedule") {
          return "#season-schedule";
        }

        return "#season-list-panel";
      }

      function resolveSeasonView(hash = window.location.hash) {
        const normalizedHash = String(hash || "").toLowerCase();

        if (normalizedHash === "#create-season") {
          return "create";
        }

        if (normalizedHash === "#active-roster") {
          return "roster";
        }

        if (normalizedHash === "#season-schedule") {
          return "schedule";
        }

        return selectedSeasonId ? "roster" : "list";
      }

      function updateSeasonUrl() {
        const url = new URL(window.location.href);

        if (selectedSeasonId) {
          url.searchParams.set("season_id", String(selectedSeasonId));
        } else {
          url.searchParams.delete("season_id");
        }

        url.hash = seasonViewHash(activeSeasonView);

        window.history.replaceState({}, "", url);
      }

      function setSeasonView(view, options = {}) {
        const nextView =
          view === "create" || view === "roster" || view === "schedule" ? view : "list";
        const {
          focus = false,
          scroll = false,
          updateHash = true,
        } = options;

        activeSeasonView = nextView;

        if (seasonWorkspaceFrame) {
          seasonWorkspaceFrame.dataset.seasonViewMode = nextView;
        }

        seasonViewPanes.forEach((pane) => {
          const isActive = pane.dataset.seasonView === nextView;
          pane.hidden = !isActive;
        });

        seasonViewTriggers.forEach((button) => {
          const isActive = button.dataset.seasonViewTrigger === nextView;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-selected", String(isActive));
        });

        if (updateHash) {
          updateSeasonUrl();
        }

        if (scroll && seasonWorkspace) {
          seasonWorkspace.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        if (focus) {
          if (nextView === "create") {
            seasonNameInput.focus();
          } else if (nextView === "roster") {
            seasonRosterSearch.focus();
          }
        }
      }

      function openRosterDisclosure(name) {
        const disclosures = {
          settings: seasonSettingsDisclosure,
          tools: seasonRosterToolsDisclosure,
          prep: seasonDirectoryPrepDisclosure,
          players: seasonRosterListDisclosure,
        };

        Object.entries(disclosures).forEach(([key, disclosure]) => {
          if (!disclosure) {
            return;
          }

          disclosure.open = key === name;
        });
      }

      function normalizeSeasonConfig(season) {
        if (!season) {
          return season;
        }

        return {
          ...season,
          core_spots: Number(season.core_spots || 0),
          rotation_spots: Number(season.rotation_spots || 0),
          model_start_matchday: Number(season.model_start_matchday || 1),
          season_start_date: normalizeText(season.season_start_date || ""),
          default_matchday_weekday: normalizeWeekdayValue(
            season.default_matchday_weekday,
            DEFAULT_MATCHDAY_WEEKDAY
          ),
          default_kickoff_time: normalizeTimeValue(
            season.default_kickoff_time,
            DEFAULT_KICKOFF_LOCAL_TIME
          ),
          venue_name: normalizeText(season.venue_name || DEFAULT_VENUE_NAME) || DEFAULT_VENUE_NAME,
        };
      }

      function normalizeSeasonPlayerRow(row) {
        return {
          ...row,
          registration_tier: normalizeText(
            row.registration_tier || row.tier_status || "rotation"
          ).toLowerCase(),
          payment_status: normalizePaymentStatus(row.payment_status),
          is_eligible: row.is_eligible !== false,
        };
      }

      function updateHeroStats() {
        const totalSeasons = seasons.length;
        const allMatchdays = seasons.flatMap((season) => season.matchdays || []);
        const totalMatchdays = allMatchdays.length;
        const totalScheduled = allMatchdays.filter((matchday) => Boolean(matchday.kickoff_at)).length;

        seasonCount.textContent = String(totalSeasons);
        matchdayCount.textContent = String(totalMatchdays);
        scheduledCount.textContent = String(totalScheduled);
      }

      function readableError(error) {
        const message = error?.message || "Unknown error";
        const lowerMessage = message.toLowerCase();

        if (
          lowerMessage.includes("relation") &&
          (lowerMessage.includes("seasons") || lowerMessage.includes("matchdays"))
        ) {
          return "Season Centre cannot open until live club data is ready.";
        }

        if (lowerMessage.includes("column") || lowerMessage.includes("schema cache")) {
          return "Season Centre is waiting for the latest live club update.";
        }

        if (error?.code === "23505") {
          return "That season or matchday already exists.";
        }

        if (lowerMessage.includes("cannot remove player") && lowerMessage.includes("matchday activity")) {
          return "That player already has matchday assignments or stats in this season. Clear or reassign their matchday activity before removing them from the season roster.";
        }

        return message;
      }

      function seasonScheduleSummary(season) {
        if (!season?.season_start_date) {
          return "Manual kickoff dates";
        }

        return `${weekdayLabel(season.default_matchday_weekday)} · ${formatTimeLabel(
          season.default_kickoff_time
        )}`;
      }

      function setSeasonSettingsLocked(locked) {
        selectedCoreSpotsInput.disabled = locked;
        selectedRotationSpotsInput.disabled = locked;
        selectedModelStartMatchdayInput.disabled = locked;
        selectedSeasonStartDateInput.disabled = locked || !seasonScheduleDefaultsSupported;
        selectedSeasonWeekdayInput.disabled = locked || !seasonScheduleDefaultsSupported;
        selectedSeasonKickoffTimeInput.disabled = locked || !seasonScheduleDefaultsSupported;
        selectedSeasonVenueNameInput.disabled = locked || !seasonScheduleDefaultsSupported;
        saveSeasonSettingsButton.disabled = locked;
        applyScheduleDefaultsButton.disabled = locked || !seasonScheduleDefaultsSupported;
      }

      function syncRosterAddDefaultsFromSelection() {
        const playerId = Number(seasonRosterAddSelect.value);
        const player = clubPlayers.find((entry) => entry.id === playerId);
        const fallbackTier = player?.desired_tier || player?.status || "rotation";

        seasonRosterRegistrationTierSelect.value = fallbackTier;
        seasonRosterTierStatusSelect.value = fallbackTier;
      }

      function tierOptionsMarkup(selectedValue) {
        return ["core", "rotation", "flex_sub"]
          .map(
            (value) =>
              `<option value="${value}" ${
                value === selectedValue ? "selected" : ""
              }>${escapeHtml(formatTierLabel(value))}</option>`
          )
          .join("");
      }

      function paymentOptionsMarkup(selectedValue) {
        return ["unknown", "pending", "paid", "comped"]
          .map(
            (value) =>
              `<option value="${value}" ${
                value === selectedValue ? "selected" : ""
              }>${escapeHtml(formatPaymentStatusLabel(value))}</option>`
          )
          .join("");
      }

      async function saveDirectoryTier(playerId, nextTierValue) {
        const player = clubPlayers.find((entry) => entry.id === playerId);
        const nextTier = normalizeText(nextTierValue || "").toLowerCase();

        if (!player) {
          setStatus("Directory player not found. Refresh and try again.", "error");
          renderSeasonRoster();
          return;
        }

        if (!["core", "rotation", "flex_sub"].includes(nextTier) || player.status === nextTier) {
          return;
        }

        savingDirectoryTierPlayerIds = new Set([...savingDirectoryTierPlayerIds, playerId]);
        renderSeasonRoster();
        setStatus(`Saving ${displayName(player)} as ${formatTierLabel(nextTier)}...`);

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

        savingDirectoryTierPlayerIds.delete(playerId);

        if (error) {
          setStatus(readableError(error), "error");
          renderSeasonRoster();
          return;
        }

        player.status = nextTier;
        player.desired_tier = nextTier;
        renderSeasonRoster();
        setStatus(
          `${displayName(player)} is now marked ${formatTierLabel(nextTier)} for next-season bulk setup.`,
          "success"
        );
      }

      function renderSeasons() {
        if (!seasons.length) {
          seasonGrid.innerHTML = `
            <div class="empty-state">
              No seasons yet. Create one from the form and the app will generate its schedule.
            </div>
          `;
          return;
        }

        seasonGrid.innerHTML = seasons
          .map((season) => {
            const matchdays = season.matchdays || [];
            const rosterCount = (season.seasonPlayers || []).length;
            const scheduled = matchdays.filter((matchday) => Boolean(matchday.kickoff_at)).length;

            return `
              <article class="season-card ${season.id === selectedSeasonId ? "active" : ""}" data-season-id="${season.id}">
                <div class="season-card-head">
                  <div>
                    <h3 class="season-name">${escapeHtml(season.name)}</h3>
                    <p class="season-meta">Created ${escapeHtml(formatDateTime(season.created_at))}</p>
                  </div>
                  <div class="count-badge">
                    <span>Days</span>
                    <strong>${escapeHtml(season.total_matchdays)}</strong>
                  </div>
                </div>

                <div class="season-tags">
                  <span class="tag-pill">${escapeHtml(scheduled)} scheduled</span>
                  <span class="tag-pill">${escapeHtml(matchdays.length)} generated</span>
                  <span class="tag-pill">${escapeHtml(rosterCount)} in season</span>
                  <span class="tag-pill">${escapeHtml(season.core_spots)} core target</span>
                  <span class="tag-pill">${escapeHtml(season.rotation_spots)} rotation target</span>
                  <span class="tag-pill">${escapeHtml(seasonScheduleSummary(season))}</span>
                  <span class="tag-pill">${escapeHtml(season.venue_name || DEFAULT_VENUE_NAME)}</span>
                  <span class="tag-pill">Go live MD ${escapeHtml(season.model_start_matchday || 1)}</span>
                </div>
              </article>
            `;
          })
          .join("");
      }

      function renderMatchdays() {
        if (!selectedSeasonId) {
          selectedSeasonPill.textContent = "No campaign selected";
          matchdayBoardCopy.textContent =
            "Choose a campaign to load its matchdays. Match Centre only uses players already added to that season squad.";
          matchdayGrid.innerHTML = `
            <div class="empty-state">
              Select a season card to open the schedule and assign each kickoff.
            </div>
          `;
          return;
        }

        const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);

        if (!selectedSeason) {
          selectedSeasonId = null;
          renderSeasons();
          renderMatchdays();
          return;
        }

        const matchdays = selectedSeason.matchdays || [];
        const seasonRosterCount = (selectedSeason.seasonPlayers || []).length;
        selectedSeasonPill.textContent = selectedSeason.name;
        matchdayBoardCopy.textContent = `${selectedSeason.name} has ${seasonRosterCount} active squad players who can appear in Match Centre, League Table, Planner, and club screens. Tier targets are ${selectedSeason.core_spots} Core and ${selectedSeason.rotation_spots} Rotation, with the current queue model starting at matchday ${selectedSeason.model_start_matchday || 1}. ${
          selectedSeason.season_start_date
            ? `Default nights are ${weekdayLabel(selectedSeason.default_matchday_weekday)} at ${formatTimeLabel(
                selectedSeason.default_kickoff_time
              )} at ${selectedSeason.venue_name || DEFAULT_VENUE_NAME}.`
            : "Kickoffs are still being scheduled manually."
        }`;

        matchdayGrid.innerHTML = matchdays
          .map(
            (matchday) => `
              <article class="matchday-card">
                <div class="matchday-head">
                  <div>
                    <h3 class="matchday-name">Matchday ${escapeHtml(matchday.matchday_number)}</h3>
                    <p class="matchday-meta">
                      ${
                        matchday.kickoff_at
                          ? `Kickoff ${escapeHtml(formatDateTime(matchday.kickoff_at))}`
                          : "Kickoff not scheduled"
                      }
                    </p>
                    <p class="matchday-meta">${escapeHtml(selectedSeason.venue_name || DEFAULT_VENUE_NAME)}</p>
                  </div>
                  <div class="matchday-tags">
                    <span class="state-pill ${matchday.kickoff_at ? "scheduled" : "pending"}">
                      ${matchday.kickoff_at ? "Scheduled" : "Pending"}
                    </span>
                    <span class="state-pill ${matchday.goals_count_as_points ? "scheduled" : "pending"}">
                      ${matchday.goals_count_as_points ? "Goals count" : "Tiebreak only"}
                    </span>
                  </div>
                </div>

                <form class="matchday-form" data-matchday-id="${matchday.id}">
                  <div class="field">
                    <label for="kickoff-${matchday.id}">Date and time</label>
                    <input
                      id="kickoff-${matchday.id}"
                      name="kickoff-${matchday.id}"
                      type="datetime-local"
                      data-default-kickoff-time="${matchday.kickoff_at ? "" : selectedSeason.default_kickoff_time}"
                      value="${matchday.kickoff_at ? escapeHtml(formatDateTimeLocalValue(matchday.kickoff_at)) : ""}"
                    />
                  </div>

                  <div class="actions">
                    <button class="primary-button" type="submit">Save kickoff</button>
                    <a class="ghost-link" href="./matchday.html?season_id=${selectedSeason.id}&matchday_id=${matchday.id}">Open match center</a>
                  </div>
                </form>
              </article>
            `
          )
          .join("");
      }

      function renderSeasonRoster() {
        if (!selectedSeasonId) {
          lastRosterDisclosureSeasonId = null;
          rosterSeasonPill.textContent = "Choose a campaign";
          rosterBoardCopy.textContent = "Choose a campaign to decide which squad players become active this season. Flow: Squad Register -> Season squad -> Availability -> Match Centre -> League Table -> Planner -> Club HQ.";
          openTiersLink.href = "./tiers.html";
          selectedSeasonStartDateInput.value = "";
          selectedSeasonWeekdayInput.value = String(DEFAULT_MATCHDAY_WEEKDAY);
          selectedSeasonKickoffTimeInput.value = DEFAULT_KICKOFF_LOCAL_TIME;
          selectedSeasonVenueNameInput.value = DEFAULT_VENUE_NAME;
          selectedCoreSpotsInput.value = "18";
          selectedRotationSpotsInput.value = "10";
          selectedModelStartMatchdayInput.value = "1";
          setSeasonSettingsLocked(true);
          seasonSettingsNote.textContent = "Choose a campaign first. These settings control the weekly queue and the matchday where the current model begins.";
          seasonRosterAddSelect.innerHTML = `<option value="">Select a player from the squad register</option>`;
          seasonRosterRegistrationTierSelect.value = "rotation";
          seasonRosterTierStatusSelect.value = "rotation";
          seasonRosterPaymentStatusSelect.value = "unknown";
          seedRosterButton.disabled = true;
          syncSeasonTierButton.disabled = true;
          syncSeasonTierButton.textContent = "Use squad tier status";
          if (rosterBulkNote) {
            rosterBulkNote.textContent = "For now, bulk add uses the current / next-season tier from Squad and only pulls players marked Core or Rotation.";
          }
          seasonDirectoryPrepSummary.innerHTML = `
            <div class="summary-card">
              <span>Addable players</span>
              <strong>${escapeHtml(clubPlayers.length)}</strong>
            </div>
            <div class="summary-card">
              <span>Core</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Rotation</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Flex/Sub</span>
              <strong>0</strong>
            </div>
          `;
          seasonDirectoryPrepWrap.innerHTML = `<div class="table-empty">Select a season first.</div>`;
          rosterSummaryGrid.innerHTML = `
            <div class="summary-card">
              <span>Directory players</span>
              <strong>${escapeHtml(clubPlayers.length)}</strong>
            </div>
            <div class="summary-card">
              <span>Active roster</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Not added yet</span>
              <strong>${escapeHtml(clubPlayers.length)}</strong>
            </div>
            <div class="summary-card">
              <span>Core</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Rotation</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Flex/Sub</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Paid</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Pending</span>
              <strong>0</strong>
            </div>
            <div class="summary-card">
              <span>Unknown</span>
              <strong>0</strong>
            </div>
          `;
          seasonRosterWrap.innerHTML = `<div class="table-empty">Select a season first.</div>`;
          openRosterDisclosure("settings");
          return;
        }

        const selectedSeason = getSelectedSeason();

        if (!selectedSeason) {
          selectedSeasonId = null;
          renderSeasons();
          renderSeasonRoster();
          renderMatchdays();
          return;
        }

        const rosterRows = seasonRosterRowsForSeason(selectedSeason);
        const searchValue = normalizeText(seasonRosterSearch.value).toLowerCase();
        const filteredRoster = rosterRows.filter((row) => {
          if (!searchValue) {
            return true;
          }

          const haystack = [
            row.player.first_name,
            row.player.last_name,
            row.player.nickname || "",
            row.player.nationality || "",
            row.tier_status,
            row.registration_tier,
            row.payment_status,
            row.player.status,
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(searchValue);
        });
        const seasonPlayerIds = new Set(rosterRows.map((row) => row.player_id));
        const addablePlayers = [...clubPlayers]
          .filter((player) => !seasonPlayerIds.has(player.id))
          .sort(comparePlayers);
        const addableCorePlayers = addablePlayers.filter((player) => player.status === "core");
        const addableRotationPlayers = addablePlayers.filter((player) => player.status === "rotation");
        const addableCoreRotationPlayers = addablePlayers.filter(
          (player) => player.status === "core" || player.status === "rotation"
        );
        const addableFlexPlayers = addablePlayers.filter((player) => player.status === "flex_sub");
        const coreCount = rosterRows.filter((row) => row.tier_status === "core").length;
        const rotationCount = rosterRows.filter((row) => row.tier_status === "rotation").length;
        const flexCount = rosterRows.filter((row) => row.tier_status === "flex_sub").length;
        const paidCount = rosterRows.filter((row) => row.payment_status === "paid").length;
        const pendingCount = rosterRows.filter((row) => row.payment_status === "pending").length;
        const unknownCount = rosterRows.filter((row) => row.payment_status === "unknown").length;
        const tierSyncRows = rosterTierSyncRows(rosterRows);

        if (selectedSeason.id !== lastRosterDisclosureSeasonId) {
          openRosterDisclosure(rosterRows.length ? "players" : "tools");
          lastRosterDisclosureSeasonId = selectedSeason.id;
        }

        rosterSeasonPill.textContent = selectedSeason.name;
        rosterBoardCopy.textContent = `${selectedSeason.name} has ${rosterRows.length} season registrations out of ${clubPlayers.length} squad profiles. Only rostered players appear in Match Centre, League Table, Planner, and club screens. Queue tracking begins at matchday ${selectedSeason.model_start_matchday || 1}, so earlier nights remain historical. ${
          seasonRosterMetadataSupported
            ? "Store what each player signed up for, whether they paid, and whether they are still active for matchdays. Use the Squad Register to set current / next-season tiers first, then bulk add current Core + Rotation."
            : "Use the Squad Register to set current / next-season tiers first, then bulk add current Core + Rotation."
        }`;
        openTiersLink.href = `./tiers.html?season_id=${selectedSeasonId}`;
        seedRosterButton.disabled = !addableCoreRotationPlayers.length;
        syncSeasonTierButton.disabled = !rosterRows.length;
        syncSeasonTierButton.textContent = rosterRows.length
          ? `Use squad tier status${selectedSeason.name ? ` for ${selectedSeason.name}` : ""}`
          : "Use squad tier status";
        selectedCoreSpotsInput.value = String(selectedSeason.core_spots);
        selectedRotationSpotsInput.value = String(selectedSeason.rotation_spots);
        selectedModelStartMatchdayInput.value = String(selectedSeason.model_start_matchday || 1);
        selectedSeasonStartDateInput.value = selectedSeason.season_start_date || "";
        selectedSeasonWeekdayInput.value = String(selectedSeason.default_matchday_weekday);
        selectedSeasonKickoffTimeInput.value = selectedSeason.default_kickoff_time;
        selectedSeasonVenueNameInput.value = selectedSeason.venue_name || DEFAULT_VENUE_NAME;
        setSeasonSettingsLocked(false);
        seasonSettingsNote.textContent = seasonScheduleDefaultsSupported
          ? `These settings apply to ${selectedSeason.name}. Queue fairness and pathway review only count completed matchdays on or after matchday ${selectedSeason.model_start_matchday || 1}. Fill unscheduled matchdays from the saved weekly defaults whenever you are ready.`
          : `These settings apply to ${selectedSeason.name}. Weekly fixture defaults are still in basic mode on this club build, so save kickoffs one by one for now.`;
        seasonRosterAddSelect.innerHTML = `
          <option value="">Select a player from the squad register</option>
          ${addablePlayers
            .map(
              (player) =>
                `<option value="${player.id}">${escapeHtml(displayName(player))} · current/next-season ${escapeHtml(formatTierLabel(player.status))}</option>`
            )
            .join("")}
        `;
        syncRosterAddDefaultsFromSelection();
        if (rosterBulkNote) {
          const bulkCopy = addableCoreRotationPlayers.length
            ? `${addableCorePlayers.length} addable squad players are currently marked Core and ${addableRotationPlayers.length} are marked Rotation. Use Add current Core + Rotation to pull only those players into ${selectedSeason.name}.`
            : `No addable squad players are currently marked Core or Rotation. Update player tiers in Squad first, then use Add current Core + Rotation.`;
          const syncCopy = rosterRows.length
            ? tierSyncRows.length
              ? `${tierSyncRows.length} rostered players in ${selectedSeason.name} currently differ from the Squad page tier status. Use squad tier status to align this season.`
              : `${selectedSeason.name} already matches the Squad page tier status for every rostered player.`
            : "";
          rosterBulkNote.textContent = syncCopy ? `${bulkCopy} ${syncCopy}` : bulkCopy;
        }
        seasonDirectoryPrepSummary.innerHTML = `
          <div class="summary-card">
            <span>Addable players</span>
            <strong>${escapeHtml(addablePlayers.length)}</strong>
          </div>
          <div class="summary-card">
            <span>Core</span>
            <strong>${escapeHtml(addableCorePlayers.length)}</strong>
          </div>
          <div class="summary-card">
            <span>Rotation</span>
            <strong>${escapeHtml(addableRotationPlayers.length)}</strong>
          </div>
          <div class="summary-card">
            <span>Flex/Sub</span>
            <strong>${escapeHtml(addableFlexPlayers.length)}</strong>
          </div>
        `;
        if (!addablePlayers.length) {
          seasonDirectoryPrepWrap.innerHTML = `
            <div class="table-empty">
              Every squad player is already on ${escapeHtml(selectedSeason.name)}. Use the squad controls below to review season tiers and activity.
            </div>
          `;
        } else {
          seasonDirectoryPrepWrap.innerHTML = `
            <div class="compact-list">
              ${addablePlayers
                .map(
                  (player) => `
                    <article class="compact-row">
                      <div class="compact-row-main">
                        <div>
                          <div class="compact-row-title">${escapeHtml(displayName(player))}</div>
                          <p class="compact-row-copy">${escapeHtml(
                            [player.nationality || "Directory player", ...(player.positions || [])]
                              .filter(Boolean)
                              .join(" · ")
                          )}</p>
                        </div>
                      </div>
                      <div class="compact-badges">
                        <span class="tag-pill">${escapeHtml(
                          player.status === "flex_sub" ? "Not in bulk add" : "Will bulk add"
                        )}</span>
                      </div>
                      <div class="field">
                        <label for="directory-prep-tier-${player.id}">Current / next-season tier</label>
                        <select
                          id="directory-prep-tier-${player.id}"
                          data-directory-prep-tier="${player.id}"
                          ${savingDirectoryTierPlayerIds.has(player.id) ? "disabled" : ""}
                        >
                          ${tierOptionsMarkup(player.status)}
                        </select>
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>
          `;
        }

        rosterSummaryGrid.innerHTML = `
          <div class="summary-card">
            <span>Directory players</span>
            <strong>${escapeHtml(clubPlayers.length)}</strong>
          </div>
          <div class="summary-card">
            <span>Active roster</span>
            <strong>${escapeHtml(rosterRows.length)}</strong>
          </div>
          <div class="summary-card">
            <span>Not added yet</span>
            <strong>${escapeHtml(addablePlayers.length)}</strong>
          </div>
          <div class="summary-card">
            <span>Core</span>
            <strong>${escapeHtml(coreCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Rotation</span>
            <strong>${escapeHtml(rotationCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Flex/Sub</span>
            <strong>${escapeHtml(flexCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Core target</span>
            <strong>${escapeHtml(selectedSeason.core_spots)}</strong>
          </div>
          <div class="summary-card">
            <span>Rotation target</span>
            <strong>${escapeHtml(selectedSeason.rotation_spots)}</strong>
          </div>
          <div class="summary-card">
            <span>Paid</span>
            <strong>${escapeHtml(paidCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Pending</span>
            <strong>${escapeHtml(pendingCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Unknown</span>
            <strong>${escapeHtml(unknownCount)}</strong>
          </div>
        `;

        if (!rosterRows.length) {
          seasonRosterWrap.innerHTML = `
            <div class="table-empty">
              No players are in ${escapeHtml(selectedSeason.name)} yet. Add them one by one or use
              <strong>Add current Core + Rotation</strong> as a starting point.
            </div>
          `;
          return;
        }

        if (!filteredRoster.length) {
          seasonRosterWrap.innerHTML = `<div class="table-empty">No active roster players match the current search.</div>`;
          return;
        }

        seasonRosterWrap.innerHTML = `
          <div class="compact-list">
            ${filteredRoster
              .map(
                (row) => `
                  <article class="compact-row" data-season-player-row="${row.id}">
                    <div class="compact-row-main">
                      <div>
                        <div class="compact-row-title">${escapeHtml(displayName(row.player))}</div>
                        <p class="compact-row-copy">${escapeHtml(row.player.nationality || "Directory player")}</p>
                      </div>
                    </div>
                    <div class="compact-badges">
                      <span class="tag-pill">Requested season tier ${escapeHtml(formatTierLabel(row.registration_tier))}</span>
                      <span class="tag-pill">This season tier ${escapeHtml(formatTierLabel(row.tier_status))}</span>
                      ${
                        row.player.status !== row.tier_status
                          ? `<span class="tag-pill">Current / next-season tier ${escapeHtml(formatTierLabel(row.player.status))}</span>`
                          : ""
                      }
                      <span class="tag-pill">${escapeHtml(formatPaymentStatusLabel(row.payment_status))}</span>
                      <span class="tag-pill">${escapeHtml(row.is_eligible ? "Active for matchdays" : "Inactive for matchdays")}</span>
                    </div>
                    <div class="field-grid">
                      <div class="field">
                        <label for="season-player-registration-${row.id}">Requested season tier</label>
                        <select
                          id="season-player-registration-${row.id}"
                          data-season-player-registration="${row.id}"
                          ${seasonRosterMetadataSupported ? "" : "disabled"}
                        >
                          ${tierOptionsMarkup(row.registration_tier)}
                        </select>
                      </div>
                      <div class="field">
                        <label for="season-player-tier-${row.id}">This season tier</label>
                        <select id="season-player-tier-${row.id}" data-season-player-tier="${row.id}">
                          ${tierOptionsMarkup(row.tier_status)}
                        </select>
                      </div>
                      <div class="field">
                        <label for="season-player-payment-${row.id}">Payment</label>
                        <select
                          id="season-player-payment-${row.id}"
                          data-season-player-payment="${row.id}"
                          ${seasonRosterMetadataSupported ? "" : "disabled"}
                        >
                          ${paymentOptionsMarkup(row.payment_status)}
                        </select>
                      </div>
                      <div class="field">
                        <label for="season-player-eligible-${row.id}">Matchday status</label>
                        <select id="season-player-eligible-${row.id}" data-season-player-eligible="${row.id}">
                          <option value="true" ${row.is_eligible ? "selected" : ""}>Active</option>
                          <option value="false" ${row.is_eligible ? "" : "selected"}>Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div class="actions">
                      <button class="primary-button" type="button" data-save-season-player="${row.id}">Save roster entry</button>
                      <button class="secondary-button" type="button" data-remove-season-player="${row.id}">Remove</button>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        `;
      }

      function buildSeasonPlayerInsertPayload(selectedSeason, player, overrides = {}) {
        const registrationTier = normalizeText(
          overrides.registration_tier || player.desired_tier || player.status || "rotation"
        ).toLowerCase();
        const payload = {
          season_id: selectedSeason.id,
          player_id: player.id,
          tier_status: normalizeText(overrides.tier_status || registrationTier).toLowerCase(),
          tier_reason: overrides.tier_reason || "Added from the player registry desired tier.",
          movement_note:
            overrides.movement_note || "Season roster controls matchday and standings visibility.",
          is_eligible: overrides.is_eligible !== false,
        };

        if (seasonRosterMetadataSupported) {
          payload.registration_tier = registrationTier;
          payload.payment_status = normalizePaymentStatus(overrides.payment_status);
        }

        return payload;
      }

      async function saveSeasonPlayer(seasonPlayerId) {
        const selectedSeason = getSelectedSeason();
        const row = (selectedSeason?.seasonPlayers || [])
          .map(normalizeSeasonPlayerRow)
          .find((entry) => entry.id === seasonPlayerId);
        const card = seasonRosterWrap.querySelector(`[data-season-player-row="${seasonPlayerId}"]`);

        if (!selectedSeason || !row || !card) {
          setStatus("Season roster row not found. Refresh the page and try again.", "error");
          return;
        }

        const registrationTierInput = card.querySelector(`[data-season-player-registration="${seasonPlayerId}"]`);
        const tierStatusInput = card.querySelector(`[data-season-player-tier="${seasonPlayerId}"]`);
        const paymentStatusInput = card.querySelector(`[data-season-player-payment="${seasonPlayerId}"]`);
        const eligibilityInput = card.querySelector(`[data-season-player-eligible="${seasonPlayerId}"]`);
        const saveButton = card.querySelector(`[data-save-season-player="${seasonPlayerId}"]`);
        const player = clubPlayers.find((entry) => entry.id === row.player_id);

        const payload = {
          tier_status: normalizeText(tierStatusInput?.value || row.tier_status).toLowerCase(),
          is_eligible: String(eligibilityInput?.value || row.is_eligible) === "true",
        };

        if (seasonRosterMetadataSupported) {
          payload.registration_tier = normalizeText(
            registrationTierInput?.value || row.registration_tier
          ).toLowerCase();
          payload.payment_status = normalizePaymentStatus(paymentStatusInput?.value || row.payment_status);
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
        setStatus(`Saving the ${player ? displayName(player) : "player"} season record...`);

        try {
          const { error } = await supabaseClient
            .from("season_players")
            .update(payload)
            .eq("id", seasonPlayerId);

          if (error) {
            throw error;
          }

          await loadSeasons();
          setStatus(
            `${player ? displayName(player) : "Season player"} updated for ${selectedSeason.name}.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          saveButton.disabled = false;
          saveButton.textContent = "Save roster entry";
        }
      }

      async function fillUnscheduledMatchdaysFromDefaults() {
        const selectedSeason = getSelectedSeason();

        if (!selectedSeason) {
          setStatus("Select a season first.", "warning");
          return;
        }

        if (!seasonScheduleDefaultsSupported) {
          setStatus("Weekly fixture defaults are not available on this club build yet.", "warning");
          return;
        }

        const seasonStartDate = normalizeText(selectedSeasonStartDateInput.value || "");
        const defaultWeekday = normalizeWeekdayValue(selectedSeasonWeekdayInput.value);
        const defaultKickoffTime = normalizeTimeValue(selectedSeasonKickoffTimeInput.value, DEFAULT_KICKOFF_LOCAL_TIME);
        const venueName = normalizeText(selectedSeasonVenueNameInput.value || DEFAULT_VENUE_NAME) || DEFAULT_VENUE_NAME;

        if (!seasonStartDate) {
          setStatus("Add a start date before filling unscheduled matchdays.", "warning");
          return;
        }

        const generatedKickoffs = buildSeasonKickoffSchedule(
          Number(selectedSeason.total_matchdays || 0),
          seasonStartDate,
          defaultWeekday,
          defaultKickoffTime
        );
        const pendingMatchdays = (selectedSeason.matchdays || []).filter((matchday) => !matchday.kickoff_at);

        if (!pendingMatchdays.length) {
          setStatus("Every matchday already has a kickoff time.", "warning");
          return;
        }

        applyScheduleDefaultsButton.disabled = true;
        applyScheduleDefaultsButton.textContent = "Filling...";
        setStatus(`Applying weekly defaults to ${pendingMatchdays.length} unscheduled matchdays...`);

        try {
          const seasonUpdateError = await supabaseClient
            .from("seasons")
            .update({
              season_start_date: seasonStartDate,
              default_matchday_weekday: defaultWeekday,
              default_kickoff_time: defaultKickoffTime,
              venue_name: venueName,
            })
            .eq("id", selectedSeason.id)
            .then(({ error }) => error);

          if (seasonUpdateError) {
            throw seasonUpdateError;
          }

          for (const matchday of pendingMatchdays) {
            const kickoffAt = generatedKickoffs[matchday.matchday_number - 1] || null;
            const { error } = await supabaseClient
              .from("matchdays")
              .update({ kickoff_at: kickoffAt })
              .eq("id", matchday.id);

            if (error) {
              throw error;
            }
          }

          await loadSeasons();
          setStatus(`Filled ${pendingMatchdays.length} unscheduled matchdays for ${selectedSeason.name}.`, "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          applyScheduleDefaultsButton.disabled = false;
          applyScheduleDefaultsButton.textContent = "Fill unscheduled matchdays";
        }
      }

      async function addPlayerToSeason() {
        const selectedSeason = getSelectedSeason();
        const playerId = Number(seasonRosterAddSelect.value);

        if (!selectedSeason || !playerId) {
          setStatus("Choose a campaign and a player from the squad register.", "warning");
          return;
        }

        const player = clubPlayers.find((entry) => entry.id === playerId);

        if (!player) {
          setStatus("That squad profile was not found. Refresh and try again.", "error");
          return;
        }

        seasonRosterAddButton.disabled = true;
        seasonRosterAddButton.textContent = "Adding...";
        setStatus(`Adding ${displayName(player)} to ${selectedSeason.name}...`);

        const { error } = await supabaseClient
          .from("season_players")
          .insert(
            buildSeasonPlayerInsertPayload(selectedSeason, player, {
              registration_tier: seasonRosterRegistrationTierSelect.value,
              tier_status: seasonRosterTierStatusSelect.value,
              payment_status: seasonRosterPaymentStatusSelect.value,
              tier_reason: "Added from the squad register for this season signup.",
              movement_note: "Review payment and season tier before the next matchday.",
              is_eligible: true,
            })
          );

        seasonRosterAddButton.disabled = false;
        seasonRosterAddButton.textContent = "Add player to season";

        if (error) {
          setStatus(readableError(error), "error");
          return;
        }

        seasonRosterAddSelect.value = "";
        seasonRosterRegistrationTierSelect.value = "rotation";
        seasonRosterTierStatusSelect.value = "rotation";
        seasonRosterPaymentStatusSelect.value = "unknown";
        setStatus(`${displayName(player)} added to ${selectedSeason.name}.`, "success");
        openRosterDisclosure("players");
        await loadSeasons();
      }

      async function addCoreAndRotationDefaults() {
        const selectedSeason = getSelectedSeason();

        if (!selectedSeason) {
          setStatus("Select a season first.", "warning");
          return;
        }

        const existingIds = new Set((selectedSeason.seasonPlayers || []).map((row) => row.player_id));
        const rowsToInsert = clubPlayers
          .filter((player) => !existingIds.has(player.id))
          .filter((player) => player.status === "core" || player.status === "rotation")
          .map((player) =>
            buildSeasonPlayerInsertPayload(selectedSeason, player, {
              registration_tier: player.status,
              tier_status: player.status,
              payment_status: "unknown",
              tier_reason: "Seeded from current desired core/rotation tiers.",
              movement_note: "Review signup details before the season starts.",
              is_eligible: true,
            })
          );

        if (!rowsToInsert.length) {
          setStatus("No missing desired core or rotation players to add.", "warning");
          return;
        }

        seedRosterButton.disabled = true;
        seedRosterButton.textContent = "Adding...";
        setStatus(`Adding ${rowsToInsert.length} current core/rotation players to ${selectedSeason.name}...`);

        const { error } = await supabaseClient.from("season_players").insert(rowsToInsert);

        seedRosterButton.disabled = false;
        seedRosterButton.textContent = "Add current Core + Rotation";

        if (error) {
          setStatus(readableError(error), "error");
          return;
        }

        setStatus(`Added ${rowsToInsert.length} current core/rotation players to ${selectedSeason.name}.`, "success");
        openRosterDisclosure("players");
        await loadSeasons();
      }

      async function syncSeasonTiersFromDirectory() {
        const selectedSeason = getSelectedSeason();

        if (!selectedSeason) {
          setStatus("Select a season first.", "warning");
          return;
        }

        const rosterRows = seasonRosterRowsForSeason(selectedSeason);
        const rowsToSync = rosterTierSyncRows(rosterRows);

        if (!rowsToSync.length) {
          setStatus(
            `${selectedSeason.name} already matches the Squad page current / next-season tier for every rostered player.`,
            "success"
          );
          return;
        }

        syncSeasonTierButton.disabled = true;
        syncSeasonTierButton.textContent = "Syncing...";
        setStatus(
          `Applying the Squad page current / next-season tier to ${rowsToSync.length} rostered players in ${selectedSeason.name}...`
        );

        try {
          await Promise.all(
            rowsToSync.map((row) =>
              supabaseClient
                .from("season_players")
                .update({
                  tier_status: row.player.status,
                  tier_reason: "Aligned with the Squad page current / next-season tier.",
                  movement_note: "Season tier synced from the squad register status.",
                })
                .eq("id", row.id)
                .then(({ error }) => {
                  if (error) {
                    throw error;
                  }
                })
            )
          );

          openRosterDisclosure("players");
          await loadSeasons();
          setStatus(
            `${rowsToSync.length} rostered players in ${selectedSeason.name} now match the Squad page current / next-season tier.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          syncSeasonTierButton.disabled = false;
          syncSeasonTierButton.textContent = `Use squad tier status${selectedSeason.name ? ` for ${selectedSeason.name}` : ""}`;
        }
      }

      async function removeSeasonPlayer(seasonPlayerId) {
        const selectedSeason = getSelectedSeason();
        const row = (selectedSeason?.seasonPlayers || []).find((entry) => entry.id === seasonPlayerId);
        const player = clubPlayers.find((entry) => entry.id === row?.player_id);

        if (!row || !selectedSeason || !player) {
          setStatus("Season roster row not found. Refresh the page and try again.", "error");
          return;
        }

        const confirmed = window.confirm(
          `Remove ${displayName(player)} from ${selectedSeason.name}? They will disappear from Match Centre, League Table, Planner, and the club site for this season.`
        );

        if (!confirmed) {
          return;
        }

        setStatus(`Removing ${displayName(player)} from ${selectedSeason.name}...`);

        const { error } = await supabaseClient.from("season_players").delete().eq("id", seasonPlayerId);

        if (error) {
          setStatus(readableError(error), "error");
          return;
        }

        setStatus(`${displayName(player)} removed from ${selectedSeason.name}.`, "success");
        openRosterDisclosure("players");
        await loadSeasons();
      }

      async function loadSeasons() {
        setStatus("Loading seasons and schedule...", "loading");
        seasonScheduleDefaultsSupported = true;
        seasonRosterMetadataSupported = true;

        let [
          { data: seasonData, error: seasonError },
          { data: matchdayData, error: matchdayError },
          { data: playerData, error: playerError },
          { data: seasonPlayerData, error: seasonPlayerError },
        ] = await Promise.all([
          supabaseClient
            .from("seasons")
            .select(
              "id, name, total_matchdays, core_spots, rotation_spots, model_start_matchday, season_start_date, default_matchday_weekday, default_kickoff_time, venue_name, created_at"
            )
            .order("created_at", { ascending: false }),
          supabaseClient
            .from("matchdays")
            .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points, created_at")
            .order("matchday_number", { ascending: true }),
          supabaseClient
            .from("players")
            .select("id, first_name, last_name, nickname, nationality, desired_tier, status")
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true }),
          supabaseClient
            .from("season_players")
            .select("id, season_id, player_id, tier_status, registration_tier, payment_status, is_eligible, created_at")
            .order("created_at", { ascending: true }),
        ]);

        if (seasonError && hasMissingSeasonScheduleColumns(seasonError)) {
          seasonScheduleDefaultsSupported = false;
          ({ data: seasonData, error: seasonError } = await supabaseClient
            .from("seasons")
            .select("id, name, total_matchdays, core_spots, rotation_spots, model_start_matchday, created_at")
            .order("created_at", { ascending: false }));
        }

        if (playerError && hasMissingDesiredTierColumn(playerError)) {
          ({ data: playerData, error: playerError } = await supabaseClient
            .from("players")
            .select("id, first_name, last_name, nickname, nationality, status")
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true }));
        }

        if (seasonPlayerError && hasMissingSeasonRosterMetadataColumns(seasonPlayerError)) {
          seasonRosterMetadataSupported = false;
          ({ data: seasonPlayerData, error: seasonPlayerError } = await supabaseClient
            .from("season_players")
            .select("id, season_id, player_id, tier_status, is_eligible, created_at")
            .order("created_at", { ascending: true }));
        }

        if (seasonError || matchdayError || playerError || seasonPlayerError) {
          seasons = [];
          clubPlayers = [];
          selectedSeasonId = null;
          updateHeroStats();
          renderSeasons();
          renderSeasonRoster();
          renderMatchdays();
          setStatus(readableError(seasonError || matchdayError || playerError || seasonPlayerError), "error");
          return;
        }

        const groupedMatchdays = new Map();
        const groupedSeasonPlayers = new Map();

        (matchdayData || []).forEach((matchday) => {
          const existing = groupedMatchdays.get(matchday.season_id) || [];
          existing.push(matchday);
          groupedMatchdays.set(matchday.season_id, existing);
        });

        (seasonPlayerData || []).forEach((seasonPlayer) => {
          const existing = groupedSeasonPlayers.get(seasonPlayer.season_id) || [];
          existing.push(normalizeSeasonPlayerRow(seasonPlayer));
          groupedSeasonPlayers.set(seasonPlayer.season_id, existing);
        });

        clubPlayers = (playerData || []).map(normalizeDesiredTierPlayer);

        seasons = sortSeasonsChronologically(
          (seasonData || []).map((season) => ({
            ...normalizeSeasonConfig(season),
            matchdays: groupedMatchdays.get(season.id) || [],
            seasonPlayers: groupedSeasonPlayers.get(season.id) || [],
          }))
        );

        if (!selectedSeasonId && seasons.length) {
          selectedSeasonId = seasons[seasons.length - 1].id;
        }

        if (selectedSeasonId && !seasons.some((season) => season.id === selectedSeasonId)) {
          selectedSeasonId = seasons[seasons.length - 1]?.id || null;
        }

        updateSeasonUrl();
        updateHeroStats();
        renderSeasons();
        renderSeasonRoster();
        renderMatchdays();

        if (!seasonScheduleDefaultsSupported || !seasonRosterMetadataSupported) {
          setStatus("Connected. Weekly fixture defaults and signup metadata are still in basic mode on this build.", "warning");
          return;
        }

        setStatus("Connected. Launch a campaign, load its signups, and schedule kickoff times.", "success");
      }

      async function createSeason(event) {
        event.preventDefault();

        const name = normalizeText(seasonNameInput.value);
        const totalMatchdays = Number(totalMatchdaysInput.value);
        const coreSpots = Number(coreSpotsInput.value);
        const rotationSpots = Number(rotationSpotsInput.value);
        const modelStartMatchday = Number(modelStartMatchdayInput.value);
        const seasonStartDate = normalizeText(seasonStartDateInput.value || "");
        const defaultMatchdayWeekday = normalizeWeekdayValue(seasonWeekdayInput.value);
        const defaultKickoffTime = normalizeTimeValue(seasonKickoffTimeInput.value, DEFAULT_KICKOFF_LOCAL_TIME);
        const venueName = normalizeText(seasonVenueNameInput.value || DEFAULT_VENUE_NAME) || DEFAULT_VENUE_NAME;

        if (name.length < 3) {
          setStatus("Season name needs at least 3 characters.", "error");
          return;
        }

        if (!Number.isInteger(totalMatchdays) || totalMatchdays < 1 || totalMatchdays > 60) {
          setStatus("Matchdays must be a whole number between 1 and 60.", "error");
          return;
        }

        if (!Number.isInteger(coreSpots) || coreSpots < 0 || coreSpots > 60) {
          setStatus("Core spots must be a whole number between 0 and 60.", "error");
          return;
        }

        if (!Number.isInteger(rotationSpots) || rotationSpots < 0 || rotationSpots > 60) {
          setStatus("Rotation spots must be a whole number between 0 and 60.", "error");
          return;
        }

        if (
          !Number.isInteger(modelStartMatchday) ||
          modelStartMatchday < 1 ||
          modelStartMatchday > totalMatchdays
        ) {
          setStatus("Queue start matchday must be a whole number between 1 and the total matchdays.", "error");
          return;
        }

        if (coreSpots + rotationSpots < 1) {
          setStatus("Add at least one core or rotation spot for the next season.", "error");
          return;
        }

        if (venueName.length < 3 || venueName.length > 80) {
          setStatus("Venue name must be between 3 and 80 characters.", "error");
          return;
        }

        seasonSubmitButton.disabled = true;
        seasonSubmitButton.textContent = "Creating...";
        setStatus(`Creating ${name}...`);

        const seasonPayload = {
          name,
          total_matchdays: totalMatchdays,
          core_spots: coreSpots,
          rotation_spots: rotationSpots,
          model_start_matchday: modelStartMatchday,
        };

        if (seasonScheduleDefaultsSupported) {
          seasonPayload.season_start_date = seasonStartDate || null;
          seasonPayload.default_matchday_weekday = defaultMatchdayWeekday;
          seasonPayload.default_kickoff_time = defaultKickoffTime;
          seasonPayload.venue_name = venueName;
        }

        const { data: seasonRow, error: seasonError } = await supabaseClient
          .from("seasons")
          .insert(seasonPayload)
          .select("id, name, total_matchdays, core_spots, rotation_spots, model_start_matchday, created_at")
          .single();

        if (seasonError) {
          seasonSubmitButton.disabled = false;
          seasonSubmitButton.textContent = "Create season";
          setStatus(readableError(seasonError), "error");
          return;
        }

        const kickoffSchedule = seasonScheduleDefaultsSupported
          ? buildSeasonKickoffSchedule(
              totalMatchdays,
              seasonStartDate,
              defaultMatchdayWeekday,
              defaultKickoffTime
            )
          : [];
        const matchdayRows = Array.from({ length: totalMatchdays }, (_, index) => ({
          season_id: seasonRow.id,
          matchday_number: index + 1,
          kickoff_at: kickoffSchedule[index] || null,
        }));

        const { error: matchdayError } = await supabaseClient.from("matchdays").insert(matchdayRows);

        seasonSubmitButton.disabled = false;
        seasonSubmitButton.textContent = "Create season";

        if (matchdayError) {
          setStatus(`Season created, but matchdays failed: ${readableError(matchdayError)}`, "warning");
          await loadSeasons();
          return;
        }

        seasonForm.reset();
        totalMatchdaysInput.value = "10";
        coreSpotsInput.value = "18";
        rotationSpotsInput.value = "10";
        modelStartMatchdayInput.value = "1";
        seasonWeekdayInput.value = String(DEFAULT_MATCHDAY_WEEKDAY);
        seasonKickoffTimeInput.value = DEFAULT_KICKOFF_LOCAL_TIME;
        seasonVenueNameInput.value = DEFAULT_VENUE_NAME;
        selectedSeasonId = seasonRow.id;
        setStatus(
          `${name} created with ${totalMatchdays} matchdays, ${coreSpots} Core spots, ${rotationSpots} Rotation spots, and queue tracking starting at matchday ${modelStartMatchday}.${
            seasonStartDate
              ? ` Weekly kickoffs were prebuilt for ${weekdayLabel(defaultMatchdayWeekday)} at ${formatTimeLabel(
                  defaultKickoffTime
                )} at ${venueName}.`
              : ""
          }`,
          "success"
        );
        await loadSeasons();
        setSeasonView("roster", { scroll: true });
      }

      async function saveSeasonSettings() {
        const selectedSeason = getSelectedSeason();

        if (!selectedSeason) {
          setStatus("Select a season first.", "warning");
          return;
        }

        const coreSpots = Number(selectedCoreSpotsInput.value);
        const rotationSpots = Number(selectedRotationSpotsInput.value);
        const modelStartMatchday = Number(selectedModelStartMatchdayInput.value);
        const seasonStartDate = normalizeText(selectedSeasonStartDateInput.value || "");
        const defaultMatchdayWeekday = normalizeWeekdayValue(selectedSeasonWeekdayInput.value);
        const defaultKickoffTime = normalizeTimeValue(
          selectedSeasonKickoffTimeInput.value,
          DEFAULT_KICKOFF_LOCAL_TIME
        );
        const venueName = normalizeText(selectedSeasonVenueNameInput.value || DEFAULT_VENUE_NAME) || DEFAULT_VENUE_NAME;

        if (!Number.isInteger(coreSpots) || coreSpots < 0 || coreSpots > 60) {
          setStatus("Live core spots must be a whole number between 0 and 60.", "error");
          return;
        }

        if (!Number.isInteger(rotationSpots) || rotationSpots < 0 || rotationSpots > 60) {
          setStatus("Live rotation spots must be a whole number between 0 and 60.", "error");
          return;
        }

        if (coreSpots + rotationSpots < 1) {
          setStatus("Add at least one live core or rotation spot.", "error");
          return;
        }

        if (
          !Number.isInteger(modelStartMatchday) ||
          modelStartMatchday < 1 ||
          modelStartMatchday > Number(selectedSeason.total_matchdays || 0)
        ) {
          setStatus("Queue start matchday must be within this season's matchday count.", "error");
          return;
        }

        if (venueName.length < 3 || venueName.length > 80) {
          setStatus("Venue name must be between 3 and 80 characters.", "error");
          return;
        }

        try {
          saveSeasonSettingsButton.disabled = true;
          saveSeasonSettingsButton.textContent = "Saving...";
          setStatus(`Saving season settings for ${selectedSeason.name}...`);

          const payload = {
            core_spots: coreSpots,
            rotation_spots: rotationSpots,
            model_start_matchday: modelStartMatchday,
          };

          if (seasonScheduleDefaultsSupported) {
            payload.season_start_date = seasonStartDate || null;
            payload.default_matchday_weekday = defaultMatchdayWeekday;
            payload.default_kickoff_time = defaultKickoffTime;
            payload.venue_name = venueName;
          }

          const { error } = await supabaseClient
            .from("seasons")
            .update(payload)
            .eq("id", selectedSeason.id);

          if (error) {
            throw error;
          }

          await loadSeasons();
          setStatus(
            `Season settings saved for ${selectedSeason.name}.${seasonScheduleDefaultsSupported ? ` Weekly defaults now point to ${weekdayLabel(defaultMatchdayWeekday)} at ${formatTimeLabel(defaultKickoffTime)} at ${venueName}.` : ""}`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          saveSeasonSettingsButton.disabled = false;
          saveSeasonSettingsButton.textContent = "Save season settings";
        }
      }

      async function saveKickoff(matchdayId, kickoffValue, button) {
        button.disabled = true;
        button.textContent = "Saving...";
        setStatus("Saving matchday kickoff...");

        const kickoffAt = kickoffValue ? new Date(kickoffValue).toISOString() : null;

        const { error } = await supabaseClient
          .from("matchdays")
          .update({ kickoff_at: kickoffAt })
          .eq("id", matchdayId);

        button.disabled = false;
        button.textContent = "Save kickoff";

        if (error) {
          setStatus(readableError(error), "error");
          return;
        }

        setStatus("Kickoff updated.", "success");
        await loadSeasons();
      }

      seasonForm.addEventListener("submit", createSeason);
      seasonRefreshButton.addEventListener("click", loadSeasons);
      rosterRefreshButton.addEventListener("click", loadSeasons);
      seedRosterButton.addEventListener("click", addCoreAndRotationDefaults);
      syncSeasonTierButton.addEventListener("click", syncSeasonTiersFromDirectory);
      saveSeasonSettingsButton.addEventListener("click", saveSeasonSettings);
      applyScheduleDefaultsButton.addEventListener("click", fillUnscheduledMatchdaysFromDefaults);
      seasonRosterAddButton.addEventListener("click", addPlayerToSeason);
      seasonRosterSearch.addEventListener("input", renderSeasonRoster);
      seasonRosterAddSelect.addEventListener("change", syncRosterAddDefaultsFromSelection);
      seasonViewTriggers.forEach((button) => {
        button.addEventListener("click", () => {
          setSeasonView(button.dataset.seasonViewTrigger, {
            focus: button.dataset.seasonViewTrigger === "create",
            scroll: true,
          });
        });
      });

      seasonGrid.addEventListener("click", async (event) => {
        const card = event.target.closest("[data-season-id]");

        if (!card) {
          return;
        }

        selectedSeasonId = Number(card.dataset.seasonId);
        setSeasonView("roster", { scroll: true });
        renderSeasons();
        renderSeasonRoster();
        renderMatchdays();
      });

      seasonRosterWrap.addEventListener("click", async (event) => {
        const saveButton = event.target.closest("[data-save-season-player]");
        const button = event.target.closest("[data-remove-season-player]");

        if (saveButton) {
          await saveSeasonPlayer(Number(saveButton.dataset.saveSeasonPlayer));
          return;
        }

        if (!button) {
          return;
        }

        await removeSeasonPlayer(Number(button.dataset.removeSeasonPlayer));
      });

      seasonDirectoryPrepWrap.addEventListener("change", async (event) => {
        const select = event.target.closest("[data-directory-prep-tier]");

        if (!select) {
          return;
        }

        await saveDirectoryTier(Number(select.dataset.directoryPrepTier), select.value);
      });

      matchdayGrid.addEventListener("submit", async (event) => {
        const form = event.target.closest("[data-matchday-id]");

        if (!form) {
          return;
        }

        event.preventDefault();

        const matchdayId = Number(form.dataset.matchdayId);
        const input = form.querySelector("input[type='datetime-local']");
        const button = form.querySelector("button[type='submit']");

        maybeApplyInputKickoffDefault(input);
        await saveKickoff(matchdayId, input.value, button);
      });

      matchdayGrid.addEventListener("change", (event) => {
        const input = event.target.closest("input[type='datetime-local']");

        if (!input) {
          return;
        }

        maybeApplyInputKickoffDefault(input);
      });

      window.addEventListener("hashchange", () => {
        setSeasonView(resolveSeasonView(), { updateHash: false });
      });

      setSeasonView(resolveSeasonView(), { updateHash: false });
      loadSeasons();
    
