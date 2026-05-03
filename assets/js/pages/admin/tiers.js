(async function () {
  "use strict";

      const adminPage = window.MandarinasAdminPage;
      if (!adminPage) {
        return;
      }

      const access = await adminPage.requireAccess({
        pageTitle: "Busses tiers",
      });
      if (!access.ok) {
        return;
      }

      const { supabaseClient } = access;

      const heroCopy = document.getElementById("hero-copy");
      const seasonCountStat = document.getElementById("season-count-stat");
      const spotMixStat = document.getElementById("spot-mix-stat");
      const changeCountStat = document.getElementById("change-count-stat");
      const eligibleCountStat = document.getElementById("eligible-count-stat");
      const selectedSeasonPill = document.getElementById("selected-season-pill");
      const seasonSelect = document.getElementById("season-select");
      const refreshButton = document.getElementById("refresh-button");
      const applyAllButton = document.getElementById("apply-all-button");
      const statusLine = document.getElementById("status-line");
      const priorityStrip = document.getElementById("priority-strip");
      const boardCopy = document.getElementById("board-copy");
      const filterRow = document.getElementById("filter-row");
      const recommendationSummaryPills = document.getElementById("recommendation-summary-pills");
      const tierGrid = document.getElementById("tier-grid");
      const params = new URLSearchParams(window.location.search);
      const logic = window.MandarinasLogic || {};
      const suggestionSlotLimit = logic.TIER_SUGGESTION_SLOT_LIMIT || 36;
      const sortSeasonsChronologically =
        logic.sortSeasonsChronologically || ((rows) => [...(rows || [])]);
      const historicalSeasonIds = logic.historicalSeasonIds || (() => []);
      const summarizeHistoricalAttendance =
        logic.summarizeHistoricalAttendance || ((rows) => [...(rows || [])]);
      const buildStandingsByPlayerId =
        logic.buildStandingsByPlayerId || (() => new Map());
      const rotationQueueMode = logic.rotationQueueMode || (() => "regular");
      const buildRotationQueueRows =
        logic.buildRotationQueueRows ||
        ((rows) =>
          [...(rows || [])].filter((row) => row.tier_status === "flex" && row.is_eligible));
      const applyTierSuggestionSlots = logic.applyTierSuggestionSlots || ((rows) => [...(rows || [])]);
      const tierSuggestionEvidence =
        logic.tierSuggestionEvidence || ((row) => row?.suggestion_evidence || "");
      const normalizeTierValue =
        logic.normalizeTierValue ||
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

      let seasons = [];
      let selectedSeasonId = Number(params.get("season_id")) || null;
      let tierRows = [];
      let activeFilter = "all";
      let standingsByPlayerId = new Map();
      let activeQueueMode = "regular";

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

      function escapeHtml(value) {
        return String(value == null ? "" : value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function setStatus(message = "", tone = "") {
        statusLine.className = "status-line";

        if (!message) {
          statusLine.hidden = true;
          statusLine.textContent = "";
          return;
        }

        statusLine.hidden = false;
        statusLine.textContent = message;

        if (tone) {
          statusLine.classList.add(tone);
        }
      }

      function readableError(error) {
        const message = error?.message || "Unknown error";
        const lowerMessage = message.toLowerCase();

        if (
          lowerMessage.includes("relation") &&
          (lowerMessage.includes("season_players") ||
            lowerMessage.includes("seasons") ||
            lowerMessage.includes("v_season_tier"))
        ) {
          return "Planner cannot open until live club data is ready.";
        }

        if (lowerMessage.includes("column") || lowerMessage.includes("schema cache")) {
          return "Planner is waiting for the latest live club update.";
        }

        return message;
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

      function normalizeTierRow(row) {
        if (!row) {
          return row;
        }

        const defaultStatus = normalizeTierValue(row.default_status, "sub");
        const tierStatus = normalizeTierValue(row.tier_status || defaultStatus, defaultStatus);
        const recommendedTier = normalizeTierValue(
          row.recommended_tier_status || row.preliminary_recommended_tier_status || tierStatus,
          tierStatus
        );

        return {
          ...row,
          default_status: defaultStatus,
          tier_status: tierStatus,
          preliminary_recommended_tier_status: normalizeTierValue(
            row.preliminary_recommended_tier_status || recommendedTier,
            recommendedTier
          ),
          recommended_tier_status: recommendedTier,
        };
      }

      function currentTier(row) {
        return normalizeTierValue(row.tier_status || row.default_status, "sub");
      }

      function formatStatusLabel(value) {
        const normalized = normalizeTierValue(value, "");
        if (!normalized) return "Flex";
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
      }

      function formatSpotValue(value) {
        const numeric = Number(value || 0);
        return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
      }

      function formatTrendLabel(value) {
        const lookup = {
          up: "Move up",
          steady: "Stay put",
          down: "Move down",
        };

        return lookup[value] || "Stay put";
      }

      function formatTrendSymbol(value) {
        if (value === "up") return "↑";
        if (value === "down") return "↓";
        return "=";
      }

      function trendClassName(value) {
        if (value === "up") return "tier-move-up";
        if (value === "down") return "tier-move-down";
        return "tier-move-steady";
      }

      function movementBadgeMarkup(value) {
        return `<span class="move-badge ${escapeHtml(trendClassName(value))}">${escapeHtml(
          formatTrendLabel(value)
        )}</span>`;
      }

      function suggestionWeight(status) {
        const lookup = {
          core: 0,
          flex: 1,
          sub: 2,
        };

        return lookup[normalizeTierValue(status, "")] ?? 3;
      }

      function suggestionEvidenceText(row) {
        return row?.suggestion_evidence || tierSuggestionEvidence(row) || "Attendance evidence unavailable.";
      }

      function suggestionCounts(rows = tierRows) {
        return rows.reduce(
          (counts, row) => {
            const trend = row?.trend || "steady";
            counts.total += 1;

            if (row.default_status !== row.recommended_tier_status) {
              counts.changes += 1;
            }

            if (trend === "up") {
              counts.up += 1;
            } else if (trend === "down") {
              counts.down += 1;
            } else {
              counts.steady += 1;
            }

            return counts;
          },
          { total: 0, changes: 0, up: 0, steady: 0, down: 0 }
        );
      }

      function suggestionSummaryPillsMarkup(counts, spotMixUsed) {
        return `
          <div class="summary-pill">
            <strong>${escapeHtml(counts.changes)}</strong>
            <span>Review cases</span>
          </div>
          <div class="summary-pill">
            <strong>${escapeHtml(counts.up)}</strong>
            <span>Move up</span>
          </div>
          <div class="summary-pill">
            <strong>${escapeHtml(counts.steady)}</strong>
            <span>Hold</span>
          </div>
          <div class="summary-pill">
            <strong>${escapeHtml(counts.down)}</strong>
            <span>Move down</span>
          </div>
          <div class="summary-pill">
            <strong>${escapeHtml(formatSpotValue(spotMixUsed))} / ${escapeHtml(
              formatSpotValue(suggestionSlotLimit)
            )}</strong>
            <span>Plan fill</span>
          </div>
        `;
      }

      function isCompactPhoneLayout() {
        return window.matchMedia("(max-width: 719px)").matches;
      }

      function queueReasonText(row) {
        const attended = Number(row?.games_attended || 0);
        const totalPoints = Number(row?.total_points || 0);

        if ((row?.rotation_queue_mode || activeQueueMode) === "final") {
          return `Final matchday queue uses season points first. Tied points fall back to goals, goal keeps, clean sheets, and the rest of the season totals. This player is on ${totalPoints} point${
            totalPoints === 1 ? "" : "s"
          }.`;
        }

        return `Regular matchdays keep lower attendance first. This player has attended ${attended} matchday${
          attended === 1 ? "" : "s"
        }; tied attendance falls back to points, goals, goal keeps, clean sheets, and the rest of the season totals.`;
      }

      function renderQueueCards(rows, queueMap) {
        const metricLabel = activeQueueMode === "final" ? "Pts" : "Score";

        return `
          <div class="standings-card-list">
            ${rows
              .map(
                (row) => `
                  <article class="standings-card">
                    <header class="standings-card-head">
                      <div class="standings-rank-badge">Q${escapeHtml(queueMap.get(row.player_id))}</div>
                      <div class="standings-card-title">
                        <div class="player-main">${escapeHtml(displayName(row))}</div>
                        ${
                          row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                            ? `<div class="table-player-sub">${escapeHtml(fullName(row))}</div>`
                            : ""
                        }
                      </div>
                    </header>
                    <div class="standings-metrics">
                      <div class="metric-pill"><span>Att</span><strong>${escapeHtml(row.games_attended)}</strong></div>
                      <div class="metric-pill"><span>${escapeHtml(metricLabel)}</span><strong>${escapeHtml(
                        activeQueueMode === "final" ? Number(row.total_points || 0) : row.attendance_score
                      )}</strong></div>
                    </div>
                    <div class="manual-note">${escapeHtml(queueReasonText(row))}</div>
                  </article>
                `
              )
              .join("")}
          </div>
        `;
      }

      function renderRecommendationCards(rows) {
        return `
          <div class="standings-card-list">
            ${rows
              .map((row, index) => {
                const evidenceText = suggestionEvidenceText(row);
                return `
                  <article class="standings-card">
                    <header class="standings-card-head">
                      <div class="standings-rank-badge">${escapeHtml(index + 1)}</div>
                      <div class="standings-card-title">
                        <div class="player-main">${escapeHtml(displayName(row))}</div>
                        ${
                          row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                            ? `<div class="table-player-sub">${escapeHtml(fullName(row))}</div>`
                            : ""
                        }
                      </div>
                    </header>
                    <div class="compact-badges">
                      <span class="status-pill ${escapeHtml(row.default_status)}">Saved: ${escapeHtml(
                        formatStatusLabel(row.default_status)
                      )}</span>
                      <span class="status-pill ${escapeHtml(currentTier(row))}">Live now: ${escapeHtml(
                        formatStatusLabel(currentTier(row))
                      )}</span>
                      ${movementBadgeMarkup(row.trend)}
                      <span class="status-pill ${escapeHtml(row.recommended_tier_status)}">Suggested next: ${escapeHtml(
                        formatStatusLabel(row.recommended_tier_status)
                      )}</span>
                    </div>
                    <div class="standings-metrics">
                      <div class="metric-pill"><span>Plan slot</span><strong>${
                        row.suggestion_spot_value
                          ? escapeHtml(formatSpotValue(row.suggestion_spot_value))
                          : "—"
                      }</strong></div>
                      <div class="metric-pill"><span>Season games</span><strong>${escapeHtml(row.games_attended)}</strong></div>
                      <div class="metric-pill"><span>Season score</span><strong>${escapeHtml(row.attendance_score)}</strong></div>
                      <div class="metric-pill"><span>Last 8</span><strong>${escapeHtml(
                        row.recent_attendance_score || 0
                      )}</strong></div>
                      <div class="metric-pill"><span>All-time</span><strong>${escapeHtml(
                        row.historical_attendance_score || 0
                      )}</strong></div>
                    </div>
                    <div class="detail-list">
                      <div class="detail-item">
                        <span class="detail-label">Why the app leans here</span>
                        <strong>${escapeHtml(row.transparency_note || "No summary note yet.")}</strong>
                        <span class="tier-evidence">${escapeHtml(evidenceText)}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">What helps next</span>
                        <strong>${escapeHtml(row.next_step || "Keep showing up consistently.")}</strong>
                      </div>
                    </div>
                    <div class="actions">
                      ${
                        row.default_status !== row.recommended_tier_status
                          ? `<button class="primary-button" type="button" data-apply-player="${row.player_id}">Apply suggested tier</button>`
                          : `<span class="micro-note">Already in sync with the recommendation.</span>`
                      }
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        `;
      }

      function renderSeasonOptions() {
        if (!seasons.length) {
          seasonSelect.innerHTML = `<option value="">No seasons yet</option>`;
          selectedSeasonPill.textContent = "No season selected";
          return;
        }

        seasonSelect.innerHTML = seasons
          .map(
            (season) => `
              <option value="${season.id}" ${season.id === selectedSeasonId ? "selected" : ""}>
                ${escapeHtml(season.name)}
              </option>
            `
          )
          .join("");
      }

      async function fetchHistoricalTierContext(playerIds) {
        const priorSeasonIds = historicalSeasonIds(seasons, selectedSeasonId);
        const targetPlayerIds = [...new Set((playerIds || []).map(Number).filter(Number.isFinite))];

        if (!priorSeasonIds.length || !targetPlayerIds.length) {
          return {
            matchdays: [],
            matches: [],
            playerStats: [],
          };
        }

        const { data: historicalMatchdays, error: historicalMatchdaysError } = await supabaseClient
          .from("matchdays")
          .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
          .in("season_id", priorSeasonIds)
          .order("season_id", { ascending: true })
          .order("matchday_number", { ascending: true })
          .limit(5000);

        if (historicalMatchdaysError) {
          throw historicalMatchdaysError;
        }

        const historicalMatchdayIds = (historicalMatchdays || []).map((matchday) => matchday.id);
        if (!historicalMatchdayIds.length) {
          return {
            matchdays: historicalMatchdays || [],
            matches: [],
            playerStats: [],
          };
        }

        const [{ data: historicalMatches, error: historicalMatchesError }, { data: historicalPlayerStats, error: historicalPlayerStatsError }] =
          await Promise.all([
            supabaseClient
              .from("matchday_matches")
              .select("*")
              .in("matchday_id", historicalMatchdayIds)
              .order("matchday_id", { ascending: true })
              .order("round_number", { ascending: true })
              .order("match_order", { ascending: true })
              .limit(20000),
            supabaseClient
              .from("matchday_player_stats")
              .select("*")
              .in("matchday_id", historicalMatchdayIds)
              .in("player_id", targetPlayerIds)
              .limit(20000),
          ]);

        if (historicalMatchesError) {
          throw historicalMatchesError;
        }

        if (historicalPlayerStatsError) {
          throw historicalPlayerStatsError;
        }

        return {
          matchdays: historicalMatchdays || [],
          matches: historicalMatches || [],
          playerStats: historicalPlayerStats || [],
        };
      }

      function renderBoard() {
        const selectedSeason = seasons.find((season) => season.id === selectedSeasonId) || null;
        const rotationQueueRows = buildRotationQueueRows(tierRows, {
          standingsByPlayerId,
          finalMatchday: activeQueueMode === "final",
        });
        const rotationQueueMap = new Map(rotationQueueRows.map((row, index) => [row.player_id, index + 1]));
        const queuePreviewRows = rotationQueueRows.slice(0, 10);
        const queueMetricLabel = activeQueueMode === "final" ? "Pts" : "Score";
        const filteredRows = tierRows
          .filter((row) => {
            if (activeFilter === "changes") {
              return row.default_status !== row.recommended_tier_status;
            }

            return activeFilter === "all" || row.recommended_tier_status === activeFilter;
          })
          .sort((left, right) => {
            if (suggestionWeight(left.recommended_tier_status) !== suggestionWeight(right.recommended_tier_status)) {
              return suggestionWeight(left.recommended_tier_status) - suggestionWeight(right.recommended_tier_status);
            }

            if (Number(right.suggestion_spot_value || 0) !== Number(left.suggestion_spot_value || 0)) {
              return Number(right.suggestion_spot_value || 0) - Number(left.suggestion_spot_value || 0);
            }

            if (
              Number(left.suggestion_slot_rank || 0) > 0 &&
              Number(right.suggestion_slot_rank || 0) > 0 &&
              Number(left.suggestion_slot_rank || 0) !== Number(right.suggestion_slot_rank || 0)
            ) {
              return Number(left.suggestion_slot_rank || 0) - Number(right.suggestion_slot_rank || 0);
            }

            if (Number(right.recent_attendance_score || 0) !== Number(left.recent_attendance_score || 0)) {
              return Number(right.recent_attendance_score || 0) - Number(left.recent_attendance_score || 0);
            }

            if (right.attendance_score !== left.attendance_score) {
              return right.attendance_score - left.attendance_score;
            }

            if (right.games_attended !== left.games_attended) {
              return right.games_attended - left.games_attended;
            }

            if (
              Number(right.historical_attendance_score || 0) !==
              Number(left.historical_attendance_score || 0)
            ) {
              return (
                Number(right.historical_attendance_score || 0) -
                Number(left.historical_attendance_score || 0)
              );
            }

            return displayName(left).localeCompare(displayName(right));
          });

        const changeCount = tierRows.filter((row) => row.default_status !== row.recommended_tier_status).length;
        const eligibleCount = tierRows.filter((row) => row.is_eligible !== false).length;
        const spotMixUsed = tierRows.reduce(
          (total, row) => total + Number(row.suggestion_spot_value || 0),
          0
        );
        const counts = suggestionCounts();

        seasonCountStat.textContent = selectedSeason ? selectedSeason.name : "-";
        spotMixStat.textContent = `${formatSpotValue(spotMixUsed)} / ${formatSpotValue(
          suggestionSlotLimit
        )}`;
        changeCountStat.textContent = String(changeCount);
        eligibleCountStat.textContent = String(eligibleCount);
        selectedSeasonPill.textContent = selectedSeason ? selectedSeason.name : "No season selected";
        recommendationSummaryPills.innerHTML = tierRows.length
          ? suggestionSummaryPillsMarkup(counts, spotMixUsed)
          : "";
        heroCopy.textContent = selectedSeason
          ? `${selectedSeason.name} keeps the live flex queue separate from the next-tier recommendation plan. Read the queue for today's next spot, then use the recommendation board for manager review. The plan always fills a weighted ${formatSpotValue(
              suggestionSlotLimit
            )}-spot mix where Core uses 1 full spot and two Flex players share 1 spot.`
          : "The live queue and next-tier recommendation plan are separate views.";
        boardCopy.textContent = selectedSeason
          ? `${selectedSeason.name} is the active season lens. Start with Changes to review actionable cases first. Saved is the squad record, Live now is the season tier being used today, and Suggested next is the attendance-based recommendation. The board leans on the last 8 matchdays first, then season totals, with past seasons as supporting context.`
          : "Start with Changes to review movement cases first.";

        if (!rotationQueueRows.length) {
          priorityStrip.innerHTML = `
            <div class="subtable-head">
              <div>
                <h3>Current Flex Queue</h3>
                <p>Current flex players only. This list stays season-to-date and does not depend on the suggestion mix.</p>
              </div>
            </div>
            <div class="empty-state">No live flex queue yet. Once the season has eligible flex players, this will show who is next up using the current queue rules for the next open spot.</div>
          `;
        } else {
          priorityStrip.innerHTML = `
            <div class="subtable-head">
              <div>
                <h3>Current Flex Queue</h3>
                <p>${escapeHtml(
                  activeQueueMode === "final"
                    ? "Current flex players only. The next open spot is on the final matchday, so #1 follows season points first, then goals, goal keeps, clean sheets, and the rest of the season totals."
                    : "Current flex players only. Fewer season-to-date attended games come first, and tied attendance falls back to points, goals, goal keeps, clean sheets, and the rest of the season totals."
                )}</p>
              </div>
            </div>
            ${
              isCompactPhoneLayout()
                ? renderQueueCards(queuePreviewRows, rotationQueueMap)
                : `
                    <table class="standings-table">
                      <thead>
                        <tr>
                          <th class="num">Q</th>
                          <th>Player</th>
                          <th class="num">Att</th>
                          <th class="num">${escapeHtml(queueMetricLabel)}</th>
                          <th class="hide-mobile">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${queuePreviewRows
                          .map(
                            (row) => `
                              <tr>
                                <td class="num"><span class="queue-pill">${escapeHtml(rotationQueueMap.get(row.player_id))}</span></td>
                                <td>
                                  <div class="player-cell">
                                    <span class="name">${escapeHtml(displayName(row))}</span>
                                    ${
                                      row.nickname && fullName(row) !== stripSubPrefix(row.nickname)
                                        ? `<span class="sub">${escapeHtml(fullName(row))}</span>`
                                        : ""
                                    }
                                  </div>
                                </td>
                                <td class="num">${escapeHtml(row.games_attended)}</td>
                                <td class="num">${escapeHtml(
                                  activeQueueMode === "final" ? Number(row.total_points || 0) : row.attendance_score
                                )}</td>
                                <td class="hide-mobile">${escapeHtml(queueReasonText(row))}</td>
                              </tr>
                            `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  `
            }
          `;
        }

        if (!selectedSeason) {
          tierGrid.innerHTML = `<div class="empty-state">Launch a campaign first, then return to Planner.</div>`;
          return;
        }

        if (!tierRows.length) {
          tierGrid.innerHTML = `<div class="empty-state">No active roster exists yet for ${escapeHtml(
            selectedSeason.name
          )}. Build the season squad in Season Centre before using Planner.</div>`;
          return;
        }

        if (!filteredRows.length) {
          tierGrid.innerHTML = `
            <div class="subtable-head">
              <div>
                <h3>Recommended Tier Plan</h3>
                <p>Recommendations follow the selected chip and always total a weighted ${formatSpotValue(
                  suggestionSlotLimit
                )}-spot plan. Use Changes to focus on review cases that do not match the saved squad tier.</p>
              </div>
            </div>
            <div class="empty-state">No players match the current recommended-tier filter.</div>
          `;
          return;
        }

        tierGrid.innerHTML = `
          <div class="subtable-head">
              <div>
                <h3>Recommended Tier Plan</h3>
                <p>${escapeHtml(
                  `This board is the next-tier plan, not today's queue. Saved is the squad record, Live now is the season tier being used today, and Suggested next is the review recommendation. The plan currently uses ${formatSpotValue(spotMixUsed)} of ${formatSpotValue(
                    suggestionSlotLimit
                )} weighted spots. Core uses 1 full spot, and two Flex players share 1 spot.`
              )}</p>
            </div>
          </div>
          ${
            isCompactPhoneLayout()
              ? renderRecommendationCards(filteredRows)
              : `
                  <table class="standings-table">
                    <thead>
                      <tr>
                        <th class="num">#</th>
                        <th>Player</th>
                        <th class="hide-mobile">Saved</th>
                        <th>Live now</th>
                        <th>Change</th>
                        <th>Suggested next</th>
                        <th class="num">Plan slot</th>
                        <th class="num">Season games</th>
                        <th class="num">Season score</th>
                        <th class="num hide-mobile">All-time</th>
                        <th class="num hide-mobile">Last 8</th>
                        <th class="hide-mobile">Why</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredRows
                        .map((row, index) => {
                          const evidenceText = suggestionEvidenceText(row);
                          return `
                            <tr>
                              <td class="num">${escapeHtml(index + 1)}</td>
                              <td>
                                <div class="player-stack">
                                  <div class="player-cell">
                                    <span class="name">${escapeHtml(displayName(row))}</span>
                                    ${row.nickname && fullName(row) !== row.nickname ? `<span class="sub">${escapeHtml(fullName(row))}</span>` : ""}
                                  </div>
                                  <div class="show-mobile tier-mobile-why" title="${escapeHtml(row.next_step || "")}">
                                    <div class="tier-why-title">${escapeHtml(row.transparency_note || "—")}</div>
                                    <div class="tier-evidence">${escapeHtml(evidenceText)}</div>
                                  </div>
                                </div>
                              </td>
                              <td class="hide-mobile"><span class="status-pill ${escapeHtml(row.default_status)}">${escapeHtml(formatStatusLabel(row.default_status))}</span></td>
                              <td><span class="status-pill ${escapeHtml(currentTier(row))}">${escapeHtml(formatStatusLabel(currentTier(row)))}</span></td>
                              <td>${movementBadgeMarkup(row.trend)}</td>
                              <td><span class="status-pill ${escapeHtml(row.recommended_tier_status)}">${escapeHtml(formatStatusLabel(row.recommended_tier_status))}</span></td>
                              <td class="num">${row.suggestion_spot_value ? `<span class="queue-pill">${escapeHtml(formatSpotValue(row.suggestion_spot_value))}</span>` : "—"}</td>
                              <td class="num">${escapeHtml(row.games_attended)}</td>
                              <td class="num">${escapeHtml(row.attendance_score)}</td>
                              <td class="num hide-mobile">${escapeHtml(row.historical_attendance_score || 0)}</td>
                              <td class="num hide-mobile">${escapeHtml(row.recent_attendance_score || 0)}</td>
                              <td class="hide-mobile">
                                <div class="tier-why-cell" title="${escapeHtml(row.next_step || "")}">
                                  <div class="tier-why-title">${escapeHtml(row.transparency_note || "—")}</div>
                                  <div class="tier-evidence">${escapeHtml(evidenceText)}</div>
                                  <div class="manual-note"><strong>Next:</strong> ${escapeHtml(
                                    row.next_step || "Keep showing up consistently."
                                  )}</div>
                                </div>
                              </td>
                              <td>
                                ${
                                  row.default_status !== row.recommended_tier_status
                                    ? `<button class="primary-button" type="button" data-apply-player="${row.player_id}">Apply</button>`
                                    : `<span class="micro-note">In sync</span>`
                                }
                              </td>
                            </tr>
                          `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                `
          }
        `;
      }

      async function loadSeasonsAndBoard() {
        setStatus("Loading Planner...", "loading");

        try {
          const { data: seasonRows, error: seasonError } = await supabaseClient
            .from("seasons")
            .select("id, name, total_matchdays, core_spots, rotation_spots, attendance_points, win_points, draw_points, loss_points, goal_keep_points, team_goal_points, created_at")
            .order("created_at", { ascending: false });

          if (seasonError) {
            throw seasonError;
          }

          seasons = sortSeasonsChronologically(seasonRows || []);

          if (!selectedSeasonId && seasons.length) {
            selectedSeasonId = seasons[seasons.length - 1].id;
          }

          if (selectedSeasonId && !seasons.some((season) => season.id === selectedSeasonId)) {
            selectedSeasonId = seasons[seasons.length - 1]?.id || null;
          }

          renderSeasonOptions();

          if (!selectedSeasonId) {
            tierRows = [];
            renderBoard();
            setStatus("No campaigns yet. Open Season Centre and launch one first.", "warning");
            return;
          }

          const { data: boardRows, error: boardError } = await supabaseClient
            .from("v_season_tier_transparency")
            .select("*")
            .eq("season_id", selectedSeasonId);

          if (boardError) {
            throw boardError;
          }

          const selectedSeason = seasons.find((season) => Number(season.id) === Number(selectedSeasonId)) || null;
          const { data: seasonMatchdays, error: matchdaysError } = await supabaseClient
            .from("matchdays")
            .select("id, season_id, matchday_number, kickoff_at, goals_count_as_points")
            .eq("season_id", selectedSeasonId)
            .order("matchday_number", { ascending: true });

          if (matchdaysError) {
            throw matchdaysError;
          }

          const matchdayIds = (seasonMatchdays || []).map((matchday) => matchday.id);
          let seasonMatches = [];
          let seasonAssignments = [];
          let seasonPlayerStats = [];

          if (matchdayIds.length) {
            const [{ data: matchRows, error: matchError }, { data: assignmentRows, error: assignmentError }, { data: playerStatRows, error: playerStatsError }] =
              await Promise.all([
                supabaseClient
                  .from("matchday_matches")
                  .select("*")
                  .in("matchday_id", matchdayIds)
                  .order("round_number", { ascending: true })
                  .order("match_order", { ascending: true })
                  .limit(5000),
                supabaseClient
                  .from("matchday_assignments")
                  .select("*")
                  .in("matchday_id", matchdayIds)
                  .limit(10000),
                supabaseClient
                  .from("matchday_player_stats")
                  .select("*")
                  .in("matchday_id", matchdayIds)
                  .limit(10000),
              ]);

            if (matchError) {
              throw matchError;
            }

            if (assignmentError) {
              throw assignmentError;
            }

            if (playerStatsError) {
              throw playerStatsError;
            }

            seasonMatches = matchRows || [];
            seasonAssignments = assignmentRows || [];
            seasonPlayerStats = playerStatRows || [];
          }

          const normalizedBoardRows = (boardRows || []).map((row) => normalizeTierRow(row));
          const historicalContext = await fetchHistoricalTierContext(
            normalizedBoardRows.map((row) => row.player_id)
          );
          const rowsWithHistory = summarizeHistoricalAttendance(
            normalizedBoardRows,
            seasons,
            selectedSeasonId,
            historicalContext.matchdays,
            historicalContext.matches,
            historicalContext.playerStats
          ).map((row) => normalizeTierRow(row));

          standingsByPlayerId = buildStandingsByPlayerId(
            normalizedBoardRows.map((row) => ({
              id: row.player_id,
              first_name: row.first_name,
              last_name: row.last_name,
              nickname: row.nickname,
              nationality: row.nationality,
              status: currentTier(row),
            })),
            seasonAssignments,
            seasonPlayerStats,
            seasonMatchdays || [],
            seasonMatches,
            selectedSeason
          );
          activeQueueMode = rotationQueueMode(selectedSeason, seasonMatchdays || [], seasonMatches);
          tierRows = applyTierSuggestionSlots(rowsWithHistory, suggestionSlotLimit).map((row) =>
            normalizeTierRow(row)
          );
          renderBoard();
          setStatus();
        } catch (error) {
          standingsByPlayerId = new Map();
          activeQueueMode = "regular";
          tierRows = [];
          renderBoard();
          setStatus(readableError(error), "error");
        }
      }

      async function applySuggestion(playerId) {
        const row = tierRows.find((entry) => entry.player_id === playerId);

        if (!row) {
          setStatus("Tier row not found. Refresh the board and try again.", "error");
          return;
        }

        if (row.default_status === row.recommended_tier_status) {
          setStatus("That player already matches the recommended tier.", "warning");
          return;
        }

        setStatus(`Applying ${row.recommended_tier_status} to ${displayName(row)}...`);

        try {
          let { error: playerError } = await supabaseClient
            .from("players")
            .update({
              desired_tier: row.recommended_tier_status,
              status: row.recommended_tier_status,
            })
            .eq("id", playerId);

          if (playerError && hasMissingDesiredTierColumn(playerError)) {
            ({ error: playerError } = await supabaseClient
              .from("players")
              .update({ status: row.recommended_tier_status })
              .eq("id", playerId));
          }

          if (playerError) throw playerError;

          await loadSeasonsAndBoard();
          setStatus("Recommended tier applied to the squad register.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        }
      }

      async function applyAllSuggestions() {
        const rowsToApply = tierRows.filter((row) => row.default_status !== row.recommended_tier_status);

        if (!rowsToApply.length) {
          setStatus("All preferred tiers already match the current recommendations.", "warning");
          return;
        }

        applyAllButton.disabled = true;
        applyAllButton.textContent = "Applying...";
        setStatus(`Applying ${rowsToApply.length} tier recommendations...`);

        try {
          for (const row of rowsToApply) {
            let { error: playerError } = await supabaseClient
              .from("players")
              .update({
                desired_tier: row.recommended_tier_status,
                status: row.recommended_tier_status,
              })
              .eq("id", row.player_id);

            if (playerError && hasMissingDesiredTierColumn(playerError)) {
              ({ error: playerError } = await supabaseClient
                .from("players")
                .update({ status: row.recommended_tier_status })
                .eq("id", row.player_id));
            }

            if (playerError) {
              throw playerError;
            }
          }

          await loadSeasonsAndBoard();
          setStatus("All pathway recommendations were applied to the squad register.", "success");
        } catch (error) {
          setStatus(readableError(error), "error");
        } finally {
          applyAllButton.disabled = false;
          applyAllButton.textContent = "Apply all recommendations";
        }
      }

      seasonSelect.addEventListener("change", async (event) => {
        selectedSeasonId = Number(event.target.value);
        await loadSeasonsAndBoard();
      });

      refreshButton.addEventListener("click", loadSeasonsAndBoard);
      applyAllButton.addEventListener("click", applyAllSuggestions);

      filterRow.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter]");

        if (!button) {
          return;
        }

        activeFilter = button.dataset.filter;

        Array.from(filterRow.querySelectorAll("[data-filter]")).forEach((chip) => {
          chip.classList.toggle("active", chip.dataset.filter === activeFilter);
        });

        renderBoard();
      });

      tierGrid.addEventListener("click", async (event) => {
        const applyButton = event.target.closest("[data-apply-player]");

        if (applyButton) {
          await applySuggestion(Number(applyButton.dataset.applyPlayer));
        }
      });

      let compactLayout = isCompactPhoneLayout();
      window.addEventListener("resize", () => {
        const nextCompactLayout = isCompactPhoneLayout();
        if (nextCompactLayout === compactLayout) {
          return;
        }
        compactLayout = nextCompactLayout;
        renderBoard();
      });

      loadSeasonsAndBoard();
})();
