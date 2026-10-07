const trophyMeta = {
  "Art Ross": { icon: "🏆", description: "Top scoring leader" },
  "Rocket Richard": { icon: "🎯", description: "Most goals" },
  "Norris": { icon: "🛡️", description: "Most points by defensemen" },
  "Selke": { icon: "🧤", description: "Best +/- stats" },
  "Lady Byng": { icon: "👑", description: "Most disciplined / lowest PIM" },
  "Jim Gregory": { icon: "📅", description: "Most games played" },
  "Vezina": { icon: "🥅", description: "Top goaltending" },
  "Hart": { icon: "🏅", description: "League MVP" },
  "Calder": { icon: "🌟", description: "Best keeper" },
  "Jack Adams": { icon: "🧭", description: "Coach of the year" },
  "Conn Smythe": { icon: "🧢", description: "Playoff MVP" },
  "Stanley Cup": { icon: "🏆", description: "Championship" },
  "President's Trophy": { icon: "🥇", description: "Who knows..." },
  "Scout's honor": { icon: "🔎", description: "Best drafted team" },
  "Fantalytic's Frenzy": { icon: "⚡", description: "Best prediction" },
  "It's Vegas Baby!": { icon: "🎲", description: "Higest weekly score" },
  "Back's Backe Back-2-Back": { icon: "🔁", description: "Half-time leader" },
  "The King is Dead!": { icon: "👑", description: "Take out the President" },
  "Chasing the Cup!": { icon: "🏒", description: "Beat last year's Stanley Cup winner" },
  "Bitter Looser or Righteous Winner!": { icon: "🔥", description: "" },
  "Clarence S. Campbell": { icon: "🏟️", description: "Western Champion" },
  "Prince of Wales": { icon: "🛡️", description: "Eastern Champion" },
  "Orange Lantern": { icon: "🟠", description: "Looser of the looser bracket" },
};

const seasonSelect = document.getElementById("seasonSelect");
const seasonTitle = document.getElementById("seasonTitle");
const trophyCount = document.getElementById("trophyCount");
const teamCount = document.getElementById("teamCount");
const lastUpdatedText = document.getElementById("lastUpdatedText");
const matchupBoard = document.getElementById("matchupBoard");
const trophyGrid = document.getElementById("trophyGrid");
const leaderboard = document.getElementById("leaderboard");
const tabMatchupBoard = document.getElementById("tabMatchupBoard");
const tabSeasonLeaderboard = document.getElementById("tabSeasonLeaderboard");
const matchupPane = document.getElementById("matchupPane");
const leaderboardPane = document.getElementById("leaderboardPane");

const groupLabels = {
  regseason: "Regular Season",
  postseason: "Playoffs",
};

const sectionLabels = {
  trophies: "Trophies",
  awards: "Awards",
  bounties: "Bounties",
  achievements: "Achievements",
  winners: "Winners",
};

const trophyDataUrl = window.__GHL_TROPHY_DATA_URL__ || "/trophy-data";
const matchupDataUrl = window.__GHL_MATCHUP_DATA_URL__ || "/matchup-data";

let trackerData = {};
let matchupData = {};
let activeTrophyCard = null;
let activeLeaderboardRow = null;
let activeMatchupIndex = -1;
let matchupSortKey = "FP";
let matchupSortDirection = "desc";
let activeTopBoardTab = "leaderboard";
let matchupTableScrollLeft = 0;
let matchupScrollRestoreTimers = [];

function clearMatchupScrollRestoreTimers() {
  matchupScrollRestoreTimers.forEach((timerId) => window.clearTimeout(timerId));
  matchupScrollRestoreTimers = [];
}

function restoreMatchupTableScroll(tableWrap) {
  const targetScrollLeft = matchupTableScrollLeft;
  const applyScroll = () => {
    tableWrap.scrollLeft = targetScrollLeft;
  };

  applyScroll();
  window.requestAnimationFrame(applyScroll);
  matchupScrollRestoreTimers.push(window.setTimeout(applyScroll, 0));
  matchupScrollRestoreTimers.push(window.setTimeout(applyScroll, 80));
}

