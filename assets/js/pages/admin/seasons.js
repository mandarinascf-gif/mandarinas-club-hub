      const supabaseConfig = window.MandarinasSupabaseConfig;
      const { url: SUPABASE_URL } = supabaseConfig;

      const supabaseClient = supabaseConfig.createClient();
      const sortSeasonsChronologically =
        window.MandarinasLogic?.sortSeasonsChronologically || ((rows) => [...(rows || [])]);
      const normalizeTierValue =
        window.MandarinasLogic?.normalizeTierValue ||
        ((value, fallback = "flex") => {
          const normalized = normalizeText(value).toLowerCase();
          const compact = normalized.replace(/[\s/-]+/g, "_");

          if (normalized === "core" || normalized === "flex" || normalized === "sub") {
            return normalized;
          }

          if (compact === "rotation") return "flex";
          if (compact === "flex_sub") return "sub";
          return fallback;
        });

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
      const seasonRosterFlowRow = document.getElementById("season-roster-flow-row");
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
      const seasonRosterRequestSummary = document.getElementById("season-roster-request-summary");
      const seasonRosterRequestWrap = document.getElementById("season-roster-request-wrap");
      const seasonDirectoryPrepSummary = document.getElementById("season-directory-prep-summary");
      const seasonDirectoryPrepWrap = document.getElementById("season-directory-prep-wrap");
      const seasonRosterFilterRow = document.getElementById("season-roster-filter-row");
      const seasonRosterResultsNote = document.getElementById("season-roster-results-note");
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
      const seasonRosterRequestsDisclosure = document.getElementById("season-roster-requests-disclosure");
      const seasonDirectoryPrepDisclosure = document.getElementById("season-directory-prep-disclosure");
      const seasonRosterListDisclosure = document.getElementById("season-roster-list-disclosure");

      let seasons = [];
      let clubPlayers = [];
      let seasonRosterRequests = [];
      let selectedSeasonId = Number(params.get("season_id")) || null;
      let activeSeasonView = "list";
      let activeSeasonRosterFilter = "all";
      let editingSeasonPlayerId = null;
      let seasonScheduleDefaultsSupported = true;
      let seasonRosterMetadataSupported = true;
      let seasonRosterRequestsSupported = true;
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

      function hasMissingSeasonRosterRequestTable(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          message.includes("season_roster_requests") &&
          (
            message.includes("relation") ||
            message.includes("schema cache") ||
            message.includes("does not exist") ||
            message.includes("could not find")
          )
        );
      }

      function normalizeText(value) {
        return String(value || "").trim().replace(/\s+/g, " ");
      }

      function normalizeDesiredTierPlayer(player) {
        const desiredTier = normalizeTierValue(player?.desired_tier || player?.status, "flex");
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

      function showSeasonActionFailure(message) {
        setStatus(message, "error");
        if (message) {
          window.alert(message);
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

      function seasonRosterRequestsForSeason(selectedSeason) {
        const playerMap = new Map(clubPlayers.map((player) => [player.id, player]));

        return seasonRosterRequests
          .filter(
            (row) =>
              Number(row.season_id) === Number(selectedSeason?.id) &&
              normalizeText(row.status || "pending").toLowerCase() === "pending"
          )
          .map((row) => ({
            ...normalizeSeasonRosterRequestRow(row),
            player: row.player_id ? playerMap.get(row.player_id) || null : null,
          }))
          .sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
      }

      function rosterTierSyncRows(rows) {
        return (rows || []).filter((row) => row.player && row.player.status !== row.tier_status);
      }

      function formatTierLabel(value) {
        const normalized = normalizeTierValue(value, "");
        if (normalized === "sub") {
          return "Sub";
        }

        return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Flex";
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

      function seasonViewRequiresSeason(view) {
        return view === "roster" || view === "schedule";
      }

      function updateSeasonViewAvailability() {
        const hasSelectedSeason = Boolean(selectedSeasonId);

        seasonViewTriggers.forEach((button) => {
          const unavailable = seasonViewRequiresSeason(button.dataset.seasonViewTrigger) && !hasSelectedSeason;
          button.disabled = unavailable;
          button.setAttribute("aria-disabled", String(unavailable));

          if (unavailable) {
            button.title = "Select a season to unlock this view.";
          } else if (button.title === "Select a season to unlock this view.") {
            button.removeAttribute("title");
          }
        });
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
        const requestedView =
          view === "create" || view === "roster" || view === "schedule" ? view : "list";
        const nextView =
          seasonViewRequiresSeason(requestedView) && !selectedSeasonId ? "list" : requestedView;
        const {
          focus = false,
          scroll = false,
          updateHash = true,
        } = options;

        activeSeasonView = nextView;
        updateSeasonViewAvailability();

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
            openRosterDisclosure("players");
            seasonRosterSearch.focus();
          }
        }
      }

      function openRosterDisclosure(name) {
        const disclosures = {
          settings: seasonSettingsDisclosure,
          tools: seasonRosterToolsDisclosure,
          requests: seasonRosterRequestsDisclosure,
          prep: seasonDirectoryPrepDisclosure,
          players: seasonRosterListDisclosure,
        };

        Object.entries(disclosures).forEach(([key, disclosure]) => {
          if (!disclosure) {
            return;
          }

          disclosure.open = key === name;
        });

        syncRosterFlowRow();
      }

      function activeRosterDisclosureName() {
        if (seasonSettingsDisclosure?.open) {
          return "settings";
        }

        if (seasonRosterToolsDisclosure?.open) {
          return "tools";
        }

        if (seasonRosterRequestsDisclosure?.open) {
          return "requests";
        }

        if (seasonDirectoryPrepDisclosure?.open) {
          return "prep";
        }

        if (seasonRosterListDisclosure?.open) {
          return "players";
        }

        return "";
      }

      function syncRosterFlowRow() {
        if (!seasonRosterFlowRow) {
          return;
        }

        const activeDisclosure = activeRosterDisclosureName();
        seasonRosterFlowRow.querySelectorAll("[data-open-roster-disclosure]").forEach((button) => {
          button.classList.toggle(
            "active",
            button.dataset.openRosterDisclosure === activeDisclosure
          );
        });
      }

      function rosterFlowButtonLabel(label, count) {
        if (!Number.isFinite(count)) {
          return label;
        }

        return `${label} · ${count}`;
      }

      function renderRosterFlowRow(options = {}) {
        if (!seasonRosterFlowRow) {
          return;
        }

        const {
          disabled = false,
          pendingRequests = 0,
          addablePlayers = 0,
          rosterPlayers = 0,
        } = options;

        seasonRosterFlowRow.innerHTML = [
          {
            key: "requests",
            label: rosterFlowButtonLabel("Requests", pendingRequests),
          },
          {
            key: "prep",
            label: rosterFlowButtonLabel("Full squad prep", addablePlayers),
          },
          {
            key: "tools",
            label: "Add player",
          },
          {
            key: "players",
            label: rosterFlowButtonLabel("Season squad", rosterPlayers),
          },
          {
            key: "settings",
            label: "Settings",
          },
        ]
          .map(
            ({ key, label }) => `
              <button
                class="chip-button ${activeRosterDisclosureName() === key ? "active" : ""}"
                type="button"
                data-open-roster-disclosure="${key}"
                ${disabled ? "disabled" : ""}
              >
                ${escapeHtml(label)}
              </button>
            `
          )
          .join("");

        syncRosterFlowRow();
      }

      function seasonRosterFilterOptions(rows) {
        const options = [
          {
            key: "all",
            label: "All",
            count: rows.length,
          },
          {
            key: "core",
            label: "Core",
            count: rows.filter((row) => row.tier_status === "core").length,
          },
          {
            key: "flex",
            label: "Flex",
            count: rows.filter((row) => row.tier_status === "flex").length,
          },
          {
            key: "sub",
            label: "Sub",
            count: rows.filter((row) => row.tier_status === "sub").length,
          },
          {
            key: "inactive",
            label: "Inactive",
            count: rows.filter((row) => row.is_eligible === false).length,
          },
          {
            key: "tier_mismatch",
            label: "Tier mismatch",
            count: rows.filter((row) => row.player?.status !== row.tier_status).length,
          },
        ];

        if (seasonRosterMetadataSupported) {
          options.splice(4, 0, {
            key: "payment_check",
            label: "Payment check",
            count: rows.filter(
              (row) => row.payment_status !== "paid" && row.payment_status !== "comped"
            ).length,
          });
        }

        return options;
      }

      function rowMatchesSeasonRosterFilter(row) {
        if (activeSeasonRosterFilter === "core") {
          return row.tier_status === "core";
        }

        if (activeSeasonRosterFilter === "flex") {
          return row.tier_status === "flex";
        }

        if (activeSeasonRosterFilter === "sub") {
          return row.tier_status === "sub";
        }

        if (activeSeasonRosterFilter === "payment_check") {
          return row.payment_status !== "paid" && row.payment_status !== "comped";
        }

        if (activeSeasonRosterFilter === "inactive") {
          return row.is_eligible === false;
        }

        if (activeSeasonRosterFilter === "tier_mismatch") {
          return row.player?.status !== row.tier_status;
        }

        return true;
      }

      function renderSeasonRosterFilterRow(rows) {
        if (!seasonRosterFilterRow) {
          return;
        }

        const options = seasonRosterFilterOptions(rows);
        if (!options.some((option) => option.key === activeSeasonRosterFilter)) {
          activeSeasonRosterFilter = "all";
        }

        seasonRosterFilterRow.innerHTML = options
          .map(
            (option) => `
              <button
                class="filter-chip ${activeSeasonRosterFilter === option.key ? "active" : ""}"
                type="button"
                data-season-roster-filter="${option.key}"
              >
                ${escapeHtml(`${option.label} · ${option.count}`)}
              </button>
            `
          )
          .join("");
      }

      function updateSeasonRosterResultsNote(filteredCount, totalCount, searchValue, filterLabel) {
        if (!seasonRosterResultsNote) {
          return;
        }

        if (!totalCount) {
          seasonRosterResultsNote.textContent =
            "Add players to the season to start managing the season squad.";
          return;
        }

        if (!searchValue && activeSeasonRosterFilter === "all") {
          seasonRosterResultsNote.textContent = `Showing all ${totalCount} season squad players.`;
          return;
        }

        const detailParts = [];
        if (activeSeasonRosterFilter !== "all") {
          detailParts.push(filterLabel.toLowerCase());
        }
        if (searchValue) {
          detailParts.push(`search "${searchValue}"`);
        }

        seasonRosterResultsNote.textContent = `Showing ${filteredCount} of ${totalCount} season squad players for ${detailParts.join(" + ")}.`;
      }

      function summaryPillMarkup(label, value) {
        return `
          <div class="summary-pill">
            <strong>${escapeHtml(value)}</strong>
            <span>${escapeHtml(label)}</span>
          </div>
        `;
      }

      function renderSummaryPillGroup(items) {
        return (items || [])
          .map((item) => summaryPillMarkup(item.label, item.value))
          .join("");
      }

      function renderRosterSummaryMarkup({
        fullSquadCount = 0,
        seasonRosterCount = 0,
        notAddedCount = 0,
        coreTarget = 0,
        rotationTarget = 0,
      } = {}) {
        return `
          <p class="roster-summary-line">
            <strong>${escapeHtml(fullSquadCount)}</strong> full squad
            <span aria-hidden="true">·</span>
            <strong>${escapeHtml(seasonRosterCount)}</strong> season squad
            <span aria-hidden="true">·</span>
            <strong>${escapeHtml(notAddedCount)}</strong> not added
            <span aria-hidden="true">·</span>
            targets <strong>${escapeHtml(coreTarget)}</strong> core / <strong>${escapeHtml(rotationTarget)}</strong> rotation
          </p>
        `;
      }

      function isSeasonPlayerEditing(seasonPlayerId) {
        return Number(editingSeasonPlayerId) === Number(seasonPlayerId);
      }

      function startEditingSeasonPlayer(seasonPlayerId) {
        editingSeasonPlayerId = Number(seasonPlayerId);
        renderSeasonRoster();
      }

      function stopEditingSeasonPlayer(seasonPlayerId = editingSeasonPlayerId) {
        if (Number(editingSeasonPlayerId) !== Number(seasonPlayerId)) {
          return;
        }

        editingSeasonPlayerId = null;
        renderSeasonRoster();
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
        const tierStatus = normalizeTierValue(row.tier_status || row.registration_tier, "flex");
        return {
          ...row,
          tier_status: tierStatus,
          registration_tier: normalizeTierValue(row.registration_tier || tierStatus, tierStatus),
          payment_status: normalizePaymentStatus(row.payment_status),
          is_eligible: row.is_eligible !== false,
        };
      }

      function normalizeSeasonRosterRequestRow(row) {
        return {
          ...row,
          request_type: normalizeText(row.request_type || "directory").toLowerCase(),
          requester_name: normalizeText(row.requester_name || ""),
          requester_contact: normalizeText(row.requester_contact || ""),
          first_name: normalizeText(row.first_name || ""),
          last_name: normalizeText(row.last_name || ""),
          nickname: normalizeText(row.nickname || ""),
          nationality: normalizeText(row.nationality || ""),
          preferred_positions:
            Array.isArray(row.preferred_positions) && row.preferred_positions.length
              ? row.preferred_positions.map((value) => normalizeText(value).toUpperCase())
              : ["MID"],
          requested_tier: normalizeTierValue(row.requested_tier, "flex"),
          status: normalizeText(row.status || "pending").toLowerCase(),
          note: normalizeText(row.note || ""),
          review_note: normalizeText(row.review_note || ""),
        };
      }

      function seasonRosterRequestDisplayName(request) {
        if (request?.player) {
          return displayName(request.player);
        }

        return normalizeText(`${request?.first_name || ""} ${request?.last_name || ""}`);
      }

      function findDirectoryPlayerByName(firstName, lastName) {
        const normalizedFirstName = normalizeText(firstName).toLowerCase();
        const normalizedLastName = normalizeText(lastName).toLowerCase();

        return (
          clubPlayers.find(
            (player) =>
              normalizeText(player.first_name).toLowerCase() === normalizedFirstName &&
              normalizeText(player.last_name).toLowerCase() === normalizedLastName
          ) || null
        );
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
          return "That player already has matchday assignments or stats in this season. Clear or reassign their matchday activity before removing them from the season squad.";
        }

        return message;
      }

      function formatCountLabel(count, singularLabel, pluralLabel = `${singularLabel}s`) {
        return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
      }

      async function getSeasonPlayerActivityCounts(season, playerId) {
        const matchdayIds = Array.from(
          new Set((season?.matchdays || []).map((matchday) => Number(matchday?.id)).filter(Boolean))
        );

        if (!matchdayIds.length || !playerId) {
          return { assignmentCount: 0, statCount: 0 };
        }

        const [
          { count: assignmentCount, error: assignmentError },
          { count: statCount, error: statError },
        ] = await Promise.all([
          supabaseClient
            .from("matchday_assignments")
            .select("id", { count: "exact", head: true })
            .eq("player_id", playerId)
            .in("matchday_id", matchdayIds),
          supabaseClient
            .from("matchday_player_stats")
            .select("id", { count: "exact", head: true })
            .eq("player_id", playerId)
            .in("matchday_id", matchdayIds),
        ]);

        if (assignmentError || statError) {
          throw assignmentError || statError;
        }

        return {
          assignmentCount: assignmentCount || 0,
          statCount: statCount || 0,
        };
      }

      function seasonScheduleSummary(season) {
        if (!season?.season_start_date) {
          return "Manual kickoff dates";
        }

        return `${weekdayLabel(season.default_matchday_weekday)} · ${formatTimeLabel(
          season.default_kickoff_time
        )}`;
      }

      function buildSeasonListGroups(rows) {
        const orderedRows = sortSeasonsChronologically(rows || []);
        let focusIndex = orderedRows.findIndex((season) => Number(season.id) === Number(selectedSeasonId));

        if (focusIndex === -1) {
          focusIndex = orderedRows.length - 1;
        }

        return {
          focus: orderedRows[focusIndex] || null,
          newer: orderedRows.slice(focusIndex + 1),
          older: orderedRows.slice(0, focusIndex).reverse(),
        };
      }

      function seasonListDisclosureLabel(kind, rows) {
        const count = rows.length;
        const noun = count === 1 ? "season" : "seasons";
        return kind === "newer" ? `${count} newer ${noun}` : `${count} older ${noun}`;
      }

      function seasonListDisclosureNote(kind, rows) {
        const orderedRows = sortSeasonsChronologically(rows);
        const earliest = orderedRows[0];
        const latest = orderedRows[orderedRows.length - 1];

        if (!latest || !earliest) {
          return "";
        }

        const edgeLabel =
          latest.name === earliest.name
            ? latest.name
            : `${earliest.name} to ${latest.name}`;

        return kind === "newer"
          ? `Open ${edgeLabel} only when switching to a later campaign.`
          : `Open ${edgeLabel} only when you need the older archive.`;
      }

      function seasonCardMarkup(season, options = {}) {
        const matchdays = season.matchdays || [];
        const rosterCount = (season.seasonPlayers || []).length;
        const scheduled = matchdays.filter((matchday) => Boolean(matchday.kickoff_at)).length;
        const focusLabel = options.focusLabel || "";

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
              ${focusLabel ? `<span class="tag-pill timeline-focus-pill">${escapeHtml(focusLabel)}</span>` : ""}
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
      }

      function seasonCardListMarkup(rows, options = {}) {
        return rows.map((season) => seasonCardMarkup(season, options)).join("");
      }

      function seasonListDisclosureMarkup(kind, rows) {
        if (!rows.length) {
          return "";
        }

        if (rows.length <= 2) {
          return `<div class="season-grid">${seasonCardListMarkup(rows)}</div>`;
        }

        return `
          <details class="disclosure-card">
            <summary class="disclosure-summary">
              <div class="disclosure-copy">
                <div class="disclosure-title">${escapeHtml(seasonListDisclosureLabel(kind, rows))}</div>
                <div class="manual-note">${escapeHtml(seasonListDisclosureNote(kind, rows))}</div>
              </div>
            </summary>
            <div class="disclosure-body">
              <div class="season-grid">
                ${seasonCardListMarkup(rows)}
              </div>
            </div>
          </details>
        `;
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
        const fallbackTier = normalizeTierValue(player?.desired_tier || player?.status, "flex");

        seasonRosterRegistrationTierSelect.value = fallbackTier;
        seasonRosterTierStatusSelect.value = fallbackTier;
      }

      function tierOptionsMarkup(selectedValue) {
        return ["core", "flex", "sub"]
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
          setStatus("Full-squad player not found. Refresh and try again.", "error");
          renderSeasonRoster();
          return;
        }

        if (!["core", "flex", "sub"].includes(nextTier) || player.status === nextTier) {
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
          `${displayName(player)} is now marked ${formatTierLabel(nextTier)} for full-squad next-season bulk setup.`,
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

        const { focus, newer, older } = buildSeasonListGroups(seasons);

        if (!focus) {
          seasonGrid.innerHTML = `
            <div class="empty-state">
              No seasons yet. Create one from the form and the app will generate its schedule.
            </div>
          `;
          return;
        }

        seasonGrid.innerHTML = `
          ${seasonCardMarkup(focus, { focusLabel: "Selected" })}
          ${seasonListDisclosureMarkup("newer", newer)}
          ${seasonListDisclosureMarkup("older", older)}
        `;
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
        matchdayBoardCopy.textContent = `${selectedSeason.name} has ${seasonRosterCount} active season-squad players who can appear in Match Centre, League Table, Planner, and club screens. Tier targets are ${selectedSeason.core_spots} Core and ${selectedSeason.rotation_spots} Flex, with the current queue model starting at matchday ${selectedSeason.model_start_matchday || 1}. ${
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
          activeSeasonRosterFilter = "all";
          editingSeasonPlayerId = null;
          seasonRosterSearch.value = "";
          rosterSeasonPill.textContent = "Choose a campaign";
          rosterBoardCopy.textContent = "Choose a campaign to decide which full-squad players become active this season. Flow: Full Squad -> Season squad -> Availability -> Match Centre -> League Table -> Planner -> Club HQ.";
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
          seasonRosterAddSelect.innerHTML = `<option value="">Select a player from the full squad</option>`;
          seasonRosterRegistrationTierSelect.value = "flex";
          seasonRosterTierStatusSelect.value = "flex";
          seasonRosterPaymentStatusSelect.value = "unknown";
          seedRosterButton.disabled = true;
          syncSeasonTierButton.disabled = true;
          syncSeasonTierButton.textContent = "Use full squad tier status";
          if (rosterBulkNote) {
            rosterBulkNote.textContent = "For now, bulk add uses the current / next-season tier from Full Squad and only pulls players marked Core or Flex.";
          }
          renderRosterFlowRow({ disabled: true });
          seasonRosterRequestSummary.innerHTML = renderSummaryPillGroup([
            { label: "Pending", value: 0 },
            { label: "Full squad matches", value: 0 },
            { label: "New full-squad asks", value: 0 },
          ]);
          seasonRosterRequestWrap.innerHTML = `<div class="table-empty">Select a season first.</div>`;
          seasonDirectoryPrepSummary.innerHTML = renderSummaryPillGroup([
            { label: "Addable", value: clubPlayers.length },
            { label: "Core", value: 0 },
            { label: "Flex", value: 0 },
            { label: "Sub", value: 0 },
          ]);
          seasonDirectoryPrepWrap.innerHTML = `<div class="table-empty">Select a season first.</div>`;
          renderSeasonRosterFilterRow([]);
          updateSeasonRosterResultsNote(0, 0, "", "All");
          rosterSummaryGrid.innerHTML = renderRosterSummaryMarkup({
            fullSquadCount: clubPlayers.length,
            seasonRosterCount: 0,
            notAddedCount: clubPlayers.length,
            coreTarget: 18,
            rotationTarget: 10,
          });
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

        const seasonChanged = selectedSeason.id !== lastRosterDisclosureSeasonId;
        if (seasonChanged) {
          activeSeasonRosterFilter = "all";
          editingSeasonPlayerId = null;
          seasonRosterSearch.value = "";
        }

        const rosterRows = seasonRosterRowsForSeason(selectedSeason);
        const searchValue = normalizeText(seasonRosterSearch.value).toLowerCase();
        const filteredRoster = rosterRows.filter((row) => {
          if (!rowMatchesSeasonRosterFilter(row)) {
            return false;
          }

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
        const addableRotationPlayers = addablePlayers.filter((player) => player.status === "flex");
        const addableCoreRotationPlayers = addablePlayers.filter(
          (player) => player.status === "core" || player.status === "flex"
        );
        const addableFlexPlayers = addablePlayers.filter((player) => player.status === "sub");
        const coreCount = rosterRows.filter((row) => row.tier_status === "core").length;
        const rotationCount = rosterRows.filter((row) => row.tier_status === "flex").length;
        const flexCount = rosterRows.filter((row) => row.tier_status === "sub").length;
        const paidCount = rosterRows.filter((row) => row.payment_status === "paid").length;
        const pendingCount = rosterRows.filter((row) => row.payment_status === "pending").length;
        const unknownCount = rosterRows.filter((row) => row.payment_status === "unknown").length;
        const tierSyncRows = rosterTierSyncRows(rosterRows);
        const pendingRosterRequests = seasonRosterRequestsForSeason(selectedSeason);
        const directoryMatchRequests = pendingRosterRequests.filter((request) => request.player).length;
        const newDirectoryRequests = pendingRosterRequests.filter((request) => !request.player).length;

        if (seasonChanged) {
          openRosterDisclosure(
            pendingRosterRequests.length ? "requests" : rosterRows.length ? "players" : "tools"
          );
          lastRosterDisclosureSeasonId = selectedSeason.id;
        }

        rosterSeasonPill.textContent = selectedSeason.name;
        rosterBoardCopy.textContent = `${selectedSeason.name} has ${rosterRows.length} season-squad registrations out of ${clubPlayers.length} full-squad profiles. Only season-squad players appear in Match Centre, League Table, Planner, and club screens. Queue tracking begins at matchday ${selectedSeason.model_start_matchday || 1}, so earlier nights remain historical. ${
          seasonRosterMetadataSupported
            ? "Store what each player signed up for, whether they paid, and whether they are still active for matchdays. Use Full Squad to set current / next-season tiers first, then bulk add current Core + Flex."
            : "Use Full Squad to set current / next-season tiers first, then bulk add current Core + Flex."
        }`;
        openTiersLink.href = `./tiers.html?season_id=${selectedSeasonId}`;
        seedRosterButton.disabled = !addableCoreRotationPlayers.length;
        syncSeasonTierButton.disabled = !rosterRows.length;
        syncSeasonTierButton.textContent = rosterRows.length
          ? `Use full squad tier status${selectedSeason.name ? ` for ${selectedSeason.name}` : ""}`
          : "Use full squad tier status";
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
          <option value="">Select a player from the full squad</option>
          ${addablePlayers
            .map(
              (player) =>
                `<option value="${player.id}">${escapeHtml(displayName(player))} · full squad current/next-season ${escapeHtml(formatTierLabel(player.status))}</option>`
            )
            .join("")}
        `;
        syncRosterAddDefaultsFromSelection();
        if (rosterBulkNote) {
          const bulkCopy = addableCoreRotationPlayers.length
            ? `${addableCorePlayers.length} addable full-squad players are currently marked Core and ${addableRotationPlayers.length} are marked Flex. Use Add current Core + Flex to pull only those players into ${selectedSeason.name}.`
            : `No addable full-squad players are currently marked Core or Flex. Update player tiers in Full Squad first, then use Add current Core + Flex.`;
          const syncCopy = rosterRows.length
            ? tierSyncRows.length
              ? `${tierSyncRows.length} season-squad players in ${selectedSeason.name} currently differ from the Full Squad tier status. Use full squad tier status to align this season.`
              : `${selectedSeason.name} already matches the Full Squad tier status for every season-squad player.`
            : "";
          rosterBulkNote.textContent = syncCopy ? `${bulkCopy} ${syncCopy}` : bulkCopy;
        }
        renderRosterFlowRow({
          pendingRequests: pendingRosterRequests.length,
          addablePlayers: addablePlayers.length,
          rosterPlayers: rosterRows.length,
        });
        seasonRosterRequestSummary.innerHTML = renderSummaryPillGroup([
          { label: "Pending", value: pendingRosterRequests.length },
          { label: "Full squad matches", value: directoryMatchRequests },
          { label: "New full-squad asks", value: newDirectoryRequests },
        ]);
        if (!seasonRosterRequestsSupported) {
          seasonRosterRequestWrap.innerHTML = `
            <div class="table-empty">
              Public season-squad requests are waiting for the latest club update on this build.
            </div>
          `;
        } else if (!pendingRosterRequests.length) {
          seasonRosterRequestWrap.innerHTML = `
            <div class="table-empty">
              No pending public season-squad requests for ${escapeHtml(selectedSeason.name)} right now.
            </div>
          `;
        } else {
          seasonRosterRequestWrap.innerHTML = `
            <div class="compact-list">
              ${pendingRosterRequests
                .map((request) => {
                  const requestName = seasonRosterRequestDisplayName(request);
                  const requestCopy = request.player
                    ? `Already in the full squad register as ${displayName(request.player)}`
                    : "Needs a new full-squad profile before season approval";
                  const requestNote = request.note
                    ? `<p class="compact-row-copy">${escapeHtml(request.note)}</p>`
                    : "";
                  return `
                    <article class="compact-row" data-season-roster-request-row="${request.id}">
                      <div class="compact-row-main">
                        <div>
                          <div class="compact-row-title">${escapeHtml(requestName)}</div>
                          <p class="compact-row-copy">${escapeHtml(requestCopy)}</p>
                          <p class="compact-row-copy">${escapeHtml(
                            [request.requester_contact || "No contact left", request.nationality || "No nationality"]
                              .filter(Boolean)
                              .join(" · ")
                          )}</p>
                          ${requestNote}
                        </div>
                      </div>
                      <div class="compact-badges">
                        <span class="tag-pill">${escapeHtml(
                          request.player ? "Full squad match" : "New full squad request"
                        )}</span>
                        <span class="tag-pill">Requested season tier ${escapeHtml(
                          formatTierLabel(request.requested_tier)
                        )}</span>
                        <span class="tag-pill">${escapeHtml(
                          (request.preferred_positions || []).join(", ")
                        )}</span>
                        <span class="tag-pill">${escapeHtml(formatDateTime(request.created_at))}</span>
                      </div>
                      <div class="actions">
                        <button
                          class="primary-button"
                          type="button"
                          data-approve-season-roster-request="${request.id}"
                        >
                          ${request.player ? "Approve into season" : "Approve to full squad + season"}
                        </button>
                        <button
                          class="secondary-button"
                          type="button"
                          data-deny-season-roster-request="${request.id}"
                        >
                          Deny
                        </button>
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          `;
        }
        renderSeasonRosterFilterRow(rosterRows);
        const activeFilterLabel =
          seasonRosterFilterOptions(rosterRows).find(
            (option) => option.key === activeSeasonRosterFilter
          )?.label || "All";
        updateSeasonRosterResultsNote(
          filteredRoster.length,
          rosterRows.length,
          searchValue,
          activeFilterLabel
        );
        seasonDirectoryPrepSummary.innerHTML = renderSummaryPillGroup([
          { label: "Addable", value: addablePlayers.length },
          { label: "Core", value: addableCorePlayers.length },
          { label: "Flex", value: addableRotationPlayers.length },
          { label: "Sub", value: addableFlexPlayers.length },
        ]);
        if (!addablePlayers.length) {
          seasonDirectoryPrepWrap.innerHTML = `
            <div class="table-empty">
              Every full-squad player is already on ${escapeHtml(selectedSeason.name)}. Use the season-squad controls below to review tiers and activity.
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
                            [player.nationality || "Full squad player", ...(player.positions || [])]
                              .filter(Boolean)
                              .join(" · ")
                          )}</p>
                        </div>
                      </div>
                      <div class="compact-badges">
                        <span class="tag-pill">${escapeHtml(
                          player.status === "sub" ? "Not in bulk add" : "Will bulk add"
                        )}</span>
                      </div>
                      <div class="field">
                        <label for="directory-prep-tier-${player.id}">Full squad current / next-season tier</label>
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

        rosterSummaryGrid.innerHTML = renderRosterSummaryMarkup({
          fullSquadCount: clubPlayers.length,
          seasonRosterCount: rosterRows.length,
          notAddedCount: addablePlayers.length,
          coreTarget: selectedSeason.core_spots,
          rotationTarget: selectedSeason.rotation_spots,
        });

        if (!rosterRows.length) {
          seasonRosterWrap.innerHTML = `
            <div class="table-empty">
              No players are on ${escapeHtml(selectedSeason.name)}'s season squad yet. Add them one by one or use
              <strong>Add current Core + Flex</strong> as a starting point.
            </div>
          `;
          return;
        }

        if (!filteredRoster.length) {
          seasonRosterWrap.innerHTML = `<div class="table-empty">No season-squad players match the current search or filter.</div>`;
          return;
        }

        seasonRosterWrap.innerHTML = `
          <div class="compact-list">
            ${filteredRoster
              .map((row) => {
                const isEditing = isSeasonPlayerEditing(row.id);
                const playerDetails = row.player.nationality || "Full squad player";

                return `
                  <article class="compact-row" data-season-player-row="${row.id}">
                    <div class="compact-row-main">
                      <div>
                        <div class="compact-row-title">${escapeHtml(displayName(row.player))}</div>
                        <p class="compact-row-copy">${escapeHtml(playerDetails)}</p>
                      </div>
                    </div>
                    <div class="field-grid">
                      <div class="field">
                        <label for="season-player-tier-${row.id}">Tier</label>
                        <select
                          id="season-player-tier-${row.id}"
                          data-season-player-tier="${row.id}"
                          ${isEditing ? "" : "disabled"}
                        >
                          ${tierOptionsMarkup(row.tier_status)}
                        </select>
                      </div>
                      <div class="field">
                        <label for="season-player-payment-${row.id}">Payment</label>
                        <select
                          id="season-player-payment-${row.id}"
                          data-season-player-payment="${row.id}"
                          ${isEditing && seasonRosterMetadataSupported ? "" : "disabled"}
                        >
                          ${paymentOptionsMarkup(row.payment_status)}
                        </select>
                      </div>
                    </div>
                    <div class="actions">
                      ${
                        isEditing
                          ? `
                            <button class="primary-button" type="button" data-save-season-player="${row.id}">Save changes</button>
                            <button class="secondary-button" type="button" data-cancel-season-player="${row.id}">Cancel</button>
                          `
                          : `<button class="primary-button" type="button" data-edit-season-player="${row.id}">Edit entry</button>`
                      }
                      <button class="secondary-button" type="button" data-remove-season-player="${row.id}">Remove</button>
                    </div>
                  </article>
                `
              })
              .join("")}
          </div>
        `;
      }

      function buildSeasonPlayerInsertPayload(selectedSeason, player, overrides = {}) {
        const registrationTier = normalizeTierValue(
          overrides.registration_tier || player.desired_tier || player.status,
          "flex"
        );
        const payload = {
          season_id: selectedSeason.id,
          player_id: player.id,
          tier_status: normalizeTierValue(overrides.tier_status || registrationTier, registrationTier),
          tier_reason: overrides.tier_reason || "Added from the full squad current / next-season tier.",
          movement_note:
            overrides.movement_note || "Season squad membership controls matchday and standings visibility.",
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
          setStatus("Season squad row not found. Refresh the page and try again.", "error");
          return;
        }

        const tierStatusInput = card.querySelector(`[data-season-player-tier="${seasonPlayerId}"]`);
        const paymentStatusInput = card.querySelector(`[data-season-player-payment="${seasonPlayerId}"]`);
        const saveButton = card.querySelector(`[data-save-season-player="${seasonPlayerId}"]`);
        const player = clubPlayers.find((entry) => entry.id === row.player_id);

        const payload = {
          tier_status: normalizeTierValue(tierStatusInput?.value || row.tier_status, row.tier_status),
        };

        if (seasonRosterMetadataSupported) {
          payload.payment_status = normalizePaymentStatus(paymentStatusInput?.value || row.payment_status);
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
        setStatus(`Saving the ${player ? displayName(player) : "player"} season-squad record...`);

        try {
          const { error } = await supabaseClient
            .from("season_players")
            .update(payload)
            .eq("id", seasonPlayerId);

          if (error) {
            throw error;
          }

          editingSeasonPlayerId = null;
          await loadSeasons();
          setStatus(
            `${player ? displayName(player) : "Season player"} updated for ${selectedSeason.name}.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          saveButton.disabled = false;
          saveButton.textContent = "Save changes";
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
          setStatus("Choose a campaign and a player from the full squad.", "warning");
          return;
        }

        const player = clubPlayers.find((entry) => entry.id === playerId);

        if (!player) {
          setStatus("That full-squad profile was not found. Refresh and try again.", "error");
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
              tier_reason: "Added from the full squad register for this season signup.",
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
        seasonRosterRegistrationTierSelect.value = "flex";
        seasonRosterTierStatusSelect.value = "flex";
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
          .filter((player) => player.status === "core" || player.status === "flex")
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
          setStatus("No missing full-squad core or rotation players to add.", "warning");
          return;
        }

        seedRosterButton.disabled = true;
        seedRosterButton.textContent = "Adding...";
        setStatus(`Adding ${rowsToInsert.length} current core/rotation players to ${selectedSeason.name}...`);

        const { error } = await supabaseClient.from("season_players").insert(rowsToInsert);

        seedRosterButton.disabled = false;
        seedRosterButton.textContent = "Add current Core + Flex";

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
            `${selectedSeason.name} already matches the Full Squad current / next-season tier for every season-squad player.`,
            "success"
          );
          return;
        }

        syncSeasonTierButton.disabled = true;
        syncSeasonTierButton.textContent = "Syncing...";
        setStatus(
          `Applying the Full Squad current / next-season tier to ${rowsToSync.length} season-squad players in ${selectedSeason.name}...`
        );

        try {
          await Promise.all(
            rowsToSync.map((row) =>
              supabaseClient
                .from("season_players")
                .update({
                  tier_status: row.player.status,
                  tier_reason: "Aligned with the Full Squad current / next-season tier.",
                  movement_note: "Season tier synced from the full squad status.",
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
            `${rowsToSync.length} season-squad players in ${selectedSeason.name} now match the Full Squad current / next-season tier.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          syncSeasonTierButton.disabled = false;
          syncSeasonTierButton.textContent = `Use full squad tier status${selectedSeason.name ? ` for ${selectedSeason.name}` : ""}`;
        }
      }

      async function removeSeasonPlayer(seasonPlayerId, triggerButton = null) {
        const selectedSeason = getSelectedSeason();
        const row = (selectedSeason?.seasonPlayers || []).find((entry) => entry.id === seasonPlayerId);
        const player = clubPlayers.find((entry) => entry.id === row?.player_id);

        if (!row || !selectedSeason || !player) {
          setStatus("Season squad row not found. Refresh the page and try again.", "error");
          return;
        }

        const playerName = displayName(player);
        const originalButtonText = triggerButton?.textContent || "Remove";

        if (triggerButton) {
          triggerButton.disabled = true;
          triggerButton.textContent = "Checking...";
        }

        try {
          setStatus(`Checking whether ${playerName} can be removed from ${selectedSeason.name}...`, "loading");

          const { assignmentCount, statCount } = await getSeasonPlayerActivityCounts(
            selectedSeason,
            row.player_id
          );

          if (assignmentCount || statCount) {
            const activitySummary = [
              assignmentCount ? formatCountLabel(assignmentCount, "assignment") : "",
              statCount ? formatCountLabel(statCount, "stat record") : "",
            ]
              .filter(Boolean)
              .join(" and ");
            showSeasonActionFailure(
              `${playerName} still has ${activitySummary} in ${selectedSeason.name}. Clear or reassign that matchday activity before removing them from the season squad.`
            );
            return;
          }

          const confirmed = window.confirm(
            `Remove ${playerName} from ${selectedSeason.name}? They will disappear from Match Centre, League Table, Planner, and the club site for this season.`
          );

          if (!confirmed) {
            setStatus(`${playerName} stays on ${selectedSeason.name}.`);
            return;
          }

          if (triggerButton?.isConnected) {
            triggerButton.textContent = "Removing...";
          }
          setStatus(`Removing ${playerName} from ${selectedSeason.name}...`, "loading");

          const { error } = await supabaseClient.from("season_players").delete().eq("id", seasonPlayerId);

          if (error) {
            showSeasonActionFailure(readableError(error));
            return;
          }

          if (isSeasonPlayerEditing(seasonPlayerId)) {
            editingSeasonPlayerId = null;
          }
          setStatus(`${playerName} removed from ${selectedSeason.name}.`, "success");
          openRosterDisclosure("players");
          await loadSeasons();
        } catch (error) {
          showSeasonActionFailure(readableError(error));
        } finally {
          if (triggerButton?.isConnected) {
            triggerButton.disabled = false;
            triggerButton.textContent = originalButtonText;
          }
        }
      }

      async function ensureSeasonRosterRequestPlayer(request) {
        if (request?.player) {
          return request.player;
        }

        const existingPlayer = findDirectoryPlayerByName(request.first_name, request.last_name);
        if (existingPlayer) {
          return existingPlayer;
        }

        const playerPayload = {
          first_name: request.first_name,
          last_name: request.last_name,
          nickname: request.nickname || null,
          nationality: request.nationality,
          phone: request.requester_contact || null,
          positions:
            Array.isArray(request.preferred_positions) && request.preferred_positions.length
              ? request.preferred_positions
              : ["MID"],
          skill_rating: 78,
          desired_tier: request.requested_tier,
          status: request.requested_tier,
          dominant_foot: "right",
          notes: request.note || "Created from a public season squad request.",
        };

        const { data, error } = await supabaseClient
          .from("players")
          .insert(playerPayload)
          .select("id, first_name, last_name, nickname, nationality, desired_tier, status")
          .single();

        if (error?.code === "23505") {
          const duplicatePlayer = findDirectoryPlayerByName(request.first_name, request.last_name);
          if (duplicatePlayer) {
            return duplicatePlayer;
          }
        }

        if (error) {
          throw error;
        }

        return normalizeDesiredTierPlayer(data);
      }

      async function ensurePlayerOnSeasonRoster(selectedSeason, player, request) {
        const existingRosterRow = seasonRosterRowsForSeason(selectedSeason).find(
          (row) => Number(row.player_id) === Number(player.id)
        );

        if (existingRosterRow) {
          return existingRosterRow.id;
        }

        const { data, error } = await supabaseClient
          .from("season_players")
          .insert(
            buildSeasonPlayerInsertPayload(selectedSeason, player, {
              registration_tier: request.requested_tier,
              tier_status: request.requested_tier,
              payment_status: "unknown",
              tier_reason: "Approved from a public season squad request.",
              movement_note: request.note || "Approved into the season squad from the public roster page.",
              is_eligible: true,
            })
          )
          .select("id")
          .single();

        if (error?.code === "23505") {
          const existingResponse = await supabaseClient
            .from("season_players")
            .select("id")
            .eq("season_id", selectedSeason.id)
            .eq("player_id", player.id)
            .single();

          if (existingResponse.error) {
            throw existingResponse.error;
          }

          return existingResponse.data.id;
        }

        if (error) {
          throw error;
        }

        return data.id;
      }

      async function approveSeasonRosterRequest(requestId) {
        const selectedSeason = getSelectedSeason();
        const request = seasonRosterRequestsForSeason(selectedSeason).find(
          (entry) => Number(entry.id) === Number(requestId)
        );

        if (!selectedSeason || !request) {
          setStatus("Season-squad request not found. Refresh and try again.", "error");
          return;
        }

        const requestName = seasonRosterRequestDisplayName(request);
        setStatus(`Approving ${requestName} for ${selectedSeason.name}...`);

        try {
          const player = await ensureSeasonRosterRequestPlayer(request);
          const seasonPlayerId = await ensurePlayerOnSeasonRoster(selectedSeason, player, request);
          const { error } = await supabaseClient
            .from("season_roster_requests")
            .update({
              status: "approved",
              review_note: "Approved in Season Centre.",
              approved_player_id: player.id,
              approved_season_player_id: seasonPlayerId,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", request.id);

          if (error) {
            throw error;
          }

          openRosterDisclosure("players");
          await loadSeasons();
          setStatus(`${requestName} approved into ${selectedSeason.name}.`, "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      async function denySeasonRosterRequest(requestId) {
        const selectedSeason = getSelectedSeason();
        const request = seasonRosterRequestsForSeason(selectedSeason).find(
          (entry) => Number(entry.id) === Number(requestId)
        );

        if (!selectedSeason || !request) {
          setStatus("Season-squad request not found. Refresh and try again.", "error");
          return;
        }

        const requestName = seasonRosterRequestDisplayName(request);
        setStatus(`Denying ${requestName} for ${selectedSeason.name}...`);

        const { error } = await supabaseClient
          .from("season_roster_requests")
          .update({
            status: "denied",
            review_note: "Denied in Season Centre.",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        if (error) {
          setStatus(readableError(error), "error");
          return;
        }

        openRosterDisclosure("requests");
        await loadSeasons();
        setStatus(`${requestName} was denied for ${selectedSeason.name}.`, "success");
      }

      async function loadSeasons() {
        setStatus("Loading seasons and schedule...", "loading");
        seasonScheduleDefaultsSupported = true;
        seasonRosterMetadataSupported = true;
        seasonRosterRequestsSupported = true;

        let [
          { data: seasonData, error: seasonError },
          { data: matchdayData, error: matchdayError },
          { data: playerData, error: playerError },
          { data: seasonPlayerData, error: seasonPlayerError },
          { data: seasonRosterRequestData, error: seasonRosterRequestError },
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
          supabaseClient
            .from("season_roster_requests")
            .select(
              "id, season_id, player_id, request_type, requester_name, requester_contact, first_name, last_name, nickname, nationality, preferred_positions, requested_tier, note, status, review_note, approved_player_id, approved_season_player_id, created_at, reviewed_at"
            )
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

        if (seasonRosterRequestError && hasMissingSeasonRosterRequestTable(seasonRosterRequestError)) {
          seasonRosterRequestsSupported = false;
          seasonRosterRequestData = [];
          seasonRosterRequestError = null;
        }

        if (seasonError || matchdayError || playerError || seasonPlayerError || seasonRosterRequestError) {
          seasons = [];
          clubPlayers = [];
          seasonRosterRequests = [];
          selectedSeasonId = null;
          updateHeroStats();
          renderSeasons();
          renderSeasonRoster();
          renderMatchdays();
          setStatus(
            readableError(
              seasonError ||
                matchdayError ||
                playerError ||
                seasonPlayerError ||
                seasonRosterRequestError
            ),
            "error"
          );
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
        seasonRosterRequests = (seasonRosterRequestData || []).map(normalizeSeasonRosterRequestRow);

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

        setSeasonView(activeSeasonView);
        updateHeroStats();
        renderSeasons();
        renderSeasonRoster();
        renderMatchdays();

        if (
          !seasonScheduleDefaultsSupported ||
          !seasonRosterMetadataSupported ||
          !seasonRosterRequestsSupported
        ) {
          setStatus(
            "Connected. Weekly fixture defaults, signup metadata, or public season-squad requests are still in basic mode on this build.",
            "warning"
          );
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
          setStatus("Flex spots must be a whole number between 0 and 60.", "error");
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
          `${name} created with ${totalMatchdays} matchdays, ${coreSpots} Core spots, ${rotationSpots} Flex spots, and queue tracking starting at matchday ${modelStartMatchday}.${
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
      seasonRosterFlowRow.addEventListener("click", (event) => {
        const button = event.target.closest("[data-open-roster-disclosure]");

        if (!button) {
          return;
        }

        openRosterDisclosure(button.dataset.openRosterDisclosure);
        if (button.dataset.openRosterDisclosure === "players") {
          seasonRosterSearch.focus();
        }
      });
      seasonRosterFilterRow.addEventListener("click", (event) => {
        const button = event.target.closest("[data-season-roster-filter]");

        if (!button) {
          return;
        }

        activeSeasonRosterFilter = button.dataset.seasonRosterFilter;
        renderSeasonRoster();
      });
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
        const editButton = event.target.closest("[data-edit-season-player]");
        const cancelButton = event.target.closest("[data-cancel-season-player]");
        const saveButton = event.target.closest("[data-save-season-player]");
        const button = event.target.closest("[data-remove-season-player]");

        if (editButton) {
          startEditingSeasonPlayer(Number(editButton.dataset.editSeasonPlayer));
          return;
        }

        if (cancelButton) {
          stopEditingSeasonPlayer(Number(cancelButton.dataset.cancelSeasonPlayer));
          return;
        }

        if (saveButton) {
          await saveSeasonPlayer(Number(saveButton.dataset.saveSeasonPlayer));
          return;
        }

        if (!button) {
          return;
        }

        await removeSeasonPlayer(Number(button.dataset.removeSeasonPlayer), button);
      });

      seasonRosterRequestWrap.addEventListener("click", async (event) => {
        const approveButton = event.target.closest("[data-approve-season-roster-request]");
        const denyButton = event.target.closest("[data-deny-season-roster-request]");

        if (approveButton) {
          await approveSeasonRosterRequest(Number(approveButton.dataset.approveSeasonRosterRequest));
          return;
        }

        if (!denyButton) {
          return;
        }

        await denySeasonRosterRequest(Number(denyButton.dataset.denySeasonRosterRequest));
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

      [
        seasonSettingsDisclosure,
        seasonRosterToolsDisclosure,
        seasonRosterRequestsDisclosure,
        seasonDirectoryPrepDisclosure,
        seasonRosterListDisclosure,
      ].forEach((disclosure) => {
        disclosure?.addEventListener("toggle", () => {
          if (!disclosure.open) {
            syncRosterFlowRow();
            return;
          }

          [
            seasonSettingsDisclosure,
            seasonRosterToolsDisclosure,
            seasonRosterRequestsDisclosure,
            seasonDirectoryPrepDisclosure,
            seasonRosterListDisclosure,
          ].forEach((otherDisclosure) => {
            if (otherDisclosure && otherDisclosure !== disclosure) {
              otherDisclosure.open = false;
            }
          });

          syncRosterFlowRow();
        });
      });

      setSeasonView(resolveSeasonView(), { updateHash: false });
      loadSeasons();
    
