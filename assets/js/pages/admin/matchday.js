(async function () {
  "use strict";

      const adminPage = window.MandarinasAdminPage;
      if (!adminPage) {
        return;
      }

      const access = await adminPage.requireAccess({
        pageTitle: "Busses matchday",
        requireLogic: true,
      });
      if (!access.ok) {
        return;
      }

      const { supabaseClient, logic } = access;

      const {
        TEAM_ORDER,
        buildScoringSettings,
        buildBalancedTeams,
        buildStandingsByPlayerId,
        compareRotationQueuePriority,
        isFinalMatchday,
        normalizeTeamDisplayConfig,
        teamDisplayLabel,
        applyTeamDisplayConfig,
        sortSeasonsChronologically,
        normalizeTierValue,
        normalizePlayerDesiredTier,
        summarizeBalancedAssignments,
        summarizeMatchdayProgress,
      } = logic;

      const TEAM_CONFIG = [
        { code: "magenta", label: "Magenta", maxPlayers: 9 },
        { code: "blue", label: "Blue", maxPlayers: 9 },
        { code: "green", label: "Green", maxPlayers: 9 },
        { code: "orange", label: "Orange", maxPlayers: 9 },
      ];
      const TEAM_MAX_PLAYERS_BY_CODE = Object.freeze(
        TEAM_CONFIG.reduce((lookup, team) => {
          lookup[team.code] = team.maxPlayers;
          return lookup;
        }, {})
      );
      const ROUND_ONE_DEFAULTS = [
        { round_number: 1, match_order: 1, home_team_code: "blue", away_team_code: "magenta" },
        { round_number: 1, match_order: 2, home_team_code: "orange", away_team_code: "green" },
        { round_number: 2, match_order: 1, home_team_code: null, away_team_code: null },
        { round_number: 2, match_order: 2, home_team_code: null, away_team_code: null },
      ];

      const params = new URLSearchParams(window.location.search);
      const matchdayId = Number(params.get("matchday_id"));
      const requestedSeasonId = Number(params.get("season_id"));

      const heroCopy = document.getElementById("hero-copy");
      const matchdayInfoCopy = document.getElementById("matchday-info-copy");
      const matchdayLauncherBlock = document.getElementById("matchday-launcher-block");
      const matchdayLauncherCopy = document.getElementById("matchday-launcher-copy");
      const matchdaySeasonSelect = document.getElementById("matchday-season-select");
      const openSeasonMatchdayButton = document.getElementById("open-season-matchday-button");
      const matchdayLauncherNote = document.getElementById("matchday-launcher-note");
      const playerSearch = document.getElementById("player-search");
      const playerTierFilter = document.getElementById("player-tier-filter");
      const openPlayerStatsLink = document.getElementById("open-player-stats-link");
      const replacementPlayerSelect = document.getElementById("replacement-player-select");
      const replacementTierStatusSelect = document.getElementById("replacement-tier-status");
      const replacementAttendanceStatusSelect = document.getElementById("replacement-attendance-status");
      const replacementAddButton = document.getElementById("replacement-add-button");
      const replacementNote = document.getElementById("replacement-note");
      const openSeasonRosterLink = document.getElementById("open-season-roster-link");
      const matchdayStatusLine = document.getElementById("matchday-status-line");
      const goalsPointsToggle = document.getElementById("goals-points-toggle");
      const goalsPointsCopy = document.getElementById("goals-points-copy");
      const attendancePointsInput = document.getElementById("attendance-points");
      const winPointsInput = document.getElementById("win-points");
      const drawPointsInput = document.getElementById("draw-points");
      const lossPointsInput = document.getElementById("loss-points");
      const goalKeepPointsInput = document.getElementById("goal-keep-points");
      const teamGoalPointsInput = document.getElementById("team-goal-points");
      const saveScoringButton = document.getElementById("save-scoring-button");
      const rosterViewTriggers = Array.from(document.querySelectorAll("[data-roster-view-trigger]"));
      const rosterViewPanes = Array.from(document.querySelectorAll("[data-roster-view]"));
      const teamDisplayGrid = document.getElementById("team-display-grid");
      const resetTeamDisplayButton = document.getElementById("reset-team-display-button");
      const saveTeamDisplayButton = document.getElementById("save-team-display-button");
      const attendingCount = document.getElementById("attending-count");
      const assignedCount = document.getElementById("assigned-count");
      const fullTeamCount = document.getElementById("full-team-count");
      const captainCount = document.getElementById("captain-count");
      const attendanceBadge = document.getElementById("attendance-badge");
      const priorityFillButton = document.getElementById("priority-fill-button");
      const prioritySummaryGrid = document.getElementById("priority-summary-grid");
      const priorityBoardWrap = document.getElementById("priority-board-wrap");
      const attendanceGrid = document.getElementById("attendance-grid");
      const matchesGrid = document.getElementById("matches-grid");
      const teamGrid = document.getElementById("team-grid");
      const attendanceStep = document.getElementById("attendance-step");
      const teamsStep = document.getElementById("teams-step");
      const scoresStep = document.getElementById("scores-step");
      const matchdayWeatherVenue = document.getElementById("matchday-weather-venue");
      const matchdayWeatherHeadline = document.getElementById("matchday-weather-headline");
      const matchdayWeatherCopy = document.getElementById("matchday-weather-copy");
      const matchdayWeatherChips = document.getElementById("matchday-weather-chips");
      const weatherApi = window.MandarinasWeather || null;

      let season = null;
      let matchday = null;
      let players = [];
      let clubPlayers = [];
      let seasonRosterRows = [];
      let seasonRosterPlayerIds = new Set();
      let historicalAssignments = [];
      let historicalCaptainRows = [];
      let statsByPlayerId = new Map();
      let assignments = [];
      let captainRows = [];
      let matches = [];
      let seasonMatchdayNumberById = new Map();
      let tierMetricsByPlayerId = new Map();
      let rotationStandingsByPlayerId = new Map();
      let activeRotationQueueMode = "regular";
      let activeRosterView = "season";
      let activeTeamWorkspaceView = "pool";
      let rosterPlan = null;
      let rosterDisplayPlan = null;
      let draggedPlayerId = null;
      let draggedCard = null;
      let launcherSeasons = [];
      let launcherTargetMatchdayId = null;
      let teamDisplayConfig = applyTeamDisplayConfig(null);
      let captainTrackingSupported = true;
      let teamDisplaySupported = true;
      let seasonRosterMetadataSupported = true;
      let matchdayWeatherToken = 0;

      const ATTENDANCE_STATUS_LABELS = {
        out: "Out",
        in: "IN",
        available: "Available",
        late_cancel: "Late cancel",
        no_show: "No-show",
      };
      const ROSTER_CAP = TEAM_CONFIG.reduce((sum, team) => sum + team.maxPlayers, 0);

      function normalizeText(value) {
        return String(value || "").trim().replace(/\s+/g, " ");
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function hasMissingTeamDisplayColumn(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("column") || message.includes("schema cache")) &&
          message.includes("team_display_config")
        );
      }

      function hasMissingDesiredTierColumn(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("column") || message.includes("schema cache")) &&
          message.includes("desired_tier")
        );
      }

      function hasMissingSeasonRosterMetadataColumns(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("column") || message.includes("schema cache")) &&
          (message.includes("registration_tier") || message.includes("payment_status"))
        );
      }

      function hasMissingCaptainTable(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("relation") || message.includes("schema cache")) &&
          message.includes("matchday_team_captains")
        );
      }

      function hasMissingFinalCaptainModeColumn(error) {
        const message = String(error?.message || "").toLowerCase();
        return (
          (message.includes("column") || message.includes("schema cache")) &&
          message.includes("final_captain_order_enabled")
        );
      }

      function syncTeamConfigLabels() {
        TEAM_CONFIG.forEach((team) => {
          team.label = teamDisplayLabel(teamDisplayConfig, team.code);
        });
      }

      function teamLabel(teamCode) {
        return teamDisplayLabel(teamDisplayConfig, teamCode);
      }

      function renderTeamDisplayFields() {
        teamDisplayGrid.innerHTML = TEAM_ORDER.map((teamCode) => {
          const team = teamDisplayConfig[teamCode];

          return `
            <div class="team-display-row">
              <div class="field">
                <label for="team-label-${teamCode}">${escapeHtml(teamCode)} label</label>
                <input
                  id="team-label-${teamCode}"
                  type="text"
                  maxlength="24"
                  data-team-display-label="${teamCode}"
                  value="${escapeHtml(team.label)}"
                />
              </div>
              <div class="field">
                <label for="team-color-${teamCode}">${escapeHtml(teamCode)} color</label>
                <div class="team-color-field">
                  <input
                    id="team-color-${teamCode}"
                    class="team-color-input"
                    type="color"
                    data-team-display-color="${teamCode}"
                    value="${escapeHtml(team.color)}"
                  />
                  <span class="tag-pill">${escapeHtml(team.color.toUpperCase())}</span>
                </div>
              </div>
            </div>
          `;
        }).join("");
      }

      function readTeamDisplayInputs() {
        const nextConfig = {};

        TEAM_ORDER.forEach((teamCode) => {
          const labelInput = teamDisplayGrid.querySelector(`[data-team-display-label="${teamCode}"]`);
          const colorInput = teamDisplayGrid.querySelector(`[data-team-display-color="${teamCode}"]`);

          nextConfig[teamCode] = {
            label: normalizeText(labelInput?.value || teamLabel(teamCode)),
            color: normalizeText(colorInput?.value || teamDisplayConfig[teamCode]?.color || ""),
          };
        });

        return normalizeTeamDisplayConfig(nextConfig);
      }

      function applySeasonTeamDisplay(nextConfig) {
        teamDisplayConfig = applyTeamDisplayConfig(nextConfig);
        syncTeamConfigLabels();
        renderTeamDisplayFields();
        teamDisplayGrid
          .querySelectorAll("input")
          .forEach((input) => (input.disabled = !teamDisplaySupported));
        resetTeamDisplayButton.disabled = !teamDisplaySupported;
        saveTeamDisplayButton.disabled = !teamDisplaySupported;
      }

      function setStatus(message, tone = "") {
        matchdayStatusLine.textContent = message;
        matchdayStatusLine.className = tone ? `status-line ${tone}` : "status-line";
      }

      function parseReplacementSelection(value) {
        const normalized = normalizeText(value || "");

        if (!normalized) {
          return null;
        }

        const [source, rawId] = normalized.split(":");
        const numericId = Number(rawId);

        if (!Number.isInteger(numericId) || numericId <= 0) {
          return null;
        }

        if (source === "season") {
          const row = seasonRosterRows.find((entry) => entry.id === numericId && entry.player);
          return row ? { source, row, player: row.player } : null;
        }

        if (source === "directory") {
          const player = clubPlayers.find((entry) => entry.id === numericId);
          return player ? { source, player } : null;
        }

        return null;
      }

      function renderMatchdayWeather(snapshot) {
        if (!matchdayWeatherHeadline || !matchdayWeatherCopy || !matchdayWeatherChips) {
          return;
        }

        if (matchdayWeatherVenue) {
          matchdayWeatherVenue.textContent = weatherApi?.MATCHDAY_VENUE?.shortName || "Alden E. Oliver";
        }

        const description = weatherApi
          ? weatherApi.describeMatchdayWeather(snapshot, { includeVenue: true })
          : {
              headline: "Weather unavailable",
              detail: "The weather helper did not load on this page.",
              chips: ["Alden E. Oliver"],
            };

        matchdayWeatherHeadline.textContent = description.headline;
        matchdayWeatherCopy.textContent = description.detail;
        matchdayWeatherChips.innerHTML = (description.chips || [])
          .map((chip) => `<span class="badge">${escapeHtml(chip)}</span>`)
          .join("");
      }

      async function syncMatchdayWeather(matchdayRow) {
        const requestToken = ++matchdayWeatherToken;

        if (!weatherApi) {
          renderMatchdayWeather({ status: "error" });
          return;
        }

        if (!matchdayRow?.kickoff_at) {
          renderMatchdayWeather({ status: "missing_kickoff" });
          return;
        }

        matchdayWeatherHeadline.textContent = "Loading match forecast...";
        matchdayWeatherCopy.textContent = "Fetching the forecast for Alden E. Oliver.";
        matchdayWeatherChips.innerHTML = `<span class="badge">${escapeHtml(
          weatherApi.MATCHDAY_VENUE.shortName
        )}</span>`;

        try {
          const snapshot = await weatherApi.loadSingleMatchdayWeather(matchdayRow);

          if (requestToken !== matchdayWeatherToken) {
            return;
          }

          renderMatchdayWeather(snapshot);
        } catch (error) {
          console.error("[Matchday] Weather load failed:", error);

          if (requestToken !== matchdayWeatherToken) {
            return;
          }

          renderMatchdayWeather({ status: "error" });
        }
      }

      function showDashboardTabOnly() {}

      function setRosterView(view) {
        const nextView = view === "matchday" ? "matchday" : "season";
        activeRosterView = nextView;

        rosterViewPanes.forEach((pane) => {
          const isActive = pane.dataset.rosterView === nextView;
          pane.hidden = !isActive;
        });

        rosterViewTriggers.forEach((button) => {
          const isActive = button.dataset.rosterViewTrigger === nextView;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-selected", String(isActive));
        });
      }

      function setMatchdayUiLocked(locked) {
        playerSearch.disabled = locked;
        if (playerTierFilter) {
          playerTierFilter.disabled = locked;
        }
        replacementPlayerSelect.disabled = locked;
        replacementTierStatusSelect.disabled = locked;
        replacementAttendanceStatusSelect.disabled = locked;
        replacementAddButton.disabled = locked;
        goalsPointsToggle.disabled = locked;
        attendancePointsInput.disabled = locked;
        winPointsInput.disabled = locked;
        drawPointsInput.disabled = locked;
        lossPointsInput.disabled = locked;
        goalKeepPointsInput.disabled = locked;
        teamGoalPointsInput.disabled = locked;
        saveScoringButton.disabled = locked;
        rosterViewTriggers.forEach((button) => {
          button.disabled = locked;
        });
        teamDisplayGrid.querySelectorAll("input").forEach((input) => {
          input.disabled = locked || !teamDisplaySupported;
        });
        resetTeamDisplayButton.disabled = locked || !teamDisplaySupported;
        saveTeamDisplayButton.disabled = locked || !teamDisplaySupported;
        priorityFillButton.disabled = locked;
        if (attendanceStep) {
          attendanceStep.hidden = locked;
        }
        if (teamsStep) {
          teamsStep.hidden = locked;
        }
        if (scoresStep) {
          scoresStep.hidden = locked;
        }
        if (locked) {
          if (openPlayerStatsLink) {
            openPlayerStatsLink.href = "./submissions.html?preview=1";
          }
          showDashboardTabOnly();
        }
      }

      function syncReplacementDefaults() {
        const selectedReplacement = parseReplacementSelection(replacementPlayerSelect.value);
        const fallbackTier = selectedReplacement?.source === "season"
          ? selectedReplacement.row?.tier_status
          : (selectedReplacement?.player?.desired_tier || selectedReplacement?.player?.status);

        replacementTierStatusSelect.value = fallbackTier || "flex";
      }

      function renderReplacementTools() {
        if (!season) {
          replacementPlayerSelect.innerHTML = `<option value="">Choose a replacement player</option>`;
          replacementPlayerSelect.disabled = true;
          replacementTierStatusSelect.disabled = true;
          replacementAttendanceStatusSelect.disabled = true;
          replacementAddButton.disabled = true;
          replacementNote.textContent = "Open a matchday first. Replacements can only be added after the season loads.";
          openSeasonRosterLink.href = "./seasons.html";
          return;
        }

        openSeasonRosterLink.href = `./seasons.html?season_id=${season.id}#active-roster`;
        const inactiveSeasonPlayers = [...seasonRosterRows]
          .filter((row) => row.player && row.is_eligible === false)
          .sort((left, right) => compareNames(left.player, right.player));
        const addablePlayers = [...clubPlayers]
          .filter((player) => !seasonRosterPlayerIds.has(player.id))
          .sort((left, right) => compareNames(left, right));

        replacementPlayerSelect.innerHTML = `
          <option value="">Choose a replacement player</option>
          ${
            inactiveSeasonPlayers.length
              ? `
                <optgroup label="Inactive season squad">
                  ${inactiveSeasonPlayers
                    .map(
                      (row) =>
                        `<option value="season:${row.id}">${escapeHtml(displayName(row.player))} · ${escapeHtml(
                          row.player.nationality || "Season squad"
                        )} · ${escapeHtml(formatStatusLabel(row.tier_status))} · Inactive</option>`
                    )
                    .join("")}
                </optgroup>
              `
              : ""
          }
          ${
            addablePlayers.length
              ? `
                <optgroup label="Squad register">
                  ${addablePlayers
                    .map(
                      (player) =>
                        `<option value="directory:${player.id}">${escapeHtml(displayName(player))} · ${escapeHtml(
                          player.nationality || "Full squad player"
                        )} · current/next-season ${escapeHtml(
                          player.status === "sub" ? "Sub" : formatStatusLabel(player.status)
                        )}</option>`
                    )
                    .join("")}
                </optgroup>
              `
              : ""
          }
        `;

        const hasChoices = inactiveSeasonPlayers.length > 0 || addablePlayers.length > 0;

        replacementPlayerSelect.disabled = !hasChoices;
        replacementTierStatusSelect.disabled = !hasChoices;
        replacementAttendanceStatusSelect.disabled = !hasChoices;
        replacementAddButton.disabled = !hasChoices;

        if (!hasChoices) {
          replacementNote.textContent = "Every full-squad player is already on this season squad and no inactive season player needs reactivation. Use the availability list below for late swaps.";
        } else if (inactiveSeasonPlayers.length && addablePlayers.length) {
          replacementNote.textContent = "Choose an inactive season player to reactivate, or add a new full-squad player into this season before team assignment.";
        } else if (inactiveSeasonPlayers.length) {
          replacementNote.textContent = "Choose an inactive season player to reactivate for this matchday, then continue with attendance and team assignment.";
        } else if (!seasonRosterMetadataSupported) {
          replacementNote.textContent = "Late additions still work. Extra signup fields are still in basic mode on this club build.";
        } else {
          replacementNote.textContent = "Add the replacement to this season. The default this season tier comes from the Full Squad current / next-season tier.";
        }

        syncReplacementDefaults();
      }

      async function addReplacementToSeason() {
        if (!season || !matchday) {
          setStatus("Open a matchday before adding a late replacement.", "warning");
          return;
        }

        const selectedReplacement = parseReplacementSelection(replacementPlayerSelect.value);
        const player = selectedReplacement?.player || null;

        if (!selectedReplacement || !player) {
          setStatus("Choose a replacement player first.", "warning");
          return;
        }

        const tierStatus = normalizeTierValue(
          replacementTierStatusSelect.value || player.status,
          "flex"
        );
        const attendanceStatus = normalizeText(replacementAttendanceStatusSelect.value || "available").toLowerCase();

        replacementAddButton.disabled = true;
        replacementAddButton.textContent = "Adding...";
        setStatus(`Adding ${displayName(player)} to ${season.name} as a late replacement...`);

        try {
          if (selectedReplacement.source === "season") {
            const { error: seasonPlayerError } = await supabaseClient
              .from("season_players")
              .update({
                tier_status: tierStatus,
                tier_reason: "Reactivated from Match Centre as a late replacement.",
                movement_note: "Season squad slot reactivated from Match Centre.",
                is_eligible: true,
              })
              .eq("id", selectedReplacement.row.id);

            if (seasonPlayerError) {
              throw seasonPlayerError;
            }
          } else {
            const seasonPlayerPayload = {
              season_id: season.id,
              player_id: player.id,
              tier_status: tierStatus,
              tier_reason: "Added from Match Centre as a late replacement.",
              movement_note: "Late replacement added on matchday control.",
              is_eligible: true,
            };

            if (seasonRosterMetadataSupported) {
              seasonPlayerPayload.registration_tier = player.desired_tier || player.status || tierStatus;
              seasonPlayerPayload.payment_status = "unknown";
            }

            const { error: seasonPlayerError } = await supabaseClient
              .from("season_players")
              .insert(seasonPlayerPayload);

            if (seasonPlayerError) {
              throw seasonPlayerError;
            }
          }

          const { error: statsError } = await supabaseClient
            .from("matchday_player_stats")
            .upsert(
              {
                matchday_id: matchday.id,
                player_id: player.id,
                attended: attendanceStatus === "in",
                attendance_status: attendanceStatus,
                goals: 0,
                goal_keeps: 0,
                clean_sheet: false,
              },
              { onConflict: "matchday_id,player_id" }
            );

          if (statsError) {
            throw statsError;
          }

          replacementPlayerSelect.value = "";
          replacementAttendanceStatusSelect.value = "available";
          await loadMatchdayEngine();
          setStatus(
            `${displayName(player)} ${
              selectedReplacement.source === "season" ? "reactivated on" : "added to"
            } ${season.name} and marked ${ATTENDANCE_STATUS_LABELS[attendanceStatus] || "Available"}.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          replacementAddButton.disabled = false;
          replacementAddButton.textContent = "Add replacement to season";
        }
      }

      function resolveSeasonMatchdayId(matchdayRows, matchRows) {
        const orderedMatchdays = [...(matchdayRows || [])].sort(
          (left, right) => left.matchday_number - right.matchday_number
        );

        if (!orderedMatchdays.length) {
          return null;
        }

        const nextOpen = orderedMatchdays.find(
          (row) => !summarizeMatchdayProgress(row, matchRows || []).isComplete
        );

        return nextOpen?.id || orderedMatchdays.at(-1)?.id || null;
      }

      function redirectToMatchday(nextMatchdayId, seasonId) {
        if (!nextMatchdayId) {
          return;
        }

        const url = new URL(window.location.href);
        url.searchParams.set("season_id", String(seasonId));
        url.searchParams.set("matchday_id", String(nextMatchdayId));
        window.location.replace(url.toString());
      }

      async function previewSeasonMatchday(seasonId) {
        if (!Number.isInteger(seasonId) || seasonId <= 0) {
          launcherTargetMatchdayId = null;
          openSeasonMatchdayButton.disabled = true;
          matchdayLauncherNote.textContent = "Choose a season to continue.";
          void syncMatchdayWeather(null);
          return;
        }

        const selectedSeason = launcherSeasons.find((entry) => entry.id === seasonId) || null;

        if (!selectedSeason) {
          launcherTargetMatchdayId = null;
          openSeasonMatchdayButton.disabled = true;
          matchdayLauncherNote.textContent = "That season is not available right now.";
          void syncMatchdayWeather(null);
          return;
        }

        const { data: matchdayRows, error: matchdayError } = await supabaseClient
          .from("matchdays")
          .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
          .eq("season_id", seasonId)
          .order("matchday_number", { ascending: true });

        if (matchdayError) {
          throw matchdayError;
        }

        const matchdayIds = (matchdayRows || []).map((row) => row.id);
        let matchRows = [];

        if (matchdayIds.length) {
          const { data, error } = await supabaseClient
            .from("matchday_matches")
            .select("matchday_id, round_number, match_order, home_team_code, away_team_code, home_score, away_score")
            .in("matchday_id", matchdayIds);

          if (error) {
            throw error;
          }

          matchRows = data || [];
        }

        launcherTargetMatchdayId = resolveSeasonMatchdayId(matchdayRows, matchRows);
        openSeasonMatchdayButton.disabled = !launcherTargetMatchdayId;

        if (!launcherTargetMatchdayId) {
          matchdayLauncherNote.textContent = `${selectedSeason.name} has no matchdays yet. Open Season Centre first and build its fixture list.`;
          void syncMatchdayWeather(null);
          return;
        }

        const targetRow = (matchdayRows || []).find((row) => row.id === launcherTargetMatchdayId) || null;
        const progress = targetRow
          ? summarizeMatchdayProgress(targetRow, matchRows)
          : null;

        // FIX: replace the old dead-end "go back to seasons" error with a season-scoped launcher
        // that previews which matchday will open next.
        matchdayLauncherNote.textContent = progress?.isComplete
          ? `${selectedSeason.name} is fully scored. Opening Matchday ${targetRow.matchday_number} lets you review the latest completed day.`
          : `${selectedSeason.name} will open Matchday ${targetRow.matchday_number}, the next incomplete day.`;
        void syncMatchdayWeather(targetRow);
      }

      async function loadMatchdayLauncher() {
        matchday = null;
        season = null;
        players = [];
        assignments = [];
        matches = [];
        clubPlayers = [];
        seasonRosterRows = [];
        seasonRosterPlayerIds = new Set();
        statsByPlayerId = new Map();
        tierMetricsByPlayerId = new Map();
        rosterPlan = null;
        historicalAssignments = [];
        matchdayLauncherBlock.hidden = false;
        setMatchdayUiLocked(true);
        heroCopy.textContent =
          "Choose a campaign first. Match Centre opens the next incomplete night for that season and only uses that season's active season squad.";
        matchdayInfoCopy.textContent =
          "Choose the campaign you want to run. If it already has matchdays, this page takes you directly to the right one. Only players already added to that season squad, not just the full squad register, will load into Match Centre.";
        renderReplacementTools();
        void syncMatchdayWeather(null);
        if (openPlayerStatsLink) {
          openPlayerStatsLink.href = "./submissions.html?preview=1";
        }

        const { data: seasonRows, error } = await supabaseClient
          .from("seasons")
          .select("id, name, created_at")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        launcherSeasons = sortSeasonsChronologically(seasonRows || []);

        if (!launcherSeasons.length) {
          launcherTargetMatchdayId = null;
          matchdaySeasonSelect.innerHTML = `<option value="">No seasons yet</option>`;
          openSeasonMatchdayButton.disabled = true;
          matchdayLauncherCopy.textContent = "No campaign exists yet. Launch one first, then this page can open its current night for you.";
          matchdayLauncherNote.textContent = "Launch a campaign in Season Centre to start using Match Centre.";
          setStatus("No campaign exists yet. Open Season Centre and launch one first.", "warning");
          return;
        }

        const selectedSeasonId =
          launcherSeasons.some((entry) => entry.id === requestedSeasonId)
            ? requestedSeasonId
            : launcherSeasons[launcherSeasons.length - 1].id;

        matchdaySeasonSelect.innerHTML = launcherSeasons
          .map(
            (entry) =>
              `<option value="${escapeHtml(entry.id)}" ${entry.id === selectedSeasonId ? "selected" : ""}>${escapeHtml(entry.name)}</option>`
          )
          .join("");

        await previewSeasonMatchday(selectedSeasonId);
        setStatus("Choose the season you want to open.", "warning");

        if (requestedSeasonId && launcherTargetMatchdayId) {
          redirectToMatchday(launcherTargetMatchdayId, selectedSeasonId);
        }
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

      function goalsCountLabel(enabled) {
        return enabled ? "Goals count" : "Tiebreak only";
      }

      function syncGoalsPointsToggle() {
        const enabled = Boolean(matchday?.goals_count_as_points);

        goalsPointsToggle.textContent = goalsCountLabel(enabled);
        goalsPointsToggle.classList.toggle("active", enabled);
        goalsPointsCopy.textContent = enabled
          ? `Team goals from this matchday add ${season?.team_goal_points ?? 1} point${Number(season?.team_goal_points ?? 1) === 1 ? "" : "s"} each for players on that team.`
          : "Team goals stay as tie-breakers only for this matchday.";
      }

      function scoringSettingsFromInputs() {
        return {
          attendance_points: Number(attendancePointsInput.value),
          win_points: Number(winPointsInput.value),
          draw_points: Number(drawPointsInput.value),
          loss_points: Number(lossPointsInput.value),
          goal_keep_points: Number(goalKeepPointsInput.value),
          team_goal_points: Number(teamGoalPointsInput.value),
        };
      }

      function syncScoringSettingsFields() {
        const scoring = buildScoringSettings(season);
        attendancePointsInput.value = String(scoring.attendance_points);
        winPointsInput.value = String(scoring.win_points);
        drawPointsInput.value = String(scoring.draw_points);
        lossPointsInput.value = String(scoring.loss_points);
        goalKeepPointsInput.value = String(scoring.goal_keep_points);
        teamGoalPointsInput.value = String(scoring.team_goal_points);
      }

      function formatStatusLabel(value) {
        const normalized = normalizeTierValue(value, "");
        if (normalized === "sub") {
          return "Sub";
        }

        return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Flex";
      }

      function formatAttendanceStatusLabel(value) {
        return ATTENDANCE_STATUS_LABELS[value === "attended" ? "in" : value] || "Out";
      }

      function priorityWeight(status) {
        const lookup = {
          core: 0,
          flex: 1,
          sub: 2,
        };

        return lookup[normalizeTierValue(status, "")] ?? 3;
      }

      function priorityMetrics(playerId) {
        const row = tierMetricsByPlayerId.get(playerId);
        return {
          games_attended: Number(row?.games_attended || 0),
          attendance_score: Number(row?.attendance_score || 0),
          no_shows: Number(row?.no_shows || 0),
          recent_games_attended: Number(row?.recent_games_attended || 0),
          is_eligible: row?.is_eligible !== false,
        };
      }

      function rotationStandingsMetrics(playerId) {
        const row = rotationStandingsByPlayerId.get(playerId);

        return {
          total_points: Number(row?.total_points || 0),
          points_per_game: Number(row?.points_per_game || 0),
          games_played: Number(row?.games_played || 0),
          wins: Number(row?.wins || 0),
          draws: Number(row?.draws || 0),
          losses: Number(row?.losses || 0),
          goals: Number(row?.goals || 0),
          goal_keep_points_earned: Number(
            row?.goal_keep_points_earned ?? row?.goalie_points ?? row?.goal_keeps ?? 0
          ),
          clean_sheets: Number(row?.clean_sheets || 0),
          attendance_points: Number(row?.attendance_points || 0),
        };
      }

      function candidateForRoster(playerId) {
        if (!statsByPlayerId.has(playerId)) {
          return true;
        }

        const status = getAttendanceStatus(playerId);
        return status === "available" || status === "in";
      }

      function compareNames(left, right) {
        return displayName(left).localeCompare(displayName(right));
      }

      function playerOriginLabel(player) {
        return normalizeText(player.nationality || "") || "Unknown";
      }

      function rosterPlanRow(playerId) {
        return rosterPlan?.byPlayerId.get(playerId) || null;
      }

      function rosterDisplayRow(playerId) {
        return rosterDisplayPlan?.byPlayerId.get(playerId) || null;
      }

      function formatPlanBadgeLabel(row) {
        if (!row) {
          return "";
        }

        if (row.bucket === "flex") {
          return `Flex #${row.queuePosition}`;
        }

        if (row.bucket === "depth") {
          return `${formatStatusLabel(row.player.status)} #${row.queuePosition}`;
        }

        return `Core #${row.queuePosition}`;
      }

      function formatPlanQueueState(row) {
        if (!row) {
          return "";
        }

        if (row.selected) {
          return "Priority in";
        }

        return row.bucket === "flex" ? "Next up" : "Waiting";
      }

      function priorityStatSummary(player, row = rosterPlanRow(player.id)) {
        const metrics = priorityMetrics(player.id);
        const standingMetrics = rotationStandingsMetrics(player.id);
        const usesStandingsPoints =
          (row?.bucket === "flex" || player.status === "flex") &&
          activeRotationQueueMode === "final";

        return {
          label: usesStandingsPoints ? "Pts" : "Score",
          value: usesStandingsPoints ? Number(standingMetrics.total_points || 0) : metrics.attendance_score,
          metrics,
        };
      }

      function compareByRosterPlan(left, right) {
        const leftPlan = rosterPlan?.byPlayerId.get(left.id);
        const rightPlan = rosterPlan?.byPlayerId.get(right.id);

        if (leftPlan && rightPlan && leftPlan.order !== rightPlan.order) {
          return leftPlan.order - rightPlan.order;
        }

        if (leftPlan && !rightPlan) {
          return -1;
        }

        if (!leftPlan && rightPlan) {
          return 1;
        }

        if (priorityWeight(left.status) !== priorityWeight(right.status)) {
          return priorityWeight(left.status) - priorityWeight(right.status);
        }

        return compareNames(left, right);
      }

      function compareByRosterDisplay(left, right) {
        const leftRow = rosterDisplayRow(left.id);
        const rightRow = rosterDisplayRow(right.id);

        if (leftRow && rightRow && leftRow.order !== rightRow.order) {
          return leftRow.order - rightRow.order;
        }

        if (leftRow && !rightRow) {
          return -1;
        }

        if (!leftRow && rightRow) {
          return 1;
        }

        if (priorityWeight(left.status) !== priorityWeight(right.status)) {
          return priorityWeight(left.status) - priorityWeight(right.status);
        }

        return compareNames(left, right);
      }

      function sortCoreCandidates(list) {
        return [...list].sort((left, right) => {
          const leftMetrics = priorityMetrics(left.id);
          const rightMetrics = priorityMetrics(right.id);

          if (rightMetrics.attendance_score !== leftMetrics.attendance_score) {
            return rightMetrics.attendance_score - leftMetrics.attendance_score;
          }

          if (rightMetrics.recent_games_attended !== leftMetrics.recent_games_attended) {
            return rightMetrics.recent_games_attended - leftMetrics.recent_games_attended;
          }

          return compareNames(left, right);
        });
      }

      function sortRotationCandidates(list) {
        return [...list]
          .map((player) => ({
            player,
            queueRow: {
              ...player,
              ...priorityMetrics(player.id),
              ...rotationStandingsMetrics(player.id),
            },
          }))
          .sort((left, right) =>
            compareRotationQueuePriority(left.queueRow, right.queueRow, {
              finalMatchday: activeRotationQueueMode === "final",
            })
          )
          .map((entry) => entry.player);
      }

      function sortDepthCandidates(list) {
        return [...list].sort((left, right) => {
          const leftMetrics = priorityMetrics(left.id);
          const rightMetrics = priorityMetrics(right.id);

          if (rightMetrics.attendance_score !== leftMetrics.attendance_score) {
            return rightMetrics.attendance_score - leftMetrics.attendance_score;
          }

          if (rightMetrics.recent_games_attended !== leftMetrics.recent_games_attended) {
            return rightMetrics.recent_games_attended - leftMetrics.recent_games_attended;
          }

          if (leftMetrics.no_shows !== rightMetrics.no_shows) {
            return leftMetrics.no_shows - rightMetrics.no_shows;
          }

          return compareNames(left, right);
        });
      }

      function buildRosterPlan() {
        const availablePlayers = players.filter((player) => candidateForRoster(player.id));
        const corePlayers = sortCoreCandidates(
          availablePlayers.filter((player) => player.status === "core" && priorityMetrics(player.id).is_eligible)
        );
        const rotationPlayers = sortRotationCandidates(
          availablePlayers.filter((player) => player.status === "flex" && priorityMetrics(player.id).is_eligible)
        );
        const depthPlayers = sortDepthCandidates(
          availablePlayers.filter((player) => {
            if (player.status === "core" || player.status === "flex") {
              return false;
            }

            return priorityMetrics(player.id).is_eligible;
          })
        );

        const selectedIds = new Set();
        const planRows = [];
        let order = 1;

        const coreSlots = Math.max(ROSTER_CAP - selectedIds.size, 0);
        corePlayers.forEach((player, index) => {
          const selected = index < coreSlots;
          if (selected) {
            selectedIds.add(player.id);
          }
          planRows.push({
            player,
            slotLabel: `Core #${index + 1}`,
            bucket: "core",
            queuePosition: index + 1,
            selected,
            order: order++,
          });
        });

        const rotationSlots = Math.max(ROSTER_CAP - selectedIds.size, 0);
        rotationPlayers.forEach((player, index) => {
          const selected = index < rotationSlots;
          if (selected) {
            selectedIds.add(player.id);
          }
          planRows.push({
            player,
            slotLabel: `Queue #${index + 1}`,
            bucket: "flex",
            queuePosition: index + 1,
            selected,
            order: order++,
          });
        });

        const depthSlots = Math.max(ROSTER_CAP - selectedIds.size, 0);
        depthPlayers.forEach((player, index) => {
          const selected = index < depthSlots;
          if (selected) {
            selectedIds.add(player.id);
          }
          planRows.push({
            player,
            slotLabel: `Depth #${index + 1}`,
            bucket: "depth",
            queuePosition: index + 1,
            selected,
            order: order++,
          });
        });

        const byPlayerId = new Map(planRows.map((row) => [row.player.id, row]));

        return {
          availablePlayers,
          corePlayers,
          rotationPlayers,
          depthPlayers,
          selectedIds,
          byPlayerId,
          selectedCount: selectedIds.size,
          selectedCoreCount: planRows.filter((row) => row.selected && row.bucket === "core").length,
          selectedRotationCount: planRows.filter((row) => row.selected && row.bucket === "flex").length,
          selectedDepthCount: planRows.filter((row) => row.selected && row.bucket === "depth").length,
          waitingCount: planRows.filter((row) => !row.selected).length,
          openSpots: Math.max(ROSTER_CAP - selectedIds.size, 0),
          planRows,
        };
      }

      function buildRosterDisplayPlan() {
        const corePlayers = sortCoreCandidates(players.filter((player) => player.status === "core"));
        const rotationPlayers = sortRotationCandidates(players.filter((player) => player.status === "flex"));
        const depthPlayers = sortDepthCandidates(
          players.filter((player) => player.status !== "core" && player.status !== "flex")
        );

        const planRows = [];
        let order = 1;

        corePlayers.forEach((player, index) => {
          planRows.push({
            player,
            bucket: "core",
            queuePosition: index + 1,
            selected: false,
            order: order++,
          });
        });

        rotationPlayers.forEach((player, index) => {
          planRows.push({
            player,
            bucket: "flex",
            queuePosition: index + 1,
            selected: false,
            order: order++,
          });
        });

        depthPlayers.forEach((player, index) => {
          planRows.push({
            player,
            bucket: "depth",
            queuePosition: index + 1,
            selected: false,
            order: order++,
          });
        });

        return {
          byPlayerId: new Map(planRows.map((row) => [row.player.id, row])),
        };
      }

      function planBadgeMarkup(playerId) {
        const row = rosterPlanRow(playerId) || rosterDisplayRow(playerId);
        if (!row) {
          return "";
        }

        return `<span class="tag-pill ${row.selected ? "plan-selected" : "plan-waiting"}">${escapeHtml(formatPlanBadgeLabel(row))}</span>`;
      }

      function formatDateTime(value) {
        return new Date(value).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }

      function readableError(error) {
        const message = error?.message || "Unknown error";
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("relation")) {
          return "Match Centre cannot open until live club data is ready.";
        }

        if (lowerMessage.includes("column") || lowerMessage.includes("schema cache")) {
          return "Match Centre is waiting for the latest live club update.";
        }

        if (error?.code === "23505") {
          return "That row already exists for this matchday.";
        }

        if (lowerMessage.includes("must belong to the season roster")) {
          return "That player is not on this season squad yet. Add them on the Seasons page before saving matchday attendance, teams, or stats.";
        }

        if (lowerMessage.includes("must be core or flex before saving a captain row")) {
          return "Captains must come from the current core or flex pool for this season.";
        }

        if (lowerMessage.includes("must be assigned to team") && lowerMessage.includes("captain row")) {
          return "Choose a player who is currently assigned to that team before saving the captain.";
        }

        if (lowerMessage.includes("captain tier") && lowerMessage.includes("does not match")) {
          return "That captain selection is stale. Reload the page and choose from the current core or flex team list.";
        }

        if (lowerMessage.includes("final_captain_order_enabled")) {
          return "This captain mode toggle needs the latest SQL update before it can be saved.";
        }

        if (lowerMessage.includes("cannot move matchday")) {
          return "This matchday already has players tied to its current season. Add those players to the destination season squad or clear the matchday activity before changing seasons.";
        }

        return message;
      }

      function getSearchValue() {
        return normalizeText(playerSearch.value).toLowerCase();
      }

      function getTierFilterValue() {
        return normalizeText(playerTierFilter?.value || "all").toLowerCase();
      }

      function playerMatchesSearch(player) {
        const searchValue = getSearchValue();

        if (!searchValue) {
          return true;
        }

        const haystack = [
          player.first_name,
          player.last_name,
          player.nickname || "",
          player.nationality || "",
          ...(player.positions || []),
          player.status || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(searchValue);
      }

      function playerMatchesTierFilter(player) {
        const tierFilterValue = getTierFilterValue();

        if (!tierFilterValue || tierFilterValue === "all") {
          return true;
        }

        return normalizeText(player.status || "").toLowerCase() === tierFilterValue;
      }

      function playerMatchesFilters(player) {
        return playerMatchesSearch(player) && playerMatchesTierFilter(player);
      }

      function getPlayerStats(playerId) {
        return (
          statsByPlayerId.get(playerId) || {
            attended: false,
            attendance_status: "out",
            goals: 0,
            goal_keeps: 0,
            clean_sheet: false,
          }
        );
      }

      function getAttendanceStatus(playerId) {
        const stats = getPlayerStats(playerId);

        if (stats.attendance_status && stats.attendance_status !== "out") {
          return stats.attendance_status === "attended" ? "in" : stats.attendance_status;
        }

        return stats.attended ? "in" : "out";
      }

      function isAttending(playerId) {
        return getAttendanceStatus(playerId) === "in";
      }

      function getAssignment(playerId) {
        return assignments.find((assignment) => assignment.player_id === playerId) || null;
      }

      function getTeamCount(teamCode) {
        return assignments.filter((assignment) => assignment.team_code === teamCode).length;
      }

      function getTeamPlayers(teamCode) {
        return players
          .filter((player) => {
            if (!isAttending(player.id)) {
              return false;
            }

            const assignment = getAssignment(player.id);

            if (!assignment || assignment.team_code !== teamCode) {
              return false;
            }

            return playerMatchesFilters(player);
          })
          .sort(compareByRosterPlan);
      }

      function getUnassignedPlayers() {
        return players
          .filter((player) => {
            if (!isAttending(player.id)) {
              return false;
            }

            if (getAssignment(player.id)) {
              return false;
            }

            return playerMatchesFilters(player);
          })
          .sort(compareByRosterPlan);
      }

      function getAttendingPlayers() {
        return players.filter((player) => isAttending(player.id));
      }

      function findSeasonRosterRowByPlayerId(playerId) {
        return seasonRosterRows.find((row) => row.player_id === playerId) || null;
      }

      function findKnownPlayerById(playerId) {
        return (
          players.find((player) => player.id === playerId) ||
          findSeasonRosterRowByPlayerId(playerId)?.player ||
          clubPlayers.find((player) => player.id === playerId) ||
          null
        );
      }

      function currentTierStatusForPlayer(playerId) {
        const seasonRow = findSeasonRosterRowByPlayerId(playerId);
        const player = findKnownPlayerById(playerId);
        return normalizeTierValue(seasonRow?.tier_status || player?.status || player?.desired_tier, "");
      }

      function isCaptainEligiblePlayer(player) {
        const tierStatus = normalizeTierValue(player?.status || player?.desired_tier, "");
        return tierStatus === "core" || tierStatus === "flex";
      }

      function captainRowsForHistory(includeCurrent = true) {
        return includeCurrent ? [...historicalCaptainRows, ...captainRows] : [...historicalCaptainRows];
      }

      function buildCaptainHistoryCountMap(includeCurrent = true) {
        const countsByPlayerId = new Map();

        captainRowsForHistory(includeCurrent).forEach((row) => {
          const playerId = Number(row?.player_id);
          if (!Number.isFinite(playerId)) {
            return;
          }

          countsByPlayerId.set(playerId, Number(countsByPlayerId.get(playerId) || 0) + 1);
        });

        return countsByPlayerId;
      }

      function captainCountForPlayer(playerId, includeCurrent = true) {
        return Number(buildCaptainHistoryCountMap(includeCurrent).get(playerId) || 0);
      }

      function finalCaptainOrderEnabled() {
        return matchday?.final_captain_order_enabled !== false;
      }

      function getCaptainByTeamCode(teamCode) {
        return captainRows.find((row) => row.team_code === teamCode) || null;
      }

      function getCaptainByPlayerId(playerId) {
        return captainRows.find((row) => row.player_id === playerId) || null;
      }

      function getAllTeamPlayers(teamCode) {
        return players
          .filter((player) => {
            if (!isAttending(player.id)) {
              return false;
            }

            return getAssignment(player.id)?.team_code === teamCode;
          })
          .sort(compareByRosterPlan);
      }

      function getCaptainCandidatePlayers(teamCode) {
        return getAllTeamPlayers(teamCode).filter((player) => isCaptainEligiblePlayer(player));
      }

      function compareCaptainCandidates(left, right, countsByPlayerId) {
        const leftCount = Number(countsByPlayerId.get(left.id) || 0);
        const rightCount = Number(countsByPlayerId.get(right.id) || 0);

        if (leftCount !== rightCount) {
          return leftCount - rightCount;
        }

        const leftMetrics = priorityMetrics(left.id);
        const rightMetrics = priorityMetrics(right.id);

        if (rightMetrics.attendance_score !== leftMetrics.attendance_score) {
          return rightMetrics.attendance_score - leftMetrics.attendance_score;
        }

        if (rightMetrics.recent_games_attended !== leftMetrics.recent_games_attended) {
          return rightMetrics.recent_games_attended - leftMetrics.recent_games_attended;
        }

        if (leftMetrics.no_shows !== rightMetrics.no_shows) {
          return leftMetrics.no_shows - rightMetrics.no_shows;
        }

        if (priorityWeight(left.status) !== priorityWeight(right.status)) {
          return priorityWeight(left.status) - priorityWeight(right.status);
        }

        return compareNames(left, right);
      }

      function pickCaptainCandidateForTeam(teamCode, countsByPlayerId) {
        const candidates = getCaptainCandidatePlayers(teamCode).sort((left, right) =>
          compareCaptainCandidates(left, right, countsByPlayerId)
        );

        return candidates[0] || null;
      }

      function normalizeCaptainSelectionMethod(value) {
        const normalized = normalizeText(value).toLowerCase();

        if (normalized === "manual" || normalized === "replacement") {
          return normalized;
        }

        return "auto";
      }

      function compareFinalCoreCaptainCandidates(left, right) {
        const leftMetrics = rotationStandingsMetrics(left.id);
        const rightMetrics = rotationStandingsMetrics(right.id);

        if (rightMetrics.total_points !== leftMetrics.total_points) {
          return rightMetrics.total_points - leftMetrics.total_points;
        }

        if (rightMetrics.points_per_game !== leftMetrics.points_per_game) {
          return rightMetrics.points_per_game - leftMetrics.points_per_game;
        }

        if (rightMetrics.wins !== leftMetrics.wins) {
          return rightMetrics.wins - leftMetrics.wins;
        }

        if (rightMetrics.draws !== leftMetrics.draws) {
          return rightMetrics.draws - leftMetrics.draws;
        }

        if (leftMetrics.losses !== rightMetrics.losses) {
          return leftMetrics.losses - rightMetrics.losses;
        }

        if (rightMetrics.goals !== leftMetrics.goals) {
          return rightMetrics.goals - leftMetrics.goals;
        }

        if (rightMetrics.goal_keep_points_earned !== leftMetrics.goal_keep_points_earned) {
          return rightMetrics.goal_keep_points_earned - leftMetrics.goal_keep_points_earned;
        }

        if (rightMetrics.clean_sheets !== leftMetrics.clean_sheets) {
          return rightMetrics.clean_sheets - leftMetrics.clean_sheets;
        }

        if (rightMetrics.attendance_points !== leftMetrics.attendance_points) {
          return rightMetrics.attendance_points - leftMetrics.attendance_points;
        }

        return compareNames(left, right);
      }

      function compareFinalFlexCaptainCandidates(left, right) {
        const leftQueueRow = {
          ...left,
          ...priorityMetrics(left.id),
          ...rotationStandingsMetrics(left.id),
        };
        const rightQueueRow = {
          ...right,
          ...priorityMetrics(right.id),
          ...rotationStandingsMetrics(right.id),
        };

        return compareRotationQueuePriority(leftQueueRow, rightQueueRow, {
          finalMatchday: true,
        });
      }

      function buildCaptainPayload(teamCode, playerId, currentByTeam, options = {}) {
        const currentCaptain = currentByTeam.get(teamCode) || null;

        return {
          matchday_id: matchday.id,
          team_code: teamCode,
          player_id: playerId,
          captain_tier: currentTierStatusForPlayer(playerId) || "flex",
          selection_method:
            options.selectionMethod ||
            (options.resetAll
              ? "auto"
              : currentCaptain
                ? "replacement"
                : "auto"),
        };
      }

      function appendRankedCaptainTargets(
        desiredRows,
        candidates,
        limit,
        currentByTeam,
        claimedTeamCodes,
        usedPlayerIds,
        options = {}
      ) {
        let selectedCount = 0;

        candidates.forEach((player) => {
          if (selectedCount >= limit) {
            return;
          }

          const playerId = Number(player?.id);
          const teamCode = normalizeText(getAssignment(playerId)?.team_code).toLowerCase();

          if (!Number.isFinite(playerId) || !teamCode) {
            return;
          }

          if (claimedTeamCodes.has(teamCode) || usedPlayerIds.has(playerId)) {
            return;
          }

          desiredRows.push(buildCaptainPayload(teamCode, playerId, currentByTeam, options));
          claimedTeamCodes.add(teamCode);
          usedPlayerIds.add(playerId);
          selectedCount += 1;
        });
      }

      function buildFinalMatchdayCaptainRows(currentByTeam, options = {}) {
        const resetAll = options.resetAll === true;
        const desiredRows = [];
        const claimedTeamCodes = new Set();
        const usedPlayerIds = new Set();

        if (!resetAll) {
          TEAM_CONFIG.forEach((team) => {
            const teamCode = team.code;
            const currentCaptain = currentByTeam.get(teamCode) || null;

            if (
              !currentCaptain ||
              !isCaptainRowValid(currentCaptain) ||
              normalizeCaptainSelectionMethod(currentCaptain.selection_method) !== "manual"
            ) {
              return;
            }

            const playerId = Number(currentCaptain.player_id);
            desiredRows.push(
              buildCaptainPayload(teamCode, playerId, currentByTeam, {
                resetAll,
                selectionMethod: "manual",
              })
            );
            claimedTeamCodes.add(teamCode);
            usedPlayerIds.add(playerId);
          });
        }

        const attendingEligiblePlayers = getAttendingPlayers().filter((player) => {
          if (!isCaptainEligiblePlayer(player)) {
            return false;
          }

          return Boolean(getAssignment(player.id)?.team_code);
        });
        const coreCandidates = attendingEligiblePlayers
          .filter((player) => currentTierStatusForPlayer(player.id) === "core")
          .sort(compareFinalCoreCaptainCandidates);
        const flexCandidates = attendingEligiblePlayers
          .filter((player) => currentTierStatusForPlayer(player.id) === "flex")
          .sort(compareFinalFlexCaptainCandidates);

        appendRankedCaptainTargets(
          desiredRows,
          coreCandidates,
          2,
          currentByTeam,
          claimedTeamCodes,
          usedPlayerIds,
          { resetAll }
        );
        appendRankedCaptainTargets(
          desiredRows,
          flexCandidates,
          2,
          currentByTeam,
          claimedTeamCodes,
          usedPlayerIds,
          { resetAll }
        );
        appendRankedCaptainTargets(
          desiredRows,
          [...coreCandidates, ...flexCandidates],
          Number.POSITIVE_INFINITY,
          currentByTeam,
          claimedTeamCodes,
          usedPlayerIds,
          { resetAll }
        );

        return desiredRows;
      }

      function isCaptainRowValid(captainRow) {
        if (!captainRow) {
          return false;
        }

        const playerId = Number(captainRow.player_id);
        const teamCode = normalizeText(captainRow.team_code).toLowerCase();
        const player = findKnownPlayerById(playerId);
        const assignment = getAssignment(playerId);

        if (!player || !assignment || assignment.team_code !== teamCode) {
          return false;
        }

        if (!isAttending(playerId)) {
          return false;
        }

        return isCaptainEligiblePlayer(player);
      }

      function formatCaptainSelectionMethod(value) {
        const normalized = normalizeCaptainSelectionMethod(value);

        if (normalized === "manual") {
          return "Manual";
        }

        if (normalized === "replacement") {
          return "Auto re-pick";
        }

        return "Auto";
      }

      function buildTeamBalanceOptions() {
        return {
          teamCodes: TEAM_CONFIG.map((team) => team.code),
          maxPlayersByTeam: TEAM_MAX_PLAYERS_BY_CODE,
          sizeSeed: Math.max(Number(matchday?.matchday_number || 1) - 1, 0),
          historicalAssignments,
        };
      }

      function currentTeamBalanceSummary() {
        return summarizeBalancedAssignments(
          getAttendingPlayers(),
          assignments,
          buildTeamBalanceOptions()
        );
      }

      function buildCaptainOverview() {
        const activeTeamCodes = TEAM_CONFIG
          .map((team) => team.code)
          .filter((teamCode) => getTeamCount(teamCode) > 0);
        const eligibleTeamCodes = activeTeamCodes.filter(
          (teamCode) => getCaptainCandidatePlayers(teamCode).length > 0
        );
        const currentCaptains = activeTeamCodes.filter((teamCode) =>
          isCaptainRowValid(getCaptainByTeamCode(teamCode))
        );
        const seasonHistoryRows = captainRowsForHistory(true);
        const uniqueCaptainIds = new Set(
          seasonHistoryRows
            .map((row) => Number(row?.player_id))
            .filter((playerId) => Number.isFinite(playerId))
        );

        return {
          activeTeamCodes,
          eligibleTeamCodes,
          currentCaptains,
          assignedCurrentCaptainCount: currentCaptains.length,
          activeTeamCount: activeTeamCodes.length,
          eligibleTeamCount: eligibleTeamCodes.length,
          missingEligibleCaptainCount: Math.max(eligibleTeamCodes.length - currentCaptains.length, 0),
          ineligibleActiveTeamCount: Math.max(activeTeamCodes.length - eligibleTeamCodes.length, 0),
          totalCaptainSlotsTracked: seasonHistoryRows.length,
          uniqueCaptainCount: uniqueCaptainIds.size,
        };
      }

      function buildCaptainLeaderboardRows() {
        const countsByPlayerId = buildCaptainHistoryCountMap(true);
        const lastMatchdayByPlayerId = new Map();

        captainRowsForHistory(true).forEach((row) => {
          const playerId = Number(row?.player_id);
          const matchdayNumber = Number(seasonMatchdayNumberById.get(Number(row?.matchday_id)) || 0);

          if (!Number.isFinite(playerId)) {
            return;
          }

          if (matchdayNumber > Number(lastMatchdayByPlayerId.get(playerId) || 0)) {
            lastMatchdayByPlayerId.set(playerId, matchdayNumber);
          }
        });

        return [...countsByPlayerId.entries()]
          .map(([playerId, count]) => {
            const player = findKnownPlayerById(playerId);
            return {
              playerId,
              player,
              name: player ? displayName(player) : `Player ${playerId}`,
              captainCount: count,
              lastMatchday: Number(lastMatchdayByPlayerId.get(playerId) || 0) || null,
              tierStatus: currentTierStatusForPlayer(playerId),
            };
          })
          .sort((left, right) => {
            if (right.captainCount !== left.captainCount) {
              return right.captainCount - left.captainCount;
            }

            if ((right.lastMatchday || 0) !== (left.lastMatchday || 0)) {
              return (right.lastMatchday || 0) - (left.lastMatchday || 0);
            }

            return left.name.localeCompare(right.name);
          });
      }

      async function syncCaptainsForCurrentTeams(options = {}) {
        if (!captainTrackingSupported || !matchday) {
          return { changed: false };
        }

        const resetAll = options.resetAll === true;
        const forceAutoRepick = options.forceAutoRepick === true;
        const currentByTeam = new Map(
          captainRows.map((row) => [normalizeText(row.team_code).toLowerCase(), row])
        );
        const finalMatchday = activeRotationQueueMode === "final" && finalCaptainOrderEnabled();
        const desiredRows = finalMatchday
          ? buildFinalMatchdayCaptainRows(currentByTeam, { resetAll })
          : [];

        if (!finalMatchday) {
          const historyCountsByPlayerId = buildCaptainHistoryCountMap(false);

          TEAM_CONFIG.forEach((team) => {
            const teamCode = team.code;
            const currentCaptain = currentByTeam.get(teamCode) || null;
            const eligiblePlayers = getCaptainCandidatePlayers(teamCode);

            if (!eligiblePlayers.length) {
              return;
            }

            const currentSelectionMethod = normalizeCaptainSelectionMethod(currentCaptain?.selection_method);

            if (
              !resetAll &&
              currentCaptain &&
              isCaptainRowValid(currentCaptain) &&
              (!forceAutoRepick || currentSelectionMethod === "manual")
            ) {
              desiredRows.push(
                buildCaptainPayload(teamCode, Number(currentCaptain.player_id), currentByTeam, {
                  resetAll,
                  selectionMethod: currentSelectionMethod,
                })
              );
              return;
            }

            const nextCaptain = pickCaptainCandidateForTeam(teamCode, historyCountsByPlayerId);

            if (!nextCaptain) {
              return;
            }

            desiredRows.push(
              buildCaptainPayload(teamCode, nextCaptain.id, currentByTeam, { resetAll })
            );
          });
        }

        const desiredByTeam = new Map(desiredRows.map((row) => [row.team_code, row]));
        const deleteIds = captainRows
          .filter((row) => !desiredByTeam.has(normalizeText(row.team_code).toLowerCase()))
          .map((row) => row.id);
        const upsertRows = desiredRows.filter((row) => {
          const currentCaptain = currentByTeam.get(row.team_code);

          if (!currentCaptain) {
            return true;
          }

          return (
            Number(currentCaptain.player_id) !== Number(row.player_id) ||
            normalizeText(currentCaptain.captain_tier).toLowerCase() !== row.captain_tier ||
            normalizeText(currentCaptain.selection_method).toLowerCase() !== row.selection_method
          );
        });

        if (!deleteIds.length && !upsertRows.length) {
          return { changed: false };
        }

        if (deleteIds.length) {
          const { error: deleteError } = await supabaseClient
            .from("matchday_team_captains")
            .delete()
            .in("id", deleteIds);

          if (deleteError) {
            throw deleteError;
          }
        }

        if (upsertRows.length) {
          const { error: upsertError } = await supabaseClient
            .from("matchday_team_captains")
            .upsert(upsertRows, { onConflict: "matchday_id,team_code" });

          if (upsertError) {
            throw upsertError;
          }
        }

        return { changed: true };
      }

      function formatBalanceMetric(value, suffix = "", digits = 1) {
        const numeric = Number(value);

        if (!Number.isFinite(numeric)) {
          return "n/a";
        }

        return `${numeric.toFixed(digits)}${suffix}`;
      }

      function formatTeamRoleCounts(primaryCounts) {
        return `G${Number(primaryCounts?.GK || 0)} D${Number(primaryCounts?.DEF || 0)} M${Number(
          primaryCounts?.MID || 0
        )} A${Number(primaryCounts?.ATT || 0)}`;
      }

      function teamBalanceSummaryMarkup(summary, teamCode) {
        const teamSummary = summary?.byTeamCode?.get(teamCode);

        if (!teamSummary) {
          return "";
        }

        return `
          <div class="compact-badges">
            <span class="tag-pill">Skill ${escapeHtml(formatBalanceMetric(teamSummary.averageSkill))}</span>
            <span class="tag-pill">Age ${escapeHtml(formatBalanceMetric(teamSummary.averageAge, "y"))}</span>
            <span class="tag-pill">${escapeHtml(formatTeamRoleCounts(teamSummary.primaryCounts))}</span>
            <span class="tag-pill">Repeat ${escapeHtml(formatBalanceMetric(teamSummary.teammateRepeatLoad, "", 0))}</span>
          </div>
        `;
      }

      function captainBadgeMarkup(playerId) {
        const captainRow = getCaptainByPlayerId(playerId);

        if (!captainRow) {
          return "";
        }

        return `<span class="captain-pill" aria-label="Captain" title="Captain">Ⓒ</span>`;
      }

      function captainControlsMarkup(teamCode) {
        if (!captainTrackingSupported) {
          return `
            <div class="team-captain-panel is-disabled">
              <strong>Captain</strong>
              <p class="micro-note">Run the captain tracking SQL upgrade to edit captains here.</p>
            </div>
          `;
        }

        const captainRow = getCaptainByTeamCode(teamCode);
        const candidates = getCaptainCandidatePlayers(teamCode);
        const captainPlayer = captainRow ? findKnownPlayerById(Number(captainRow.player_id)) : null;
        const seasonCaptainCount = captainRow ? captainCountForPlayer(Number(captainRow.player_id), true) : 0;

        return `
          <div class="team-captain-panel ${candidates.length ? "" : "is-empty"}">
            <div class="team-captain-copy">
              <strong>Captain</strong>
              <p class="micro-note">
                ${
                  captainPlayer
                    ? `${escapeHtml(displayName(captainPlayer))} is leading ${escapeHtml(teamLabel(teamCode))} right now.`
                    : candidates.length
                      ? `Pick a core or flex captain for ${escapeHtml(teamLabel(teamCode))}.`
                      : `${escapeHtml(teamLabel(teamCode))} needs at least one core or flex player before a captain can be assigned.`
                }
              </p>
            </div>
            <div class="captain-select-wrap">
              <label for="captain-select-${teamCode}">Captain</label>
              <select
                id="captain-select-${teamCode}"
                data-captain-team-code="${escapeHtml(teamCode)}"
                ${candidates.length ? "" : "disabled"}
              >
                ${
                  candidates.length
                    ? `
                        ${!captainRow ? '<option value="" selected disabled>Select captain</option>' : ""}
                        ${candidates
                          .map((player) => {
                            const captainCount = captainCountForPlayer(player.id, true);
                            const tierLabel = formatStatusLabel(currentTierStatusForPlayer(player.id));
                            return `
                              <option value="${escapeHtml(player.id)}" ${
                                Number(captainRow?.player_id) === Number(player.id) ? "selected" : ""
                              }>
                                ${escapeHtml(displayName(player))} · ${escapeHtml(tierLabel)} · ${escapeHtml(captainCount)} season
                              </option>
                            `;
                          })
                          .join("")}
                      `
                    : `<option value="">No eligible captain yet</option>`
                }
              </select>
            </div>
            ${
              captainRow
                ? `
                  <div class="compact-badges captain-badges">
                    <span class="tag-pill">${escapeHtml(formatStatusLabel(captainRow.captain_tier))}</span>
                    <span class="tag-pill">Season count ${escapeHtml(seasonCaptainCount)}</span>
                    <span class="tag-pill">${escapeHtml(formatCaptainSelectionMethod(captainRow.selection_method))}</span>
                  </div>
                `
                : ""
            }
          </div>
        `;
      }

      function captainTrackerMarkup() {
        const overview = buildCaptainOverview();
        const leaderboard = buildCaptainLeaderboardRows().slice(0, 8);
        const isFinalCaptainMatchday = activeRotationQueueMode === "final";
        const finalModeEnabled = finalCaptainOrderEnabled();

        if (!captainTrackingSupported) {
          return `
            <section class="captain-tracker-panel">
              <div class="panel-header">
                <div>
                  <h3 class="section-title">Captain tracker</h3>
                  <p class="section-copy">
                    Captains will appear here after the captain tracking SQL upgrade is applied.
                  </p>
                </div>
              </div>
            </section>
          `;
        }

        return `
          <section class="captain-tracker-panel">
            <div class="panel-header">
              <div>
                <h3 class="section-title">Captain tracker</h3>
                <p class="section-copy">
                  ${
                    isFinalCaptainMatchday && finalModeEnabled
                      ? "Final matchday auto-picks lock to 1st and 2nd place in the core group and 1st and 2nd place in the flex group, with manual overrides still available."
                      : isFinalCaptainMatchday
                        ? "Final matchday rank mode is off, so captain auto-picks fall back to the regular history-first captain rotation."
                      : "Auto-picks pull from current core and flex players, then rotate toward players with fewer prior captain nights."
                  }
                </p>
              </div>
            </div>
            <div class="captain-mode-panel ${isFinalCaptainMatchday ? "" : "is-disabled"}">
              <div class="team-captain-copy">
                <strong>Final captain order</strong>
                <p class="micro-note">
                  ${
                    isFinalCaptainMatchday
                      ? "Toggle whether the final matchday auto-picks captains from the top 2 core and top 2 flex players. Manual captain edits still stay available."
                      : "This switch only applies on the season's final matchday. It defaults to On there."
                  }
                </p>
              </div>
              <button
                class="secondary-button toggle-button ${finalModeEnabled ? "active" : ""}"
                type="button"
                data-final-captain-mode-toggle="true"
                ${isFinalCaptainMatchday ? "" : "disabled"}
              >
                ${finalModeEnabled ? "On" : "Off"}
              </button>
            </div>
            <div class="summary-grid captain-summary-grid">
              <div class="summary-card">
                <span>Captains set</span>
                <strong>${escapeHtml(overview.assignedCurrentCaptainCount)}/${escapeHtml(overview.eligibleTeamCount)}</strong>
                <span class="summary-copy">Current active teams with an eligible captain</span>
              </div>
              <div class="summary-card">
                <span>Unique captains</span>
                <strong>${escapeHtml(overview.uniqueCaptainCount)}</strong>
                <span class="summary-copy">Different players tracked this season</span>
              </div>
              <div class="summary-card">
                <span>Captain slots</span>
                <strong>${escapeHtml(overview.totalCaptainSlotsTracked)}</strong>
                <span class="summary-copy">Saved matchday-team captain rows</span>
              </div>
            </div>
            ${
              overview.ineligibleActiveTeamCount
                ? `
                  <p class="micro-note captain-tracker-note">
                    ${escapeHtml(overview.ineligibleActiveTeamCount)} active team${
                      overview.ineligibleActiveTeamCount === 1 ? "" : "s"
                    } currently only have sub players, so no captain can be assigned yet.
                  </p>
                `
                : ""
            }
            ${
              leaderboard.length
                ? `
                  <div class="table-wrap captain-tracker-table-wrap">
                    <table class="captain-tracker-table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Tier</th>
                          <th>Captain nights</th>
                          <th>Latest</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${leaderboard
                          .map(
                            (row) => `
                              <tr>
                                <td>${escapeHtml(row.name)}</td>
                                <td>${escapeHtml(formatStatusLabel(row.tierStatus || "flex"))}</td>
                                <td>${escapeHtml(row.captainCount)}</td>
                                <td>${row.lastMatchday ? `MD ${escapeHtml(row.lastMatchday)}` : "—"}</td>
                              </tr>
                            `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `
                : `<p class="micro-note captain-tracker-note">No captain rows are saved for this season yet.</p>`
            }
          </section>
        `;
      }

      function autoBalanceSummaryMarkup(summary) {
        if (!summary) {
          return "";
        }

        return `
          <div class="compact-badges team-balance-metrics">
            <span class="tag-pill">Skill spread ${escapeHtml(formatBalanceMetric(summary.skillSpread))}</span>
            <span class="tag-pill">Age spread ${escapeHtml(formatBalanceMetric(summary.ageSpread, "y"))}</span>
            <span class="tag-pill">Repeat load ${escapeHtml(
              formatBalanceMetric(summary.teammateRepeatLoad, "", 0)
            )}</span>
            <span class="tag-pill">Position mismatch ${escapeHtml(formatBalanceMetric(summary.positionMismatch))}</span>
          </div>
          ${
            summary.unassignedPlayerCount
              ? `
                <p class="micro-note">
                  ${escapeHtml(summary.unassignedPlayerCount)} IN player${
                    summary.unassignedPlayerCount === 1 ? "" : "s"
                  } still sit outside a team. These balance numbers settle once every IN player is placed.
                </p>
              `
              : ""
          }
        `;
      }

      function teamBalanceBannerMarkup(summary) {
        const attendingCount = getAttendingPlayers().length;

        return `
          <div class="team-balance-banner ${attendingCount ? "" : "is-locked"}">
            <div class="team-balance-banner-head">
              <div class="team-balance-banner-copy">
                <strong>Auto-balance the current IN pool</strong>
                <p class="micro-note">
                  ${
                    attendingCount
                      ? `${escapeHtml(attendingCount)} player${
                          attendingCount === 1 ? "" : "s"
                        } are marked IN. Run this once the matchday pool looks right, then fine-tune any cards manually.`
                      : "Mark players IN on Season squad first. Auto-balance unlocks once the matchday pool is ready."
                  }
                </p>
              </div>
              <div class="team-balance-banner-actions">
                <div class="count-badge team-balance-ready">
                  <span>IN ready</span>
                  <strong>${escapeHtml(attendingCount)}</strong>
                </div>
                <button class="primary-button" type="button" data-auto-balance-button ${
                  attendingCount ? "" : "disabled"
                }>Auto-balance teams</button>
              </div>
            </div>
            ${attendingCount ? autoBalanceSummaryMarkup(summary) : ""}
            <p class="micro-note">
              Use the team tabs to switch views. Open All teams if you want drag-and-drop across panels;
              otherwise use the team buttons inside each player card.
            </p>
          </div>
        `;
      }

      function assignmentActionsMarkup(playerId, currentTeamCode) {
        return `
          ${TEAM_CONFIG.map(
            (team) => `
              <button
                class="assign-button ${team.code} ${currentTeamCode === team.code ? "active" : ""}"
                type="button"
                data-player-id="${playerId}"
                data-team-code="${team.code}"
              >
                ${team.label.slice(0, 1)}
              </button>
            `
          ).join("")}
          <button
            class="assign-button none ${currentTeamCode === null ? "active" : ""}"
            type="button"
            data-player-id="${playerId}"
            data-team-code="none"
          >
            Pool
          </button>
        `;
      }

      function playerStatsFormMarkup(playerId, scope = "matchday") {
        const stats = getPlayerStats(playerId);
        const idPrefix = `${scope}-${playerId}`;

        return `
          <form class="stats-form" data-player-stats-form="${playerId}">
            <div class="stats-grid">
              <div class="mini-field">
                <label for="goals-${idPrefix}">Goals</label>
                <input id="goals-${idPrefix}" name="goals" type="number" min="0" value="${escapeHtml(
                  stats.goals
                )}" />
              </div>
              <div class="mini-field">
                <label for="goal-keeps-${idPrefix}">Goalkeeper points</label>
                <input id="goal-keeps-${idPrefix}" name="goal_keeps" type="number" min="0" value="${escapeHtml(
                  stats.goal_keeps
                )}" />
              </div>
            </div>
            <label class="mini-field checkbox" for="clean-sheet-${idPrefix}">
              <input id="clean-sheet-${idPrefix}" name="clean_sheet" type="checkbox" ${
                stats.clean_sheet ? "checked" : ""
              } />
              Clean sheet
            </label>
            <button class="mini-button" type="submit">Save stats</button>
          </form>
        `;
      }

      function normalizeTeamWorkspaceView(value) {
        const normalized = normalizeText(value || "").toLowerCase();

        if (normalized === "pool" || normalized === "all") {
          return normalized;
        }

        return TEAM_CONFIG.some((team) => team.code === normalized) ? normalized : "pool";
      }

      function teamWorkspaceTabsMarkup() {
        const activeView = normalizeTeamWorkspaceView(activeTeamWorkspaceView);
        const views = [
          { value: "pool", label: "Pool" },
          ...TEAM_CONFIG.map((team) => ({ value: team.code, label: team.label })),
          { value: "all", label: "All teams" },
        ];

        return `
          <div class="workspace-switcher team-workspace-switcher" role="tablist" aria-label="Team workspace">
            ${views
              .map((view) => {
                const isActive = view.value === activeView;
                return `
                  <button
                    class="workspace-btn ${isActive ? "active" : ""}"
                    type="button"
                    role="tab"
                    aria-selected="${isActive ? "true" : "false"}"
                    data-team-view-trigger="${escapeHtml(view.value)}"
                  >
                    ${escapeHtml(view.label)}
                  </button>
                `;
              })
              .join("")}
          </div>
        `;
      }

      function updateHeroStats() {
        const attending = getAttendingPlayers().length;
        const assigned = assignments.length;
        const fullTeams = TEAM_CONFIG.filter((team) => getTeamCount(team.code) === team.maxPlayers).length;
        const captainOverview = buildCaptainOverview();

        attendingCount.textContent = String(attending);
        assignedCount.textContent = String(assigned);
        fullTeamCount.textContent = String(fullTeams);
        if (captainCount) {
          captainCount.textContent = `${captainOverview.assignedCurrentCaptainCount}/${captainOverview.eligibleTeamCount}`;
        }
        attendanceBadge.textContent = String(attending);
      }

      function clearDragState() {
        draggedPlayerId = null;

        if (draggedCard) {
          draggedCard.classList.remove("dragging");
          draggedCard = null;
        }

        teamGrid
          .querySelectorAll("[data-drop-team-code].drag-target")
          .forEach((zone) => zone.classList.remove("drag-target"));
      }

      function getDropZone(target) {
        return target?.closest?.("[data-drop-team-code]") || null;
      }

      function activateDropZone(zone) {
        teamGrid.querySelectorAll("[data-drop-team-code]").forEach((panel) => {
          panel.classList.toggle("drag-target", panel === zone);
        });
      }

      function getMatch(roundNumber, matchOrder) {
        return matches.find(
          (match) => match.round_number === roundNumber && match.match_order === matchOrder
        );
      }

      function parseMatchOutcome(match) {
        if (!match || match.home_score === null || match.home_score === undefined || match.away_score === null || match.away_score === undefined) {
          return { complete: false };
        }

        if (match.home_score > match.away_score) {
          return {
            complete: true,
            draw: false,
            winner: match.home_team_code,
            loser: match.away_team_code,
          };
        }

        if (match.away_score > match.home_score) {
          return {
            complete: true,
            draw: false,
            winner: match.away_team_code,
            loser: match.home_team_code,
          };
        }

        return {
          complete: true,
          draw: true,
          teams: [match.home_team_code, match.away_team_code],
        };
      }

      async function ensureDefaultMatches() {
        const existingKeys = new Set(matches.map((match) => `${match.round_number}-${match.match_order}`));
        const missingRows = ROUND_ONE_DEFAULTS.filter(
          (row) => !existingKeys.has(`${row.round_number}-${row.match_order}`)
        ).map((row) => ({
          matchday_id: matchday.id,
          ...row,
        }));

        if (!missingRows.length) {
          return;
        }

        const { error } = await supabaseClient
          .from("matchday_matches")
          .insert(missingRows);

        if (error) {
          throw error;
        }
      }

      function roundTwoPairingsMatch(expectedRows) {
        const existingOne = getMatch(2, 1);
        const existingTwo = getMatch(2, 2);

        return (
          existingOne &&
          existingTwo &&
          existingOne.home_team_code === expectedRows[0].home_team_code &&
          existingOne.away_team_code === expectedRows[0].away_team_code &&
          existingTwo.home_team_code === expectedRows[1].home_team_code &&
          existingTwo.away_team_code === expectedRows[1].away_team_code
        );
      }

      async function saveRoundTwoPairings(rows) {
        const upsertRows = rows.map((row) => ({
          matchday_id: matchday.id,
          round_number: row.round_number,
          match_order: row.match_order,
          home_team_code: row.home_team_code,
          away_team_code: row.away_team_code,
          home_score: null,
          away_score: null,
        }));

        const { error } = await supabaseClient
          .from("matchday_matches")
          .upsert(upsertRows, { onConflict: "matchday_id,round_number,match_order" });

        if (error) {
          throw error;
        }
      }

      async function resetRoundTwoPairings() {
        const rows = [
          {
            matchday_id: matchday.id,
            round_number: 2,
            match_order: 1,
            home_team_code: null,
            away_team_code: null,
            home_score: null,
            away_score: null,
          },
          {
            matchday_id: matchday.id,
            round_number: 2,
            match_order: 2,
            home_team_code: null,
            away_team_code: null,
            home_score: null,
            away_score: null,
          },
        ];

        const { error } = await supabaseClient
          .from("matchday_matches")
          .upsert(rows, { onConflict: "matchday_id,round_number,match_order" });

        if (error) {
          throw error;
        }
      }

      function getRoundTwoState() {
        const firstMatch = getMatch(1, 1);
        const secondMatch = getMatch(1, 2);
        const firstOutcome = parseMatchOutcome(firstMatch);
        const secondOutcome = parseMatchOutcome(secondMatch);

        if (!firstOutcome.complete || !secondOutcome.complete) {
          return { mode: "pending_round_one" };
        }

        if (!firstOutcome.draw && !secondOutcome.draw) {
          return {
            mode: "auto",
            rows: [
              {
                round_number: 2,
                match_order: 1,
                home_team_code: firstOutcome.winner,
                away_team_code: secondOutcome.winner,
              },
              {
                round_number: 2,
                match_order: 2,
                home_team_code: firstOutcome.loser,
                away_team_code: secondOutcome.loser,
              },
            ],
          };
        }

        if (!firstOutcome.draw && secondOutcome.draw) {
          return {
            mode: "winner_choice",
            chooser: firstOutcome.winner,
            fallback: firstOutcome.loser,
            options: secondOutcome.teams,
            sourceMatch: 2,
          };
        }

        if (firstOutcome.draw && !secondOutcome.draw) {
          return {
            mode: "winner_choice",
            chooser: secondOutcome.winner,
            fallback: secondOutcome.loser,
            options: firstOutcome.teams,
            sourceMatch: 1,
          };
        }

        return {
          mode: "coin_flip",
          firstPair: firstOutcome.teams,
          secondPair: secondOutcome.teams,
        };
      }

      async function maybeAutoResolveRoundTwo() {
        const state = getRoundTwoState();

        if (state.mode !== "auto" || roundTwoPairingsMatch(state.rows)) {
          return;
        }

        await saveRoundTwoPairings(state.rows);
      }

      async function loadMatchdayEngine(options = {}) {
        try {
          if (!Number.isInteger(matchdayId) || matchdayId <= 0) {
            await loadMatchdayLauncher();
            return;
          }

          setStatus("Loading Match Centre...");
          captainTrackingSupported = true;
          teamDisplaySupported = true;
          seasonRosterMetadataSupported = true;

          let { data: matchdayRow, error: matchdayError } = await supabaseClient
            .from("matchdays")
            .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points, final_captain_order_enabled")
            .eq("id", matchdayId)
            .single();

          if (matchdayError && hasMissingFinalCaptainModeColumn(matchdayError)) {
            ({ data: matchdayRow, error: matchdayError } = await supabaseClient
              .from("matchdays")
              .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
              .eq("id", matchdayId)
              .single());

            if (!matchdayError && matchdayRow) {
              matchdayRow = {
                ...matchdayRow,
                final_captain_order_enabled: true,
              };
            }
          }

          if (matchdayError) {
            throw matchdayError;
          }

          matchday = {
            ...matchdayRow,
            final_captain_order_enabled: matchdayRow?.final_captain_order_enabled !== false,
          };
          void syncMatchdayWeather(matchday);

          let { data: seasonRow, error: seasonError } = await supabaseClient
            .from("seasons")
            .select("id, name, total_matchdays, core_spots, rotation_spots, attendance_points, win_points, draw_points, loss_points, goal_keep_points, team_goal_points, team_display_config")
            .eq("id", matchday.season_id)
            .single();

          if (seasonError && hasMissingTeamDisplayColumn(seasonError)) {
            teamDisplaySupported = false;
            ({ data: seasonRow, error: seasonError } = await supabaseClient
              .from("seasons")
              .select("id, name, total_matchdays, core_spots, rotation_spots, attendance_points, win_points, draw_points, loss_points, goal_keep_points, team_goal_points")
              .eq("id", matchday.season_id)
              .single());
          }

          if (seasonError) {
            throw seasonError;
          }

          season = {
            ...seasonRow,
            team_display_config: normalizeTeamDisplayConfig(seasonRow?.team_display_config),
          };
          applySeasonTeamDisplay(season.team_display_config);

          const buildSeasonPlayerSelect = (includeMetadata, includeDesiredTier) =>
            [
              "id",
              "player_id",
              "tier_status",
              "is_eligible",
              ...(includeMetadata ? ["registration_tier", "payment_status"] : []),
              `player:players(id, first_name, last_name, nickname, nationality, birth_date, positions, skill_rating${
                includeDesiredTier ? ", desired_tier" : ""
              }, status)`,
            ].join(", ");

          const buildDirectoryPlayerSelect = (includeDesiredTier) =>
            `id, first_name, last_name, nickname, nationality, birth_date, positions, skill_rating${
              includeDesiredTier ? ", desired_tier" : ""
            }, status`;

          let includeSeasonRosterMetadata = true;
          let includeDesiredTier = true;
          let seasonPlayerRows = null;
          let seasonPlayerError = null;

          ({ data: seasonPlayerRows, error: seasonPlayerError } = await supabaseClient
            .from("season_players")
            .select(buildSeasonPlayerSelect(includeSeasonRosterMetadata, includeDesiredTier))
            .eq("season_id", season.id));

          if (
            seasonPlayerError &&
            (hasMissingSeasonRosterMetadataColumns(seasonPlayerError) || hasMissingDesiredTierColumn(seasonPlayerError))
          ) {
            includeSeasonRosterMetadata = !hasMissingSeasonRosterMetadataColumns(seasonPlayerError);
            includeDesiredTier = !hasMissingDesiredTierColumn(seasonPlayerError);
            seasonRosterMetadataSupported = includeSeasonRosterMetadata;

            ({ data: seasonPlayerRows, error: seasonPlayerError } = await supabaseClient
              .from("season_players")
              .select(buildSeasonPlayerSelect(includeSeasonRosterMetadata, includeDesiredTier))
              .eq("season_id", season.id));
          }

          if (seasonPlayerError) {
            throw seasonPlayerError;
          }

          let { data: directoryRows, error: directoryError } = await supabaseClient
            .from("players")
            .select(buildDirectoryPlayerSelect(includeDesiredTier))
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true });

          if (directoryError && hasMissingDesiredTierColumn(directoryError)) {
            includeDesiredTier = false;
            ({ data: directoryRows, error: directoryError } = await supabaseClient
              .from("players")
              .select(buildDirectoryPlayerSelect(includeDesiredTier))
              .order("last_name", { ascending: true })
              .order("first_name", { ascending: true }));
          }

          if (directoryError) {
            throw directoryError;
          }

          clubPlayers = (directoryRows || [])
            .map((row) => normalizePlayerDesiredTier(row, "flex"))
            .sort((left, right) => compareNames(left, right));
          seasonRosterRows = (seasonPlayerRows || [])
            .map((row) => {
              const registryPlayer = normalizePlayerDesiredTier(row.player, "flex");
              const tierStatus = normalizeTierValue(
                row.tier_status || registryPlayer.desired_tier,
                registryPlayer.desired_tier
              );
              return {
                ...row,
                player: registryPlayer,
                tier_status: tierStatus,
                registration_tier: normalizeTierValue(
                  row.registration_tier || tierStatus,
                  tierStatus
                ),
                payment_status: normalizeText(row.payment_status || "unknown").toLowerCase(),
                is_eligible: row.is_eligible !== false,
              };
            })
            .filter((row) => row.player)
            .sort((left, right) => compareNames(left.player, right.player));
          seasonRosterPlayerIds = new Set(seasonRosterRows.map((row) => row.player_id));
          players = seasonRosterRows
            .filter((row) => row.is_eligible)
            .map((row) => ({
              ...row.player,
              season_player_id: row.id,
              status: row.tier_status,
              base_status: row.player.desired_tier,
              is_eligible: row.is_eligible,
            }))
            .sort((left, right) => compareNames(left, right));

          const { data: tierRows, error: tierError } = await supabaseClient
            .from("v_season_tier_transparency")
            .select("player_id, games_attended, attendance_score, no_shows, recent_games_attended, is_eligible")
            .eq("season_id", season.id);

          if (tierError) {
            throw tierError;
          }

          tierMetricsByPlayerId = new Map((tierRows || []).map((row) => [row.player_id, row]));

          const { data: statRows, error: statError } = await supabaseClient
            .from("matchday_player_stats")
            .select("id, player_id, attended, attendance_status, goals, goal_keeps, clean_sheet")
            .eq("matchday_id", matchday.id);

          if (statError) {
            throw statError;
          }

          statsByPlayerId = new Map(
            (statRows || []).map((row) => [
              row.player_id,
              {
                id: row.id,
                attended: row.attended,
                attendance_status: row.attendance_status === "attended"
                  ? "in"
                  : (row.attendance_status || (row.attended ? "in" : "out")),
                goals: row.goals,
                goal_keeps: row.goal_keeps,
                clean_sheet: row.clean_sheet,
              },
            ])
          );

          const { data: assignmentRows, error: assignmentError } = await supabaseClient
            .from("matchday_assignments")
            .select("id, player_id, team_code")
            .eq("matchday_id", matchday.id);

          if (assignmentError) {
            throw assignmentError;
          }

          assignments = assignmentRows || [];

          let currentCaptainRows = [];

          if (captainTrackingSupported) {
            const { data: captainData, error: captainError } = await supabaseClient
              .from("matchday_team_captains")
              .select("id, matchday_id, team_code, player_id, captain_tier, selection_method, created_at, updated_at")
              .eq("matchday_id", matchday.id);

            if (captainError && hasMissingCaptainTable(captainError)) {
              captainTrackingSupported = false;
            } else if (captainError) {
              throw captainError;
            } else {
              currentCaptainRows = captainData || [];
            }
          }

          captainRows = currentCaptainRows;

          const { data: priorMatchdayRows, error: priorMatchdayError } = await supabaseClient
            .from("matchdays")
            .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
            .eq("season_id", season.id)
            .lt("matchday_number", matchday.matchday_number);

          if (priorMatchdayError) {
            throw priorMatchdayError;
          }

          const priorMatchdayIds = (priorMatchdayRows || []).map((row) => row.id);
          seasonMatchdayNumberById = new Map(
            [...(priorMatchdayRows || []), matchday].map((row) => [row.id, row.matchday_number])
          );

          if (priorMatchdayIds.length) {
            const historyQueries = [
              supabaseClient
                .from("matchday_assignments")
                .select("matchday_id, player_id, team_code")
                .in("matchday_id", priorMatchdayIds),
              supabaseClient
                .from("matchday_matches")
                .select("*")
                .in("matchday_id", priorMatchdayIds)
                .order("matchday_id", { ascending: true })
                .order("round_number", { ascending: true })
                .order("match_order", { ascending: true })
                .limit(5000),
              supabaseClient
                .from("matchday_player_stats")
                .select("*")
                .in("matchday_id", priorMatchdayIds)
                .limit(10000),
            ];

            if (captainTrackingSupported) {
              historyQueries.push(
                supabaseClient
                  .from("matchday_team_captains")
                  .select("id, matchday_id, team_code, player_id, captain_tier, selection_method, created_at, updated_at")
                  .in("matchday_id", priorMatchdayIds)
              );
            }

            const [
              { data: historicalAssignmentRows, error: historicalAssignmentsError },
              { data: historicalMatchRows, error: historicalMatchesError },
              { data: historicalPlayerStatRows, error: historicalPlayerStatsError },
              historicalCaptainQuery,
            ] =
              await Promise.all([
                ...historyQueries,
              ]);

            if (historicalAssignmentsError) {
              throw historicalAssignmentsError;
            }

            if (historicalMatchesError) {
              throw historicalMatchesError;
            }

            if (historicalPlayerStatsError) {
              throw historicalPlayerStatsError;
            }

            if (captainTrackingSupported) {
              if (historicalCaptainQuery?.error && hasMissingCaptainTable(historicalCaptainQuery.error)) {
                captainTrackingSupported = false;
                currentCaptainRows = [];
                captainRows = [];
                historicalCaptainRows = [];
              } else if (historicalCaptainQuery?.error) {
                throw historicalCaptainQuery.error;
              } else {
                historicalCaptainRows = historicalCaptainQuery?.data || [];
              }
            } else {
              historicalCaptainRows = [];
            }

            historicalAssignments = historicalAssignmentRows || [];
            rotationStandingsByPlayerId = buildStandingsByPlayerId(
              players,
              historicalAssignments,
              historicalPlayerStatRows || [],
              priorMatchdayRows || [],
              historicalMatchRows || [],
              season
            );
          } else {
            historicalAssignments = [];
            historicalCaptainRows = [];
            rotationStandingsByPlayerId = new Map();
          }

          activeRotationQueueMode = isFinalMatchday(matchday, season, [...(priorMatchdayRows || []), matchday])
            ? "final"
            : "regular";

          const { data: matchRows, error: matchError } = await supabaseClient
            .from("matchday_matches")
            .select("id, round_number, match_order, home_team_code, away_team_code, home_score, away_score")
            .eq("matchday_id", matchday.id)
            .order("round_number", { ascending: true })
            .order("match_order", { ascending: true });

          if (matchError) {
            throw matchError;
          }

          matches = matchRows || [];
          await ensureDefaultMatches();

          const { data: refreshedMatchRows, error: refreshedMatchError } = await supabaseClient
            .from("matchday_matches")
            .select("id, round_number, match_order, home_team_code, away_team_code, home_score, away_score")
            .eq("matchday_id", matchday.id)
            .order("round_number", { ascending: true })
            .order("match_order", { ascending: true });

          if (refreshedMatchError) {
            throw refreshedMatchError;
          }

          matches = refreshedMatchRows || [];
          await maybeAutoResolveRoundTwo();

          const { data: finalMatchRows, error: finalMatchError } = await supabaseClient
            .from("matchday_matches")
            .select("id, round_number, match_order, home_team_code, away_team_code, home_score, away_score")
            .eq("matchday_id", matchday.id)
            .order("round_number", { ascending: true })
            .order("match_order", { ascending: true });

          if (finalMatchError) {
            throw finalMatchError;
          }

          matches = finalMatchRows || [];
          matchdayLauncherBlock.hidden = true;
          setMatchdayUiLocked(false);

          heroCopy.textContent = `${season.name} - Matchday ${matchday.matchday_number}${
            matchday.kickoff_at ? ` - Kickoff ${formatDateTime(matchday.kickoff_at)}` : ""
          } - ${players.length} active players loaded - ${
            matchday.goals_count_as_points ? "Team goals count toward points" : "Team goals are tie-break only"
          }`;
          if (openPlayerStatsLink) {
            openPlayerStatsLink.href = `./submissions.html?season_id=${season.id}&matchday_id=${matchday.id}&preview=1`;
          }
          matchdayInfoCopy.textContent = players.length
            ? `${season.name} is using ${players.length} active season-squad players. Set attendance, assign IN players to teams, and enter stats for matchday ${matchday.matchday_number}.`
            : `No active season squad exists yet for ${season.name}. Add players from Season Centre before running this matchday.`;
          syncScoringSettingsFields();
          syncGoalsPointsToggle();
          priorityFillButton.disabled = false;

          renderReplacementTools();
          renderRosterPriority();
          renderAttendance();
          renderTeams();
          renderMatches();
          updateHeroStats();
          if (captainTrackingSupported && !options.skipCaptainSync) {
            const captainSync = await syncCaptainsForCurrentTeams({
              resetAll: options.resetCaptains === true,
              forceAutoRepick: options.forceAutoCaptainRepick === true,
            });

            if (captainSync.changed) {
              await loadMatchdayEngine({ skipCaptainSync: true });
              return;
            }
          }
          setStatus(
            teamDisplaySupported
              ? captainTrackingSupported
                ? "Match Centre loaded."
                : "Match Centre loaded. Captain tracking will appear after the latest SQL update."
              : "Match Centre loaded. Team label saving is still limited on this club build.",
            teamDisplaySupported && captainTrackingSupported ? "success" : "warning"
          );
        } catch (error) {
          seasonRosterRows = [];
          seasonRosterPlayerIds = new Set();
          clubPlayers = [];
          historicalAssignments = [];
          historicalCaptainRows = [];
          captainRows = [];
          seasonMatchdayNumberById = new Map();
          rotationStandingsByPlayerId = new Map();
          activeRotationQueueMode = "regular";
          priorityFillButton.disabled = true;
          renderReplacementTools();
          setMatchdayUiLocked(true);
          setStatus(readableError(error), "error");
        }
      }

      async function savePlayerStats(playerId, updates) {
        const current = getPlayerStats(playerId);
        const payload = {
          matchday_id: matchday.id,
          player_id: playerId,
          attended: current.attended,
          attendance_status: current.attendance_status || (current.attended ? "in" : "out"),
          goals: current.goals,
          goal_keeps: current.goal_keeps,
          clean_sheet: current.clean_sheet,
          ...updates,
        };

        const { error } = await supabaseClient
          .from("matchday_player_stats")
          .upsert(payload, { onConflict: "matchday_id,player_id" });

        if (error) {
          throw error;
        }
      }

      async function setAttendanceStatus(playerId, nextStatus) {
        const current = getPlayerStats(playerId);
        const normalizedStatus = nextStatus === "attended"
          ? "in"
          : (ATTENDANCE_STATUS_LABELS[nextStatus] ? nextStatus : "out");
        const nextAttended = normalizedStatus === "in";
        const currentAssignment = getAssignment(playerId);
        const player = players.find((entry) => entry.id === playerId);
        const playerLabel = player ? displayName(player) : "Player";

        try {
          await savePlayerStats(playerId, {
            attended: nextAttended,
            attendance_status: normalizedStatus,
            goals: nextAttended ? current.goals : 0,
            goal_keeps: nextAttended ? current.goal_keeps : 0,
            clean_sheet: nextAttended ? current.clean_sheet : false,
          });

          if (!nextAttended) {
            if (currentAssignment) {
              const { error } = await supabaseClient
                .from("matchday_assignments")
                .delete()
                .eq("id", currentAssignment.id);

              if (error) {
                throw error;
              }
            }
          }

          await loadMatchdayEngine();
          if (normalizedStatus === "in") {
            setStatus(`${playerLabel} moved into tonight's pool.`, "success");
          } else if (normalizedStatus === "available") {
            setStatus(`${playerLabel} is available but not selected in tonight's pool.`, "success");
          } else {
            const clearedTeamCopy = currentAssignment
              ? ` ${teamLabel(currentAssignment.team_code)} was cleared at the same time.`
              : "";
            const statusCopy =
              normalizedStatus === "late_cancel"
                ? `${playerLabel} was marked late cancel and removed from tonight's pool.`
                : normalizedStatus === "no_show"
                  ? `${playerLabel} was marked no-show and removed from tonight's pool.`
                  : `${playerLabel} was marked OUT and removed from tonight's pool.`;
            setStatus(`${statusCopy}${clearedTeamCopy}`, "warning");
          }
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      async function saveScoringSettings() {
        if (!season) {
          return;
        }

        const nextSettings = scoringSettingsFromInputs();
        const values = Object.values(nextSettings);

        if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 20)) {
          setStatus("Scoring rules must be whole numbers between 0 and 20.", "error");
          return;
        }

        try {
          saveScoringButton.disabled = true;
          saveScoringButton.textContent = "Saving...";

          const { error } = await supabaseClient
            .from("seasons")
            .update(nextSettings)
            .eq("id", season.id);

          if (error) {
            throw error;
          }

          season = { ...season, ...nextSettings };
          syncScoringSettingsFields();
          syncGoalsPointsToggle();
          setStatus("Season scoring rules updated.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          saveScoringButton.disabled = false;
          saveScoringButton.textContent = "Save scoring rules";
        }
      }

      async function saveTeamDisplaySettings() {
        if (!season) {
          return;
        }

        const nextConfig = readTeamDisplayInputs();

        try {
          saveTeamDisplayButton.disabled = true;
          saveTeamDisplayButton.textContent = "Saving...";

          const { error } = await supabaseClient
            .from("seasons")
            .update({ team_display_config: nextConfig })
            .eq("id", season.id);

          if (error) {
            throw error;
          }

          season = { ...season, team_display_config: nextConfig };
          applySeasonTeamDisplay(nextConfig);
          renderTeams();
          renderMatches();
          setStatus("Season team labels updated.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          saveTeamDisplayButton.disabled = false;
          saveTeamDisplayButton.textContent = "Save team labels";
        }
      }

      async function toggleGoalsCountAsPoints() {
        if (!matchday) {
          return;
        }

        const nextValue = !matchday.goals_count_as_points;

        try {
          goalsPointsToggle.disabled = true;

          const { error } = await supabaseClient
            .from("matchdays")
            .update({ goals_count_as_points: nextValue })
            .eq("id", matchday.id);

          if (error) {
            throw error;
          }

          matchday = { ...matchday, goals_count_as_points: nextValue };
          syncGoalsPointsToggle();
          heroCopy.textContent = `${season.name} - Matchday ${matchday.matchday_number}${
            matchday.kickoff_at ? ` - Kickoff ${formatDateTime(matchday.kickoff_at)}` : ""
          } - ${matchday.goals_count_as_points ? "Team goals count toward points" : "Team goals are tie-break only"}`;
          setStatus(
            nextValue
              ? "Team goals now add directly to total points for this matchday."
              : "Team goals now stay as tie-breakers only for this matchday.",
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          goalsPointsToggle.disabled = false;
        }
      }

      async function assignPlayer(playerId, nextTeamCode) {
        if (!isAttending(playerId)) {
          setStatus("Only players marked as IN can be placed on a team.", "warning");
          return;
        }

        const currentAssignment = getAssignment(playerId);
        const currentTeamCode = currentAssignment?.team_code || null;

        if (nextTeamCode === currentTeamCode || (nextTeamCode === "none" && currentTeamCode === null)) {
          return;
        }

        if (nextTeamCode !== "none") {
          const targetTeam = TEAM_CONFIG.find((team) => team.code === nextTeamCode);
          const targetCount = getTeamCount(nextTeamCode);

          if (targetTeam && currentTeamCode !== nextTeamCode && targetCount >= targetTeam.maxPlayers) {
            setStatus(`${targetTeam.label} is already full at ${targetTeam.maxPlayers} players.`, "warning");
            return;
          }
        }

        try {
          if (nextTeamCode === "none") {
            if (!currentAssignment) {
              return;
            }

            const { error } = await supabaseClient
              .from("matchday_assignments")
              .delete()
              .eq("id", currentAssignment.id);

            if (error) {
              throw error;
            }
          } else if (currentAssignment) {
            const { error } = await supabaseClient
              .from("matchday_assignments")
              .update({ team_code: nextTeamCode })
              .eq("id", currentAssignment.id);

            if (error) {
              throw error;
            }
          } else {
            const { error } = await supabaseClient
              .from("matchday_assignments")
              .insert({
                matchday_id: matchday.id,
                player_id: playerId,
                team_code: nextTeamCode,
              });

            if (error) {
              throw error;
            }
          }

          await loadMatchdayEngine();
          setStatus(
            nextTeamCode === "none"
              ? "Player moved back to the unassigned pool."
              : `Player assigned to ${teamLabel(nextTeamCode)}.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      async function saveTeamCaptain(teamCode, rawPlayerId) {
        if (!captainTrackingSupported || !matchday) {
          setStatus("Captain tracking is not available until the latest SQL upgrade is applied.", "warning");
          return;
        }

        const playerId = Number(rawPlayerId);
        const player = findKnownPlayerById(playerId);
        const assignment = getAssignment(playerId);

        if (!Number.isInteger(playerId) || playerId <= 0 || !player || assignment?.team_code !== teamCode) {
          setStatus("Choose a player who is currently assigned to that team.", "warning");
          return;
        }

        if (!isAttending(playerId)) {
          setStatus("Only players marked IN can be saved as captains.", "warning");
          return;
        }

        if (!isCaptainEligiblePlayer(player)) {
          setStatus("Captains must come from the current core or flex pool.", "warning");
          return;
        }

        try {
          const { error } = await supabaseClient
            .from("matchday_team_captains")
            .upsert({
              matchday_id: matchday.id,
              team_code: teamCode,
              player_id: playerId,
              captain_tier: currentTierStatusForPlayer(playerId) || "flex",
              selection_method: "manual",
            }, { onConflict: "matchday_id,team_code" });

          if (error) {
            throw error;
          }

          await loadMatchdayEngine();
          setStatus(`${teamLabel(teamCode)} captain updated.`, "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      async function toggleFinalCaptainMode(button = null) {
        if (!matchday || activeRotationQueueMode !== "final") {
          return;
        }

        const nextValue = !finalCaptainOrderEnabled();

        try {
          if (button) {
            button.disabled = true;
          }

          const { error } = await supabaseClient
            .from("matchdays")
            .update({ final_captain_order_enabled: nextValue })
            .eq("id", matchday.id);

          if (error) {
            throw error;
          }

          await loadMatchdayEngine({ forceAutoCaptainRepick: true });
          setStatus(
            nextValue
              ? "Final-matchday captain order is on. Auto-captains now follow the top 2 core and top 2 flex ranks."
              : "Final-matchday captain order is off. Auto-captains now fall back to the regular history-first captain rotation.",
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          if (button) {
            button.disabled = false;
          }
        }
      }

      async function autoBalanceTeams(button = null) {
        if (!matchday) {
          return;
        }

        const attendingPlayers = getAttendingPlayers();

        if (!attendingPlayers.length) {
          setStatus("No one is marked as IN yet. Build the availability pool first.", "warning");
          return;
        }

        if (attendingPlayers.length > ROSTER_CAP) {
          setStatus(`The current IN pool is above the ${ROSTER_CAP}-player team cap. Use the queue tools first.`, "warning");
          return;
        }

        try {
          if (button) {
            button.disabled = true;
            button.textContent = "Balancing...";
          }

          const result = buildBalancedTeams(attendingPlayers, buildTeamBalanceOptions());

          if (!result?.ok) {
            setStatus(result?.reason || "Auto-balance could not build teams from the current IN pool.", "error");
            return;
          }

          const payload = result.assignments.map((assignment) => ({
            matchday_id: matchday.id,
            player_id: assignment.player_id,
            team_code: assignment.team_code,
          }));

          const { error: upsertError } = await supabaseClient
            .from("matchday_assignments")
            .upsert(payload, { onConflict: "matchday_id,player_id" });

          if (upsertError) {
            throw upsertError;
          }

          const attendingIds = new Set(attendingPlayers.map((player) => player.id));
          const staleAssignmentIds = assignments
            .filter((assignment) => !attendingIds.has(assignment.player_id))
            .map((assignment) => assignment.id);

          if (staleAssignmentIds.length) {
            const { error: deleteError } = await supabaseClient
              .from("matchday_assignments")
              .delete()
              .in("id", staleAssignmentIds);

            if (deleteError) {
              throw deleteError;
            }
          }

          await loadMatchdayEngine({ resetCaptains: true });
          const captainOverview = buildCaptainOverview();
          setStatus(
            `Auto-balance saved. Skill spread ${formatBalanceMetric(result.summary.skillSpread)} · age spread ${formatBalanceMetric(
              result.summary.ageSpread,
              "y"
            )} · repeat load ${formatBalanceMetric(result.summary.teammateRepeatLoad, "", 0)} · captains ${captainOverview.assignedCurrentCaptainCount}/${captainOverview.eligibleTeamCount}.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent = "Auto-balance teams";
          }
        }
      }

      async function saveStatForm(playerId, form) {
        const goals = Number(form.querySelector("[name='goals']").value || "0");
        const goalKeeps = Number(form.querySelector("[name='goal_keeps']").value || "0");
        const cleanSheet = form.querySelector("[name='clean_sheet']").checked;

        if (!Number.isInteger(goals) || goals < 0 || !Number.isInteger(goalKeeps) || goalKeeps < 0) {
          setStatus("Goals and goalkeeper stats must be whole numbers of 0 or greater.", "error");
          return;
        }

        try {
          await savePlayerStats(playerId, {
            attended: true,
            attendance_status: "in",
            goals,
            goal_keeps: goalKeeps,
            clean_sheet: cleanSheet,
          });

          await loadMatchdayEngine();
          setStatus("Player stats saved.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      function renderRosterPriority() {
        rosterPlan = buildRosterPlan();
        priorityFillButton.disabled = !rosterPlan.planRows.length;
        priorityBoardWrap.hidden = false;

        if (!players.length) {
          prioritySummaryGrid.innerHTML = `
            <div class="summary-card">
              <span>Season squad</span>
              <strong>0</strong>
            </div>
          `;
          priorityBoardWrap.innerHTML = `
            <div class="table-empty">
              No active season squad yet. Add players to this season from Season Centre first.
            </div>
          `;
          return;
        }

        prioritySummaryGrid.innerHTML = `
          <div class="summary-card">
            <span>Core in</span>
            <strong>${escapeHtml(rosterPlan.selectedCoreCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Flex in</span>
            <strong>${escapeHtml(rosterPlan.selectedRotationCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Flex fill</span>
            <strong>${escapeHtml(rosterPlan.selectedDepthCount)}</strong>
          </div>
          <div class="summary-card">
            <span>Waiting</span>
            <strong>${escapeHtml(rosterPlan.waitingCount)}</strong>
          </div>
        `;

        if (!rosterPlan.planRows.length) {
          priorityBoardWrap.innerHTML = `
            <div class="table-empty">
              The season squad is empty or every player is marked out of the pool right now.
            </div>
          `;
          return;
        }

        priorityBoardWrap.innerHTML = "";
        priorityBoardWrap.hidden = true;
      }

      async function applyPriorityRoster() {
        if (!matchday) {
          return;
        }

        const plan = buildRosterPlan();
        const candidatePlayers = plan.availablePlayers;

        if (!candidatePlayers.length) {
          setStatus("No open roster pool is available right now. Clear any out, late-cancel, or no-show statuses first.", "warning");
          return;
        }

        const payload = candidatePlayers.map((player) => {
          const current = getPlayerStats(player.id);
          const selected = plan.selectedIds.has(player.id);

          return {
            matchday_id: matchday.id,
            player_id: player.id,
            attended: selected,
            attendance_status: selected ? "in" : "available",
            goals: selected ? current.goals : 0,
            goal_keeps: selected ? current.goal_keeps : 0,
            clean_sheet: selected ? current.clean_sheet : false,
          };
        });

        const unselectedIds = candidatePlayers
          .filter((player) => !plan.selectedIds.has(player.id))
          .map((player) => player.id);

        try {
          priorityFillButton.disabled = true;

          const { error: statsError } = await supabaseClient
            .from("matchday_player_stats")
            .upsert(payload, { onConflict: "matchday_id,player_id" });

          if (statsError) {
            throw statsError;
          }

          if (unselectedIds.length) {
            const assignmentIdsToDelete = assignments
              .filter((assignment) => unselectedIds.includes(assignment.player_id))
              .map((assignment) => assignment.id);

            if (assignmentIdsToDelete.length) {
              const { error: deleteError } = await supabaseClient
                .from("matchday_assignments")
                .delete()
                .in("id", assignmentIdsToDelete);

              if (deleteError) {
                throw deleteError;
              }
            }
          }

          await loadMatchdayEngine();
          setStatus(
            `Priority roster applied. ${plan.selectedIds.size} player${plan.selectedIds.size === 1 ? "" : "s"} moved into the IN pool.`,
            "success"
          );
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          priorityFillButton.disabled = false;
        }
      }

      function renderAttendance() {
        if (!players.length) {
          attendanceGrid.innerHTML = `
            <div class="empty-state">
              No active season squad yet. Add players to this season in Season Centre before running availability.
            </div>
          `;
          return;
        }

        rosterDisplayPlan = buildRosterDisplayPlan();

        const filtered = [...players]
          .filter((player) => playerMatchesFilters(player))
          .sort(compareByRosterDisplay);

        if (!filtered.length) {
          attendanceGrid.innerHTML = `
            ${teamBalanceBannerMarkup(currentTeamBalanceSummary())}
            <div class="empty-state">
              No players match the current search.
            </div>
          `;
          return;
        }

        const cardsMarkup = filtered
          .map((player) => {
            const attendanceStatus = getAttendanceStatus(player.id);
            const row = rosterPlanRow(player.id) || rosterDisplayRow(player.id);
            const prioritySummary = priorityStatSummary(player, row);
            const subtitleParts = [playerOriginLabel(player)];
            const queueState =
              attendanceStatus === "in" || attendanceStatus === "available"
                ? formatPlanQueueState(row)
                : "";
            const assignment = attendanceStatus === "in" ? getAssignment(player.id) : null;
            const currentTeamCode = assignment?.team_code || null;

            if (queueState) {
              subtitleParts.push(queueState);
            }
            subtitleParts.push(formatAttendanceStatusLabel(attendanceStatus));

            return `
              <article class="player-card team-player-card season-roster-card" data-player-card="${player.id}">
                <div class="player-card-header">
                  <div class="player-meta">
                    <h3 class="player-name">${escapeHtml(displayName(player))}</h3>
                    <p class="compact-row-copy">${escapeHtml(subtitleParts.join(" · "))}</p>
                    <div class="player-tags">
                      ${captainBadgeMarkup(player.id)}
                      ${planBadgeMarkup(player.id) || `<span class="tag-pill">${escapeHtml(formatStatusLabel(player.status))}</span>`}
                      <span class="tag-pill">${escapeHtml(prioritySummary.label)} ${escapeHtml(prioritySummary.value)}</span>
                      <span class="tag-pill">Games ${escapeHtml(prioritySummary.metrics.games_attended)}</span>
                      <span class="tag-pill">No-shows ${escapeHtml(prioritySummary.metrics.no_shows)}</span>
                      ${(player.positions || [])
                        .map((position) => `<span class="tag-pill">${escapeHtml(position)}</span>`)
                        .join("")}
                    </div>
                  </div>

                  <div class="field inline-select-field">
                    <label for="attendance-status-${player.id}">Attendance</label>
                    <select id="attendance-status-${player.id}" data-attendance-player-id="${player.id}">
                      ${Object.entries(ATTENDANCE_STATUS_LABELS)
                        .map(
                          ([value, label]) => `
                            <option value="${escapeHtml(value)}" ${attendanceStatus === value ? "selected" : ""}>
                              ${escapeHtml(label)}
                            </option>
                          `
                        )
                        .join("")}
                    </select>
                  </div>
                </div>

                ${
                  attendanceStatus === "in"
                    ? `
                      <div class="roster-inline-detail">
                        <div class="field">
                          <label>Team</label>
                          <div class="assignment-actions">
                            ${assignmentActionsMarkup(player.id, currentTeamCode)}
                          </div>
                        </div>
                        ${
                          currentTeamCode
                            ? `
                                ${captainBadgeMarkup(player.id) ? '<p class="micro-note captain-note">Current team captain.</p>' : ""}
                                ${playerStatsFormMarkup(player.id, "season")}
                              `
                            : `<p class="micro-note">Choose a team on this card, or run auto-balance above the roster.</p>`
                        }
                      </div>
                    `
                    : ""
                }
                ${
                  attendanceStatus === "out"
                    ? `<p class="micro-note roster-state-note is-warning">Out of tonight's pool.</p>`
                    : attendanceStatus === "late_cancel"
                      ? `<p class="micro-note roster-state-note is-warning">Late cancel. Removed from tonight's pool.</p>`
                      : attendanceStatus === "no_show"
                        ? `<p class="micro-note roster-state-note is-warning">No-show. Removed from tonight's pool.</p>`
                        : ""
                }
              </article>
            `;
          })
          .join("");

        attendanceGrid.innerHTML = `
          ${teamBalanceBannerMarkup(currentTeamBalanceSummary())}
          ${cardsMarkup}
        `;
      }

      function playerCardMarkup(player, currentTeamCode) {
        const showDragHandle = normalizeTeamWorkspaceView(activeTeamWorkspaceView) === "all";

        return `
          <article class="player-card team-player-card" data-player-card="${player.id}">
            <div class="team-player-card-head">
              <div class="player-meta">
                <h3 class="player-name">${escapeHtml(displayName(player))}</h3>
                <p class="compact-row-copy">${escapeHtml(playerOriginLabel(player))}</p>
                <div class="player-tags">
                  ${captainBadgeMarkup(player.id)}
                  ${planBadgeMarkup(player.id)}
                  ${(player.positions || [])
                    .map((position) => `<span class="tag-pill">${escapeHtml(position)}</span>`)
                    .join("")}
                </div>
              </div>
              <div class="team-player-controls">
                <div class="assignment-actions">${assignmentActionsMarkup(player.id, currentTeamCode)}</div>
                ${
                  showDragHandle
                    ? `
                      <span
                        class="drag-handle"
                        draggable="true"
                        data-drag-player-id="${player.id}"
                        aria-label="Move ${escapeHtml(displayName(player))} to another team"
                        title="Drag on desktop or use the team buttons on mobile"
                      >
                        Drag card
                      </span>
                    `
                    : ""
                }
              </div>
            </div>

            ${
              currentTeamCode
                ? playerStatsFormMarkup(player.id, "matchday")
                : ""
            }
          </article>
        `;
      }

      function renderTeams() {
        clearDragState();
        const unassignedPlayers = getUnassignedPlayers();
        const balanceSummary = currentTeamBalanceSummary();
        const activeView = normalizeTeamWorkspaceView(activeTeamWorkspaceView);
        const unassignedSectionMarkup = `
          <section class="group-panel unassigned" data-drop-team-code="none">
            <div class="group-head">
              <div>
                <h2 class="group-title">Unassigned</h2>
                <p class="group-copy">Attending players who have not been placed into one of the four teams yet.</p>
              </div>
              <div class="count-badge">
                <span>Pool</span>
                <strong>${escapeHtml(unassignedPlayers.length)}</strong>
              </div>
            </div>
            <div class="player-grid">
              ${
                unassignedPlayers.length
                  ? unassignedPlayers.map((player) => playerCardMarkup(player, null)).join("")
                  : `<div class="empty-state">No unassigned IN players match the current search.</div>`
              }
            </div>
          </section>
        `;

        const teamSections = TEAM_CONFIG.map((team) => {
          const teamPlayers = getTeamPlayers(team.code);
          const teamCount = getTeamCount(team.code);

          return {
            code: team.code,
            markup: `
              <section class="group-panel ${team.code}" data-drop-team-code="${team.code}">
                <div class="group-head">
                  <div>
                    <h2 class="group-title">${team.label}</h2>
                    <p class="group-copy">${team.maxPlayers} player cap for this team.</p>
                    ${teamBalanceSummaryMarkup(balanceSummary, team.code)}
                    ${captainControlsMarkup(team.code)}
                  </div>
                  <div class="count-badge">
                    <span>Count</span>
                    <strong>${escapeHtml(teamCount)}/${escapeHtml(team.maxPlayers)}</strong>
                  </div>
                </div>
                <div class="player-grid">
                  ${
                    teamPlayers.length
                      ? teamPlayers.map((player) => playerCardMarkup(player, team.code)).join("")
                      : `<div class="empty-state">No players in ${escapeHtml(team.label)} yet.</div>`
                  }
                </div>
              </section>
            `,
          };
        });

        const visibleSectionMarkup =
          activeView === "all"
            ? [unassignedSectionMarkup, ...teamSections.map((section) => section.markup)].join("")
            : activeView === "pool"
              ? unassignedSectionMarkup
              : teamSections.find((section) => section.code === activeView)?.markup || unassignedSectionMarkup;

        teamGrid.innerHTML = `
          ${teamBalanceBannerMarkup(balanceSummary)}
          ${teamWorkspaceTabsMarkup()}
          ${captainTrackerMarkup()}
          ${visibleSectionMarkup}
        `;
      }

      function matchCardMarkup(match, title) {
        return `
          <article class="match-card">
            <h3 class="match-name">${escapeHtml(title)}</h3>
            <p class="match-subtitle">${
              match.home_team_code && match.away_team_code
                ? `${escapeHtml(teamLabel(match.home_team_code))} vs ${escapeHtml(teamLabel(match.away_team_code))}`
                : "Waiting for bracket resolution"
            }</p>

            ${
              match.home_team_code && match.away_team_code
                ? `
                  <form class="score-form" data-match-form="${match.id}" data-round="${match.round_number}">
                    <div class="score-fields">
                      <div class="mini-field">
                        <label for="home-score-${match.id}">${escapeHtml(teamLabel(match.home_team_code))}</label>
                        <input
                          id="home-score-${match.id}"
                          name="home_score"
                          type="number"
                          min="0"
                          value="${match.home_score ?? ""}"
                        />
                      </div>
                      <div class="mini-field">
                        <label for="away-score-${match.id}">${escapeHtml(teamLabel(match.away_team_code))}</label>
                        <input
                          id="away-score-${match.id}"
                          name="away_score"
                          type="number"
                          min="0"
                          value="${match.away_score ?? ""}"
                        />
                      </div>
                    </div>
                    <button class="mini-button" type="submit">Save score</button>
                  </form>
                `
                : `<div class="empty-state">Round 2 teams have not been assigned yet.</div>`
            }
          </article>
        `;
      }

      function renderMatches() {
        const roundOneFirst = getMatch(1, 1);
        const roundOneSecond = getMatch(1, 2);
        const roundTwoFirst = getMatch(2, 1);
        const roundTwoSecond = getMatch(2, 2);
        const roundTwoState = getRoundTwoState();

        let resolutionMarkup = "";

        if (roundTwoState.mode === "pending_round_one") {
          resolutionMarkup = `
            <div class="resolution-box">
              <strong>Round 2 is waiting</strong>
              Save both Round 1 scores to resolve the second round.
            </div>
          `;
        } else if (roundTwoState.mode === "winner_choice") {
          resolutionMarkup = `
            <div class="resolution-box">
              <strong>${escapeHtml(teamLabel(roundTwoState.chooser))} chooses the top match</strong>
              <p class="micro-note">
                One Round 1 match had a winner and the other ended in a draw. Choose which drawn team
                faces ${escapeHtml(teamLabel(roundTwoState.chooser))} in Round 2 Match 1.
              </p>
              <div class="actions">
                ${roundTwoState.options
                  .map(
                    (teamCode) => `
                      <button
                        class="secondary-button"
                        type="button"
                        data-round-two-choice="${teamCode}"
                        data-chooser="${roundTwoState.chooser}"
                        data-fallback="${roundTwoState.fallback}"
                      >
                        ${escapeHtml(teamLabel(teamCode))}
                      </button>
                    `
                  )
                  .join("")}
              </div>
            </div>
          `;
        } else if (roundTwoState.mode === "coin_flip") {
          resolutionMarkup = `
            <div class="resolution-box">
              <strong>Both Round 1 matches ended in draws</strong>
              <p class="micro-note">
                Flip a coin to set the two cross-pairings for Round 2. Use it again if you want a
                new random bracket.
              </p>
              <div class="actions">
                <button class="primary-button" type="button" id="coin-flip-button">Flip coin for Round 2</button>
              </div>
            </div>
          `;
        }

        matchesGrid.innerHTML = `
          ${matchCardMarkup(roundOneFirst, `Round 1 - ${teamLabel("blue")} vs ${teamLabel("magenta")}`)}
          ${matchCardMarkup(roundOneSecond, `Round 1 - ${teamLabel("orange")} vs ${teamLabel("green")}`)}
          ${resolutionMarkup}
          ${matchCardMarkup(roundTwoFirst, "Round 2 - Top match")}
          ${matchCardMarkup(roundTwoSecond, "Round 2 - Lower match")}
        `;
      }

      async function saveMatchScore(matchId, roundNumber, form) {
        const homeScoreRaw = normalizeText(form.querySelector("[name='home_score']").value);
        const awayScoreRaw = normalizeText(form.querySelector("[name='away_score']").value);

        if (!homeScoreRaw || !awayScoreRaw) {
          setStatus("Enter both scores before saving the match.", "error");
          return;
        }

        const homeScore = Number(homeScoreRaw);
        const awayScore = Number(awayScoreRaw);

        if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
          setStatus("Scores must be whole numbers 0 or greater.", "error");
          return;
        }

        try {
          const { error } = await supabaseClient
            .from("matchday_matches")
            .update({
              home_score: homeScore,
              away_score: awayScore,
            })
            .eq("id", matchId);

          if (error) {
            throw error;
          }

          if (roundNumber === 1) {
            await resetRoundTwoPairings();
          }

          await loadMatchdayEngine();
          setStatus("Score saved.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      async function resolveWinnerChoice(chooserTeam, chosenTeam, fallbackTeam) {
        const state = getRoundTwoState();
        const otherDrawTeam = state.options.find((teamCode) => teamCode !== chosenTeam);

        const rows = [
          {
            round_number: 2,
            match_order: 1,
            home_team_code: chooserTeam,
            away_team_code: chosenTeam,
          },
          {
            round_number: 2,
            match_order: 2,
            home_team_code: fallbackTeam,
            away_team_code: otherDrawTeam,
          },
        ];

        try {
          await saveRoundTwoPairings(rows);
          await loadMatchdayEngine();
          setStatus("Round 2 pairings updated from the winner selection.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      async function flipCoinForRoundTwo() {
        const state = getRoundTwoState();

        if (state.mode !== "coin_flip") {
          return;
        }

        const [firstA, firstB] = state.firstPair;
        const [secondA, secondB] = state.secondPair;
        const flip = Math.random() < 0.5;
        const rows = flip
          ? [
              {
                round_number: 2,
                match_order: 1,
                home_team_code: firstA,
                away_team_code: secondA,
              },
              {
                round_number: 2,
                match_order: 2,
                home_team_code: firstB,
                away_team_code: secondB,
              },
            ]
          : [
              {
                round_number: 2,
                match_order: 1,
                home_team_code: firstA,
                away_team_code: secondB,
              },
              {
                round_number: 2,
                match_order: 2,
                home_team_code: firstB,
                away_team_code: secondA,
              },
            ];

        try {
          await saveRoundTwoPairings(rows);
          await loadMatchdayEngine();
          setStatus("Round 2 pairings set by coin flip.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      attendanceGrid.addEventListener("change", async (event) => {
        const select = event.target.closest("[data-attendance-player-id]");

        if (!select) {
          return;
        }

        await setAttendanceStatus(Number(select.dataset.attendancePlayerId), select.value);
      });

      attendanceGrid.addEventListener("click", async (event) => {
        const autoBalanceButton = event.target.closest("[data-auto-balance-button]");

        if (autoBalanceButton) {
          await autoBalanceTeams(autoBalanceButton);
          return;
        }

        const assignButton = event.target.closest("[data-player-id][data-team-code]");

        if (assignButton) {
          await assignPlayer(Number(assignButton.dataset.playerId), assignButton.dataset.teamCode);
        }
      });

      attendanceGrid.addEventListener("submit", async (event) => {
        const form = event.target.closest("[data-player-stats-form]");

        if (!form) {
          return;
        }

        event.preventDefault();
        await saveStatForm(Number(form.dataset.playerStatsForm), form);
      });

      teamGrid.addEventListener("dragstart", (event) => {
        const handle = event.target.closest("[data-drag-player-id]");

        if (!handle) {
          return;
        }

        draggedPlayerId = Number(handle.dataset.dragPlayerId);
        draggedCard = handle.closest("[data-player-card]");

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(draggedPlayerId));
        }

        requestAnimationFrame(() => {
          draggedCard?.classList.add("dragging");
        });

        setStatus("Move the player into a team panel, or back to Unassigned.", "success");
      });

      teamGrid.addEventListener("dragover", (event) => {
        if (!draggedPlayerId) {
          return;
        }

        const zone = getDropZone(event.target);

        if (!zone) {
          return;
        }

        event.preventDefault();
        activateDropZone(zone);
      });

      teamGrid.addEventListener("drop", async (event) => {
        const zone = getDropZone(event.target);

        if (!zone || !draggedPlayerId) {
          return;
        }

        event.preventDefault();
        const playerId = draggedPlayerId;
        const nextTeamCode = zone.dataset.dropTeamCode;
        clearDragState();
        await assignPlayer(playerId, nextTeamCode);
      });

      teamGrid.addEventListener("dragend", () => {
        clearDragState();
      });

      teamGrid.addEventListener("dragleave", (event) => {
        const zone = getDropZone(event.target);

        if (!zone || zone.contains(event.relatedTarget)) {
          return;
        }

        zone.classList.remove("drag-target");
      });

      teamGrid.addEventListener("change", async (event) => {
        const captainSelect = event.target.closest("[data-captain-team-code]");

        if (!captainSelect || !captainSelect.value) {
          return;
        }

        await saveTeamCaptain(captainSelect.dataset.captainTeamCode, captainSelect.value);
      });

      teamGrid.addEventListener("click", async (event) => {
        const teamViewTrigger = event.target.closest("[data-team-view-trigger]");

        if (teamViewTrigger) {
          activeTeamWorkspaceView = normalizeTeamWorkspaceView(teamViewTrigger.dataset.teamViewTrigger);
          renderTeams();
          return;
        }

        const finalCaptainModeToggle = event.target.closest("[data-final-captain-mode-toggle]");

        if (finalCaptainModeToggle) {
          await toggleFinalCaptainMode(finalCaptainModeToggle);
          return;
        }

        const autoBalanceButton = event.target.closest("[data-auto-balance-button]");

        if (autoBalanceButton) {
          await autoBalanceTeams(autoBalanceButton);
          return;
        }

        const assignButton = event.target.closest("[data-player-id][data-team-code]");

        if (assignButton) {
          await assignPlayer(Number(assignButton.dataset.playerId), assignButton.dataset.teamCode);
        }
      });

      teamGrid.addEventListener("submit", async (event) => {
        const form = event.target.closest("[data-player-stats-form]");

        if (!form) {
          return;
        }

        event.preventDefault();
        await saveStatForm(Number(form.dataset.playerStatsForm), form);
      });

      matchesGrid.addEventListener("submit", async (event) => {
        const form = event.target.closest("[data-match-form]");

        if (!form) {
          return;
        }

        event.preventDefault();
        await saveMatchScore(
          Number(form.dataset.matchForm),
          Number(form.dataset.round),
          form
        );
      });

      matchesGrid.addEventListener("click", async (event) => {
        const choiceButton = event.target.closest("[data-round-two-choice]");

        if (choiceButton) {
          await resolveWinnerChoice(
            choiceButton.dataset.chooser,
            choiceButton.dataset.roundTwoChoice,
            choiceButton.dataset.fallback
          );
          return;
        }

        if (event.target.id === "coin-flip-button") {
          await flipCoinForRoundTwo();
        }
      });

      matchdaySeasonSelect.addEventListener("change", async () => {
        try {
          await previewSeasonMatchday(Number(matchdaySeasonSelect.value) || null);
        } catch (error) {
          launcherTargetMatchdayId = null;
          openSeasonMatchdayButton.disabled = true;
          matchdayLauncherNote.textContent = readableError(error);
          setStatus(readableError(error), "error");
        }
      });
      openSeasonMatchdayButton.addEventListener("click", () => {
        const seasonId = Number(matchdaySeasonSelect.value) || null;

        if (!seasonId || !launcherTargetMatchdayId) {
          setStatus("Choose a season with an available matchday first.", "warning");
          return;
        }

        redirectToMatchday(launcherTargetMatchdayId, seasonId);
      });
      replacementPlayerSelect.addEventListener("change", syncReplacementDefaults);
      replacementAddButton.addEventListener("click", addReplacementToSeason);
      const rerenderFilteredPlayers = () => {
        renderAttendance();
        renderTeams();
      };
      playerSearch.addEventListener("input", rerenderFilteredPlayers);
      playerTierFilter?.addEventListener("change", rerenderFilteredPlayers);
      rosterViewTriggers.forEach((button) => {
        button.addEventListener("click", () => {
          setRosterView(button.dataset.rosterViewTrigger);
        });
      });
      teamDisplayGrid.addEventListener("input", (event) => {
        const colorInput = event.target.closest("[data-team-display-color]");

        if (!colorInput) {
          return;
        }

        const colorPill = colorInput.parentElement?.querySelector(".tag-pill");

        if (colorPill) {
          colorPill.textContent = normalizeText(colorInput.value).toUpperCase();
        }
      });
      saveScoringButton.addEventListener("click", saveScoringSettings);
      saveTeamDisplayButton.addEventListener("click", saveTeamDisplaySettings);
      resetTeamDisplayButton.addEventListener("click", () => {
        applySeasonTeamDisplay(normalizeTeamDisplayConfig(null));
        renderTeams();
        renderMatches();
        setStatus("Default team labels loaded into the form. Save to keep them for this season.", "success");
      });
      priorityFillButton.addEventListener("click", applyPriorityRoster);
      goalsPointsToggle.addEventListener("click", toggleGoalsCountAsPoints);

      setRosterView(activeRosterView);
      loadMatchdayEngine();
})();