function setTopBoardTab(tabKey) {
  activeTopBoardTab = tabKey;
  const isMatchup = tabKey === "matchup";

  if (tabMatchupBoard) {
    tabMatchupBoard.classList.toggle("is-active", isMatchup);
    tabMatchupBoard.setAttribute("aria-selected", String(isMatchup));
  }
  if (tabSeasonLeaderboard) {
    tabSeasonLeaderboard.classList.toggle("is-active", !isMatchup);
    tabSeasonLeaderboard.setAttribute("aria-selected", String(!isMatchup));
  }
  if (matchupPane) {
    matchupPane.hidden = !isMatchup;
  }
  if (leaderboardPane) {
    leaderboardPane.hidden = isMatchup;
  }
}

function formatValue(metric, value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : Number(value).toFixed(2);
  }

  return String(value);
}

function getWinnerFromEntry(entryValue) {
  if (!entryValue || typeof entryValue !== "object") {
    return null;
  }

  if (Array.isArray(entryValue)) {
    const firstRow = entryValue.find((row) => row && typeof row === "object");
    if (!firstRow) {
      return null;
    }

    const teamName = firstRow.Team || firstRow["Fantasy Team"] || firstRow["Team Name"] || "Unknown Team";
    const playerName = firstRow.Player || firstRow["Player Name"] || "";
    const value = firstRow.Fpts ?? firstRow.Points ?? firstRow.score ?? firstRow.value;
    return [teamName, playerName ? `${playerName} • ${formatValue("", value)}` : formatValue("", value)];
  }

  if (entryValue.status === "placeholder") {
    return null;
  }

  const entries = Object.entries(entryValue);
  if (!entries.length) {
    return null;
  }

  const placeholderEntry = entries.find(([key, value]) => key === "Winner/Leader TBD" && typeof value !== "object");
  if (placeholderEntry) {
    return placeholderEntry;
  }

  const winner = entries.find(([teamName, teamValue]) => {
    return teamName !== "value" && teamName !== "status" && typeof teamValue !== "object";
  });

  return winner || null;
}

function getDisplayRows(itemValue) {
  if (Array.isArray(itemValue)) {
    return itemValue.map((row) => ({
      team: row?.Team || row?.["Fantasy Team"] || row?.["Team Name"] || "Unknown Team",
      player: row?.Player || row?.["Player Name"] || "",
      value: row?.Fpts ?? row?.Points ?? row?.score ?? row?.value ?? 0,
    }));
  }

  if (!itemValue || typeof itemValue !== "object") {
    return [];
  }

  const placeholderKey = Object.keys(itemValue).find((key) => key === "Winner/Leader TBD");
  if (placeholderKey) {
    return [{ team: placeholderKey, player: "", value: itemValue[placeholderKey] }];
  }

  return Object.entries(itemValue)
    .filter(([key]) => key !== "status" && key !== "value")
    .map(([teamName, teamValue]) => ({ team: teamName, player: "", value: teamValue }));
}

function collectSeasonWinners(value, winners = []) {
  if (!value || typeof value !== "object") {
    return winners;
  }

  if (Array.isArray(value)) {
    const row = value.find((candidate) => candidate && typeof candidate === "object");
    if (row) {
      const teamName = row.Team || row["Fantasy Team"] || row["Team Name"] || "Unknown Team";
      if (teamName !== "Winner/Leader TBD" && teamName !== "Unknown Team") {
        const teamValue = row.Fpts ?? row.Points ?? row.score ?? row.value ?? 0;
        winners.push([teamName, formatValue("", teamValue)]);
      }
    }
    return winners;
  }

  const entries = Object.entries(value);
  for (const [key, item] of entries) {
    if (["lastupdated", "lastupdate", "status", "value"].includes(key)) {
      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    if (Array.isArray(item)) {
      const firstRow = item.find((row) => row && typeof row === "object");
      if (firstRow) {
        const teamName = firstRow.Team || firstRow["Fantasy Team"] || firstRow["Team Name"] || "Unknown Team";
        if (teamName !== "Winner/Leader TBD" && teamName !== "Unknown Team") {
          const teamValue = firstRow.Fpts ?? firstRow.Points ?? firstRow.score ?? firstRow.value ?? 0;
          winners.push([teamName, formatValue("", teamValue)]);
        }
      }
      continue;
    }

    const childEntries = Object.entries(item).filter(([childKey]) => !["lastupdated", "lastupdate", "status", "value"].includes(childKey));
    const allChildrenArePrimitive = childEntries.length > 0 && childEntries.every(([, childValue]) => !childValue || typeof childValue !== "object");

    if (allChildrenArePrimitive) {
      const directWinner = getWinnerFromEntry(item);
      if (directWinner && directWinner[0] !== "Winner/Leader TBD") {
        winners.push(directWinner);
      }
      continue;
    }

    collectSeasonWinners(item, winners);
  }

  return winners;
}

function collectLeaderboardLeaders(seasonData) {
  const teamLeads = new Map();

  Object.entries(seasonData || {}).forEach(([groupKey, groupValue]) => {
    if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) {
      return;
    }

    const groupLabel = groupLabels[groupKey] || groupKey;

    Object.entries(groupValue).forEach(([sectionKey, sectionValue]) => {
      if (!sectionValue || typeof sectionValue !== "object" || Array.isArray(sectionValue)) {
        return;
      }

      const sectionLabel = sectionLabels[sectionKey] || sectionKey;

      Object.entries(sectionValue).forEach(([itemName, itemValue]) => {
        const winner = getWinnerFromEntry(itemValue);
        if (!winner || !winner[0] || winner[0] === "Winner/Leader TBD" || winner[0] === "Unknown Team") {
          return;
        }

        const leadSummary = {
          groupLabel,
          sectionLabel,
          itemName,
          value: winner[1],
        };

        if (!teamLeads.has(winner[0])) {
          teamLeads.set(winner[0], []);
        }

        teamLeads.get(winner[0]).push(leadSummary);
      });
    });
  });

  return teamLeads;
}

function renderLeaderboard(seasonKey) {
  const seasonData = trackerData.season?.[seasonKey] || {};
  const teamLeads = collectLeaderboardLeaders(seasonData);

  const rows = [...teamLeads.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([teamName, leads], index) => {
      const leadCount = leads.length;
      const leadList = leads
        .map((lead) => `
          <li class="leaderboard-item">
            <span class="leaderboard-item-name">${lead.sectionLabel} · ${lead.itemName}</span>
            <span class="leaderboard-item-value">${lead.value}</span>
          </li>
        `)
        .join("");

      return `
        <article class="leaderboard-entry">
          <button class="leaderboard-row" type="button" aria-expanded="false">
            <span class="leaderboard-rank">${index + 1}</span>
            <span class="leaderboard-team-wrap">
              <span class="leaderboard-team">${teamName}</span>
              <span class="leaderboard-team-meta">${leadCount} leading ${leadCount === 1 ? "item" : "items"}</span>
            </span>
            <span class="leaderboard-count">${leadCount}</span>
            <span class="leaderboard-chevron">▾</span>
          </button>
          <div class="leaderboard-details" aria-hidden="true">
            <ul class="leaderboard-details-list">${leadList}</ul>
          </div>
        </article>
      `;
    })
    .join("");

  leaderboard.innerHTML = rows
    ? rows
    : '<div class="empty-state compact">No leaderboard data.</div>';

  activeLeaderboardRow = null;

  leaderboard.querySelectorAll(".leaderboard-entry").forEach((entry) => {
    const toggleButton = entry.querySelector(".leaderboard-row");
    const panel = entry.querySelector(".leaderboard-details");

    toggleButton.addEventListener("click", () => {
      const shouldOpen = !entry.classList.contains("is-open");

      if (activeLeaderboardRow && activeLeaderboardRow !== entry) {
        activeLeaderboardRow.classList.remove("is-open");
        const previousToggle = activeLeaderboardRow.querySelector(".leaderboard-row");
        const previousPanel = activeLeaderboardRow.querySelector(".leaderboard-details");
        previousToggle.setAttribute("aria-expanded", "false");
        previousPanel.setAttribute("aria-hidden", "true");
      }

      entry.classList.toggle("is-open", shouldOpen);
      toggleButton.setAttribute("aria-expanded", String(shouldOpen));
      panel.setAttribute("aria-hidden", String(!shouldOpen));
      activeLeaderboardRow = shouldOpen ? entry : null;
    });
  });
}

const matchupColumns = [
  { key: "Team", label: "Team", type: "string" },
  { key: "FP", label: "FP", type: "number" },
  { key: "FP/G", label: "FP/G", type: "number" },
  { key: "SSN FP/G", label: "SSN", type: "number" },
  { key: "SOG", label: "SOG", type: "number" },
  { key: "SSN SOG", label: "SSN", type: "number" },
  { key: "S%", label: "S%", type: "number" },
  { key: "SSN S%", label: "SSN", type: "number" },
  { key: "SV%", label: "SV%", type: "number" },
  { key: "SSN SV%", label: "SSN", type: "number" },
  { key: "Opponent", label: "Opponent", type: "string" },
  { key: "W/L", label: "W/L", type: "string" },
];

function getMatchupCellValue(row, key) {
  if (!row || typeof row !== "object") {
    return undefined;
  }

  if (key in row) {
    return row[key];
  }

  if (key === "S%") {
    return row["SH%"];
  }
  if (key === "SSN S%") {
    return row["SSN SH%"];
  }

  return undefined;
}

function parseMatchupNumber(label) {
  const match = String(label).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatMatchupCell(column, value) {
  if (column.type === "number") {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
      return "0.00";
    }

    if (column.key === "SOG" || column.key === "SSN SOG") {
      return String(Math.round(numeric));
    }

    return numeric.toFixed(2);
  }
  return String(value ?? "");
}

function getMatchupRows(seasonKey, matchupName) {
  const seasonNode = matchupData.season?.[seasonKey] || {};
  const rows = seasonNode.matchups?.[matchupName];
  return Array.isArray(rows) ? rows : [];
}

function getSeasonSsnLookup(seasonKey, matchupNames) {
  const latestMatchupName = matchupNames[matchupNames.length - 1];
  const latestRows = getMatchupRows(seasonKey, latestMatchupName);
  const lookup = new Map();

  latestRows.forEach((row) => {
    const teamName = String(row?.Team || "").trim();
    if (!teamName) {
      return;
    }

    lookup.set(teamName, {
      "SSN FP/G": row["SSN FP/G"],
      "SSN SOG": row["SSN SOG"],
      "SSN S%": row["SSN S%"] ?? row["SSN SH%"],
      "SSN SH%": row["SSN SH%"] ?? row["SSN S%"],
      "SSN SV%": row["SSN SV%"],
    });
  });

  return lookup;
}

function applySeasonSsnTotals(rows, seasonSsnLookup) {
  return rows.map((row) => {
    const teamName = String(row?.Team || "").trim();
    const seasonTotals = seasonSsnLookup.get(teamName);
    if (!seasonTotals) {
      return row;
    }

    return {
      ...row,
      ...seasonTotals,
    };
  });
}

function sortMatchupRows(rows) {
  const column = matchupColumns.find((entry) => entry.key === matchupSortKey) || matchupColumns[0];
  const direction = matchupSortDirection === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    if (column.type === "number") {
      const leftValue = Number(getMatchupCellValue(left, column.key) || 0);
      const rightValue = Number(getMatchupCellValue(right, column.key) || 0);
      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * direction;
      }
      return String(left?.Team || "").localeCompare(String(right?.Team || ""));
    }

    const leftValue = String(getMatchupCellValue(left, column.key) || "");
    const rightValue = String(getMatchupCellValue(right, column.key) || "");
    const compare = leftValue.localeCompare(rightValue);
    if (compare !== 0) {
      return compare * direction;
    }
    return String(left?.Team || "").localeCompare(String(right?.Team || ""));
  });
}

function renderMatchupBoard(seasonKey) {
  if (!matchupBoard) {
    return;
  }

  clearMatchupScrollRestoreTimers();

  const previousTableWrap = matchupBoard.querySelector(".matchup-table-wrap");
  if (previousTableWrap) {
    matchupTableScrollLeft = previousTableWrap.scrollLeft;
  }

  const seasonNode = matchupData.season?.[seasonKey] || {};
  const matchupMap = seasonNode.matchups || {};
  const matchupNames = Object.keys(matchupMap).sort((a, b) => parseMatchupNumber(a) - parseMatchupNumber(b));

  if (!matchupNames.length) {
    matchupBoard.innerHTML = '<div class="empty-state">No matchup data available.</div>';
    return;
  }

  if (activeMatchupIndex < 0 || activeMatchupIndex >= matchupNames.length) {
    activeMatchupIndex = matchupNames.length - 1;
  }

  const activeMatchupName = matchupNames[activeMatchupIndex];
  const seasonSsnLookup = getSeasonSsnLookup(seasonKey, matchupNames);
  const activeMatchupRows = getMatchupRows(seasonKey, activeMatchupName);
  const sortedRows = sortMatchupRows(applySeasonSsnTotals(activeMatchupRows, seasonSsnLookup));

  const headerCells = matchupColumns
    .map((column) => {
      const isActive = matchupSortKey === column.key;
      const indicator = isActive ? (matchupSortDirection === "asc" ? "↑" : "↓") : "↕";
      return `<th><button class="matchup-sort${isActive ? " is-active" : ""}" data-column="${column.key}" type="button"><span class="matchup-sort-label">${column.label}</span><span class="matchup-sort-indicator">${indicator}</span></button></th>`;
    })
    .join("");

  const bodyRows = sortedRows
    .map((row) => {
      const cells = matchupColumns.map((column) => `<td>${formatMatchupCell(column, getMatchupCellValue(row, column.key))}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  matchupBoard.innerHTML = `
    <section class="matchup-card">
      <div class="matchup-header">
        <p class="eyebrow">Weekly matchups</p>
        <div class="matchup-nav">
          <button class="matchup-nav-btn" data-dir="prev" type="button" ${activeMatchupIndex === 0 ? "disabled" : ""}>◀</button>
          <h3 class="matchup-title">${activeMatchupName}</h3>
          <button class="matchup-nav-btn" data-dir="next" type="button" ${activeMatchupIndex === matchupNames.length - 1 ? "disabled" : ""}>▶</button>
        </div>
      </div>
      <div class="matchup-table-wrap">
        <table class="matchup-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </section>
  `;

  const tableWrap = matchupBoard.querySelector(".matchup-table-wrap");
  if (tableWrap) {
    restoreMatchupTableScroll(tableWrap);
    tableWrap.addEventListener("scroll", () => {
      matchupTableScrollLeft = tableWrap.scrollLeft;
    });
  }

  matchupBoard.querySelectorAll(".matchup-nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.getAttribute("data-dir");
      if (direction === "prev") {
        activeMatchupIndex = Math.max(0, activeMatchupIndex - 1);
      }
      if (direction === "next") {
        activeMatchupIndex = Math.min(matchupNames.length - 1, activeMatchupIndex + 1);
      }
      renderMatchupBoard(seasonKey);
    });
  });

  matchupBoard.querySelectorAll(".matchup-sort").forEach((button) => {
    button.addEventListener("click", () => {
      const activeTableWrap = matchupBoard.querySelector(".matchup-table-wrap");
      if (activeTableWrap) {
        matchupTableScrollLeft = activeTableWrap.scrollLeft;
      }

      const key = button.getAttribute("data-column") || "Team";
      if (matchupSortKey === key) {
        matchupSortDirection = matchupSortDirection === "asc" ? "desc" : "asc";
      } else {
        matchupSortKey = key;
        matchupSortDirection = "asc";
      }
      renderMatchupBoard(seasonKey);
    });
  });
}

function getWinnerFromItem(itemValue) {
  if (!itemValue || typeof itemValue !== "object") {
    return null;
  }

  if (Array.isArray(itemValue)) {
    const row = itemValue.find((candidate) => candidate && typeof candidate === "object");
    if (!row) {
      return null;
    }

    const teamName = row.Team || row["Fantasy Team"] || row["Team Name"] || "Unknown Team";
    if (teamName === "Winner/Leader TBD") {
      return null;
    }

    const teamValue = row.Fpts ?? row.Points ?? row.score ?? row.value ?? 0;
    return [teamName, formatValue("", teamValue)];
  }

  const entries = Object.entries(itemValue).filter(([key]) => key !== "status" && key !== "value");
  if (!entries.length) {
    return null;
  }

  const [teamName, teamValue] = entries[0];
  if (!teamName || teamName === "Winner/Leader TBD") {
    return null;
  }

  if (typeof teamValue === "object") {
    const nestedWinner = getWinnerFromItem(teamValue);
    if (nestedWinner) {
      return nestedWinner;
    }
  }

  return [teamName, formatValue("", teamValue)];
}

function renderCard(itemName, itemValue) {
  const meta = trophyMeta[itemName] || { icon: "🏒", description: "League item" };
  const winner = getWinnerFromEntry(itemValue);
  const summaryText = winner ? `${winner[0]} • ${formatValue(itemName, winner[1])}` : "Pending";

  const card = document.createElement("article");
  card.className = "trophy-card";

  const listEntries = getDisplayRows(itemValue);

  const leadingRow = listEntries[0];
  if (leadingRow && !winner && leadingRow.team === "Winner/Leader TBD") {
    summaryText = "Winner/Leader TBD • " + formatValue(itemName, leadingRow.value);
  }

  card.innerHTML = `
    <button class="trophy-toggle" type="button" aria-expanded="false">
      <div class="trophy-header">
        <div class="trophy-summary-main">
          <div class="summary-title-row">
            <div class="trophy-icon">${meta.icon}</div>
            <div class="trophy-title-block">
              <div class="trophy-name-row">
                <div class="trophy-name">${itemName}</div>
                <span class="trophy-desc">${meta.description}</span>
              </div>
            </div>
            <span class="collapse-indicator">▾</span>
          </div>
          <div class="trophy-current-row">
            <span class="winner-summary">${summaryText}</span>
          </div>
        </div>
      </div>
    </button>

    <div class="trophy-panel" aria-hidden="true">
      <ul class="trophy-list">
        ${listEntries.length
          ? listEntries.map((row, index) => {
              const playerHtml = `<span class="team-player">${row.player || ""}</span>`;
              return `
                <li>
                  <span class="rank">${index + 1}</span>
                  <span class="team-name">${row.team}</span>
                  ${playerHtml}
                  <span class="team-value">${formatValue(itemName, row.value)}</span>
                </li>
              `;
            }).join("")
          : '<li><span class="team-name">Pending</span></li>'}
      </ul>
    </div>
  `;

  const toggleButton = card.querySelector(".trophy-toggle");
  const panel = card.querySelector(".trophy-panel");

  toggleButton.addEventListener("click", () => {
    const shouldOpen = !card.classList.contains("is-open");

    if (activeTrophyCard && activeTrophyCard !== card) {
      activeTrophyCard.classList.remove("is-open");
      const prevToggle = activeTrophyCard.querySelector(".trophy-toggle");
      const prevPanel = activeTrophyCard.querySelector(".trophy-panel");
      prevToggle.setAttribute("aria-expanded", "false");
      prevPanel.setAttribute("aria-hidden", "true");
    }

    card.classList.toggle("is-open", shouldOpen);
    toggleButton.setAttribute("aria-expanded", String(shouldOpen));
    panel.setAttribute("aria-hidden", String(!shouldOpen));
    activeTrophyCard = shouldOpen ? card : null;
  });

  return card;
}

function renderTrophies(seasonKey) {
  const seasonData = trackerData.season?.[seasonKey] || {};
  const seasonGroups = [
    { key: "regseason", label: "Regular Season" },
    { key: "postseason", label: "Playoffs" },
  ];

  if (seasonTitle) {
    seasonTitle.textContent = seasonKey;
  }
  if (lastUpdatedText) {
    const rawUpdated = seasonData.lastupdate || seasonData.lastupdated || "--";
    lastUpdatedText.textContent = rawUpdated && rawUpdated !== "--" ? `${rawUpdated} CET` : "--";
  }
  if (trophyCount) {
    trophyCount.textContent = Object.values(seasonData).reduce((total, group) => total + Object.keys(group || {}).length, 0);
  }
  if (teamCount) {
    teamCount.textContent = new Set(
      collectSeasonWinners(seasonData)
        .filter(([teamName]) => teamName && teamName !== "Winner/Leader TBD" && teamName !== "Unknown Team")
        .map(([teamName]) => teamName)
    ).size;
  }

  activeTrophyCard = null;
  trophyGrid.innerHTML = "";
  renderMatchupBoard(seasonKey);
  renderLeaderboard(seasonKey);

  const hasAnyContent = seasonGroups.some(({ key }) => {
    const bucket = seasonData[key];
    return bucket && typeof bucket === "object" && Object.keys(bucket).length > 0;
  });

  if (!hasAnyContent) {
    trophyGrid.innerHTML = '<div class="empty-state">No trophies available for this season.</div>';
    return;
  }

  seasonGroups.forEach(({ key, label }) => {
    const groupValue = seasonData[key];
    if (!groupValue || typeof groupValue !== "object") {
      return;
    }

    const groupWrap = document.createElement("section");
    groupWrap.className = "season-group";

    const groupHeader = document.createElement("h2");
    groupHeader.className = "season-group-header";
    groupHeader.textContent = label;
    groupWrap.appendChild(groupHeader);

    const orderedSections = ["trophies", "awards", "bounties", "achievements", "winners"];

    orderedSections.forEach((sectionKey) => {
      const sectionValue = groupValue[sectionKey];
      if (!sectionValue || typeof sectionValue !== "object") {
        return;
      }

      const sectionWrap = document.createElement("div");
      sectionWrap.className = "season-section";

      const sectionHeader = document.createElement("h3");
      sectionHeader.className = "section-header";
      sectionHeader.textContent = sectionLabels[sectionKey] || sectionKey;
      sectionWrap.appendChild(sectionHeader);

      Object.entries(sectionValue).forEach(([itemName, itemValue]) => {
        sectionWrap.appendChild(renderCard(itemName, itemValue));
      });

      groupWrap.appendChild(sectionWrap);
    });

    trophyGrid.appendChild(groupWrap);
  });
}

async function loadTrackerData() {
  const [trophyResponse, matchupResponse] = await Promise.all([
    fetch(trophyDataUrl, { cache: "no-store" }),
    fetch(matchupDataUrl, { cache: "no-store" }),
  ]);

  if (!trophyResponse.ok) {
    throw new Error(`Failed to load trophy data (${trophyResponse.status})`);
  }
  if (!matchupResponse.ok) {
    throw new Error(`Failed to load matchup data (${matchupResponse.status})`);
  }

  trackerData = await trophyResponse.json();
  matchupData = await matchupResponse.json();

  const seasonSet = new Set([
    ...Object.keys(trackerData.season || {}),
    ...Object.keys(matchupData.season || {}),
  ]);
  const seasons = [...seasonSet].sort((a, b) => b.localeCompare(a));

  if (!seasons.length) {
    seasonSelect.innerHTML = "<option value=''>No seasons available</option>";
    matchupBoard.innerHTML = '<div class="empty-state">No matchup data was returned from Cloudflare.</div>';
    trophyGrid.innerHTML = '<div class="empty-state">No trophy data was returned from Cloudflare.</div>';
    return;
  }

  seasonSelect.innerHTML = seasons
    .map((seasonKey) => `<option value="${seasonKey}">${seasonKey}</option>`)
    .join("");

  seasonSelect.value = seasons[0];
  renderTrophies(seasons[0]);
}

seasonSelect.addEventListener("change", (event) => {
  activeMatchupIndex = -1;
  renderTrophies(event.target.value);
});

if (tabMatchupBoard) {
  tabMatchupBoard.addEventListener("click", () => setTopBoardTab("matchup"));
}
if (tabSeasonLeaderboard) {
  tabSeasonLeaderboard.addEventListener("click", () => setTopBoardTab("leaderboard"));
}

(async () => {
  try {
    setTopBoardTab(activeTopBoardTab);
    await loadTrackerData();
  } catch (error) {
    trophyGrid.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
})();
