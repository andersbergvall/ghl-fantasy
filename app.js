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
  "Runner Up": { icon: "👟", description: "Shadow runner-up" },
  "True President's Trophy": { icon: "⚖️", description: "Legitimate president" },
  "Fake President's Trophy": { icon: "🕵️", description: "Fraudulent fake winner" },
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
const tabDraftClass = document.getElementById("tabDraftClass");
const tabBingoBoard = document.getElementById("tabBingoBoard");
const matchupPane = document.getElementById("matchupPane");
const leaderboardPane = document.getElementById("leaderboardPane");
const draftClassPane = document.getElementById("draftClassPane");
const bingoBoardPane = document.getElementById("bingoBoardPane");
const draftClassTabSeason = document.getElementById("draftClassTabSeason");

const groupLabels = {
  regseason: "Regular Season",
  postseason: "Playoffs",
  shadowtrackers: "Shadow Trackers",
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
const draftClassDataUrl = window.__GHL_DRAFT_CLASS_DATA_URL__ || "/drafted-player-stats";
const trophyHistoryDataUrl = window.__GHL_TROPHY_DATA_HISTORY_URL__ || "/trophy-data-history";
const matchupHistoryDataUrl = window.__GHL_MATCHUP_DATA_HISTORY_URL__ || "/matchup-data-history";
const draftClassHistoryDataUrl = window.__GHL_DRAFT_CLASS_HISTORY_DATA_URL__ || "/drafted-player-stats-history";
const ownerConfigUrl = window.__GHL_OWNER_CONFIG_URL__ || "archived_years/owner_config.csv";

let trackerData = {};
let matchupData = {};
let draftClassData = {};
let historicalTrackerData = {};
let historicalMatchupData = {};
let historicalDraftClassData = {};
let ownerConfigMap = new Map();
const fallbackOwnerConfigMap = new Map([
  ["barbeque steamers", "ÖGB"],
  ["brussels belgian blues", "TACO"],
  ["multiple scorgasms", "GREVE"],
  ["wan chai oysters", "OYST"],
  ["gävle raiders", "RAID"],
  ["gavle raiders", "RAID"],
  ["warszawa white russians", "WARS"],
  ["tessin bourbons", "WARS"],
  ["taipei 101s", "101S"],
  ["taipei 101's", "101S"],
  ["södermalm hipsters", "ÖGB"],
  ["sodermalm hipsters", "ÖGB"],
  ["bönan bonebreakers", "BBB"],
  ["bonan bonebreakers", "BBB"],
  ["tellus tacos", "TACO"],
  ["frescati frogs", "FROGS"],
  ["mosebacke mooseheads", "ÖGB"],
  ["bangkok ladyboys", "LADY"],
  ["birkastan babysitters", "RUN"],
  ["valhalla valkyries", "VALK"],
  ["tuna tacos", "TACO"],
  ["031 nörrebro", "031N"],
  ["031 norrebro", "031N"],
  ["rinkeby runners", "RUN"],
  ["essingen frogs", "FROGS"],
  ["östermalm golden bananas", "ÖGB"],
  ["ostermalm golden bananas", "ÖGB"],
  ["ömalm golden bananas", "ÖGB"],
  ["omalm golden bananas", "ÖGB"],
  ["västermalm frogs", "FROGS"],
  ["vastermalm frogs", "FROGS"],
  ["hagaström hellraisers", "HELL"],
  ["hagastrom hellraisers", "HELL"],
]);
let activeTrophyCard = null;
let activeLeaderboardRow = null;
let activeMatchupIndex = -1;
let matchupSortKey = "FP";
let matchupSortDirection = "desc";
let draftClassSortKey = "PICK";
let draftClassSortDirection = "asc";
let draftClassPageIndex = 0;
let draftClassRoundFilter = "ALL";
let draftClassPositionFilter = "ALL";
let draftClassFantasyTeamFilter = "ALL";
let draftClassNhlTeamFilter = "ALL";
let activeTopBoardTab = "leaderboard";
let matchupTableScrollLeft = 0;
let draftClassTableScrollLeft = 0;
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
  const isLeaderboard = tabKey === "leaderboard";
  const isDraftClass = tabKey === "draft-class";
  const isBingo = tabKey === "bingo";

  if (tabMatchupBoard) {
    tabMatchupBoard.classList.toggle("is-active", isMatchup);
    tabMatchupBoard.setAttribute("aria-selected", String(isMatchup));
  }
  if (tabSeasonLeaderboard) {
    tabSeasonLeaderboard.classList.toggle("is-active", isLeaderboard);
    tabSeasonLeaderboard.setAttribute("aria-selected", String(isLeaderboard));
  }
  if (tabDraftClass) {
    tabDraftClass.classList.toggle("is-active", isDraftClass);
    tabDraftClass.setAttribute("aria-selected", String(isDraftClass));
  }
  if (tabBingoBoard) {
    tabBingoBoard.classList.toggle("is-active", isBingo);
    tabBingoBoard.setAttribute("aria-selected", String(isBingo));
  }
  if (matchupPane) {
    matchupPane.hidden = !isMatchup;
  }
  if (leaderboardPane) {
    leaderboardPane.hidden = !isLeaderboard;
  }
  if (draftClassPane) {
    draftClassPane.hidden = !isDraftClass;
    if (isDraftClass && !!seasonSelect?.value) {
      renderDraftClassBoard(seasonSelect.value);
    }
  }
  if (bingoBoardPane) {
    bingoBoardPane.hidden = !isBingo;
    if (isBingo) {
      renderBingoBoard();
    }
  }
}

function formatValue(metric, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

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
    const weekLabel = firstRow.Week || firstRow.week || "";
    const value = firstRow.Fpts ?? firstRow.score ?? firstRow.value;
    const detailLabel = playerName || weekLabel;
    const summaryText = detailLabel
      ? (value === null || value === undefined ? detailLabel : `${detailLabel} • ${formatValue("", value)}`)
      : (value === null || value === undefined ? "" : formatValue("", value));
    return [teamName, summaryText];
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
      week: row?.Week || row?.week || "",
      value: row?.Fpts ?? row?.score ?? row?.value ?? null,
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
        const teamValue = row.Fpts ?? row.score ?? row.value ?? null;
        winners.push([teamName, teamValue === null || teamValue === undefined ? "" : formatValue("", teamValue)]);
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
          const teamValue = firstRow.Fpts ?? firstRow.score ?? firstRow.value ?? null;
          winners.push([teamName, teamValue === null || teamValue === undefined ? "" : formatValue("", teamValue)]);
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
  const seasonPayload = getSeasonPayloadForSource("trophy", seasonKey);
  const seasonData = seasonPayload?.season?.[seasonKey] || {};
  const teamLeads = collectLeaderboardLeaders(seasonData);

  const getPinnedBottomOrder = (teamName) => {
    const normalized = String(teamName || "").trim().toLowerCase();
    if (normalized === "carry over") {
      return 1;
    }
    if (normalized === "withheld") {
      return 2;
    }
    return 0;
  };

  const rows = [...teamLeads.entries()]
    .sort((a, b) => {
      const aPinned = getPinnedBottomOrder(a[0]);
      const bPinned = getPinnedBottomOrder(b[0]);

      if (aPinned !== bPinned) {
        if (aPinned === 0) {
          return -1;
        }
        if (bPinned === 0) {
          return 1;
        }
        return aPinned - bPinned;
      }

      return b[1].length - a[1].length || a[0].localeCompare(b[0]);
    })
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
  const matchupSource = getSeasonPayloadForSource("matchup", seasonKey);
  const seasonNode = matchupSource?.season?.[seasonKey] || {};
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

const draftClassColumns = [
  { key: "PICK", label: "PK", type: "number" },
  { key: "ROUND", label: "RD", type: "string" },
  { key: "PLAYER", label: "PLAYER", type: "string" },
  { key: "POS", label: "POS", type: "string" },
  { key: "FP", label: "FP", type: "number" },
  { key: "FP RK", label: "FP RK", type: "string" },
  { key: "FP/G", label: "FP/G", type: "number" },
  { key: "FP/G RK", label: "FP/G RK", type: "string" },
  { key: "ROS", label: "ROS", type: "number" },
  { key: "VABO", label: "VABO", type: "number" },
  { key: "Fantasy Team", label: "FANTASY TEAM", type: "string" },
  { key: "NHLTEAM", label: "NHLTEAM", type: "string" },
];

const draftClassColumnWidths = {
  PICK: 34,
  ROUND: 38,
  PLAYER: 122,
  POS: 46,
  FP: 58,
  "FP RK": 62,
  "FP/G": 64,
  "FP/G RK": 68,
  ROS: 58,
  VABO: 70,
  "Fantasy Team": 108,
  NHLTEAM: 62,
};

function getDraftClassRows(seasonKey) {
  const draftSource = getSeasonPayloadForSource("draft", seasonKey);
  const seasonNode = draftSource?.season?.[seasonKey] || {};
  const rows = seasonNode.players || [];
  return Array.isArray(rows) ? rows : [];
}

function getDraftClassCellValue(row, key) {
  if (!row || typeof row !== "object") {
    return undefined;
  }

  return row[key];
}

function formatDraftClassCell(column, value) {
  if (column.key === "ROS") {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return "0%";
    }
    return `${Math.round(numeric)}%`;
  }

  if (column.type === "number") {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return column.key === "PICK" ? "" : "0.00";
    }
    if (column.key === "PICK") {
      return String(Math.round(numeric));
    }
    if (column.key === "VABO") {
      const formatted = numeric.toFixed(2);
      return numeric > 0 ? `+${formatted}` : formatted;
    }
    return numeric.toFixed(2);
  }

  return value === undefined || value === null ? "" : String(value);
}

function getDraftClassPositionBucket(position) {
  const normalized = String(position || "").trim().toUpperCase();
  if (normalized === "D") {
    return "D";
  }
  if (normalized === "G") {
    return "G";
  }
  return "F";
}

function getDraftClassFilteredRows(seasonKey) {
  const rows = getDraftClassRows(seasonKey);

  return rows.filter((row) => {
    const roundValue = String(row?.ROUND || row?.Round || "").trim();
    const roundMatch = draftClassRoundFilter === "ALL" || roundValue === draftClassRoundFilter;

    const positionValue = String(row?.POS || "").trim().toUpperCase();
    const positionBucket = getDraftClassPositionBucket(positionValue);
    const positionMatch = draftClassPositionFilter === "ALL" || positionBucket === draftClassPositionFilter;

    const fantasyTeamValue = String(row?.["Fantasy Team"] || "").trim();
    const fantasyTeamMatch = draftClassFantasyTeamFilter === "ALL" || fantasyTeamValue === draftClassFantasyTeamFilter;

    const nhlTeamValue = String(row?.NHLTEAM || row?.TEAM || row?.["Team"] || "").trim();
    const nhlTeamMatch = draftClassNhlTeamFilter === "ALL" || nhlTeamValue === draftClassNhlTeamFilter;

    return roundMatch && positionMatch && fantasyTeamMatch && nhlTeamMatch;
  });
}

function getDraftClassSortNumber(value) {
  if (value === null || value === undefined || value === "") {
    return Number.NEGATIVE_INFINITY;
  }

  const text = String(value).trim();
  if (text === "K") {
    return Number.POSITIVE_INFINITY;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : Number.NEGATIVE_INFINITY;
}

function sortDraftClassRows(rows) {
  const column = draftClassColumns.find((entry) => entry.key === draftClassSortKey) || draftClassColumns[0];
  const direction = draftClassSortDirection === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = getDraftClassCellValue(left, column.key);
    const rightValue = getDraftClassCellValue(right, column.key);

    if (column.key === "FP RK" || column.key === "FP/G RK") {
      const leftNumber = getDraftClassSortNumber(leftValue);
      const rightNumber = getDraftClassSortNumber(rightValue);
      if (leftNumber !== rightNumber) {
        return (leftNumber - rightNumber) * direction;
      }
      return String(left?.PLAYER || "").localeCompare(String(right?.PLAYER || ""));
    }

    if (column.type === "number") {
      const leftNumber = Number(leftValue ?? 0);
      const rightNumber = Number(rightValue ?? 0);
      if (leftNumber !== rightNumber) {
        return (leftNumber - rightNumber) * direction;
      }
      return String(left?.PLAYER || "").localeCompare(String(right?.PLAYER || ""));
    }

    const leftText = String(leftValue ?? "");
    const rightText = String(rightValue ?? "");
    if (leftText === rightText) {
      return String(left?.PLAYER || "").localeCompare(String(right?.PLAYER || ""));
    }

    if (leftText === "K") {
      return 1 * direction;
    }
    if (rightText === "K") {
      return -1 * direction;
    }

    return leftText.localeCompare(rightText) * direction;
  });
}

function renderDraftClassBoard(seasonKey) {
  const existingTableWrap = draftClassPane?.querySelector(".draft-class-table-wrap");
  if (existingTableWrap) {
    draftClassTableScrollLeft = existingTableWrap.scrollLeft;
  }

  const draftRows = sortDraftClassRows(getDraftClassFilteredRows(seasonKey));
  const pageSize = 48;
  const totalPages = Math.max(1, Math.ceil(draftRows.length / pageSize));
  if (draftClassPageIndex >= totalPages) {
    draftClassPageIndex = totalPages - 1;
  }
  if (draftClassPageIndex < 0) {
    draftClassPageIndex = 0;
  }

  const startIndex = draftClassPageIndex * pageSize;
  const endIndex = Math.min(startIndex + pageSize, draftRows.length);
  const pageRows = draftRows.slice(startIndex, endIndex);

  const roundOptions = ["ALL", ...Array.from({ length: 21 }, (_, index) => `R${index + 1}`), "K"]
    .map((roundKey) => `<option value="${roundKey}" ${draftClassRoundFilter === roundKey ? "selected" : ""}>${roundKey === "ALL" ? "All" : roundKey}</option>`)
    .join("");

  const positionOptions = ["ALL", "D", "G", "F"]
    .map((positionKey) => `<option value="${positionKey}" ${draftClassPositionFilter === positionKey ? "selected" : ""}>${positionKey === "ALL" ? "All" : positionKey}</option>`)
    .join("");

  const fantasyTeamOptions = ["ALL", ...Array.from(new Set(getDraftClassRows(seasonKey).map((row) => String(row?.["Fantasy Team"] || "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right))]
    .map((teamKey) => `<option value="${teamKey}" ${draftClassFantasyTeamFilter === teamKey ? "selected" : ""}>${teamKey === "ALL" ? "All Teams" : teamKey}</option>`)
    .join("");

  const nhlTeamOptions = ["ALL", ...Array.from(new Set(getDraftClassRows(seasonKey).map((row) => String(row?.NHLTEAM || row?.TEAM || row?.["Team"] || "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right))]
    .map((teamKey) => `<option value="${teamKey}" ${draftClassNhlTeamFilter === teamKey ? "selected" : ""}>${teamKey === "ALL" ? "All NHL Teams" : teamKey}</option>`)
    .join("");

  const headerCells = draftClassColumns
    .map((column) => {
      const isActive = draftClassSortKey === column.key;
      const indicator = isActive ? (draftClassSortDirection === "asc" ? "↑" : "↓") : "↕";
      const columnWidth = draftClassColumnWidths[column.key];
      const widthStyle = columnWidth ? `style="width:${columnWidth}px; min-width:${columnWidth}px;"` : "";
      const highlightHeader = column.key === "PICK" || column.key === "ROUND" ? " table-highlight-header" : "";
      return `<th class="${highlightHeader.trim() || ""}" ${widthStyle}><button class="matchup-sort${isActive ? " is-active" : ""}" data-draft-column="${column.key}" type="button"><span class="matchup-sort-label">${column.label}</span><span class="matchup-sort-indicator">${indicator}</span></button></th>`;
    })
    .join("");

  const bodyRows = pageRows
    .map((row) => {
      const cells = draftClassColumns
        .map((column) => {
          const highlightCell = column.key === "PICK" || column.key === "ROUND" ? " table-highlight" : "";
          return `<td class="${highlightCell.trim() || ""}">${formatDraftClassCell(column, getDraftClassCellValue(row, column.key))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  if (!draftClassPane) {
    return;
  }

  draftClassPane.innerHTML = `
    <section class="draft-class-card">
      <div class="draft-class-header">
        <div class="draft-class-header-title">
          <p class="eyebrow">Draft Class</p>
          <div class="draft-class-meta">${draftRows.length} players</div>
        </div>
        <div class="draft-class-pagination">
          <button class="matchup-nav-btn" data-draft-direction="prev" type="button" ${draftClassPageIndex === 0 ? "disabled" : ""}>◀</button>
          <span class="draft-class-page-label">${draftRows.length ? `${startIndex + 1}–${endIndex}` : "0–0"}</span>
          <button class="matchup-nav-btn" data-draft-direction="next" type="button" ${draftClassPageIndex >= totalPages - 1 ? "disabled" : ""}>▶</button>
        </div>
      </div>

      <div class="draft-class-toolbar">
        <div class="draft-class-filter-group">
          <label class="draft-class-select-wrap">
            <span class="filter-group-label">RD</span>
            <select class="draft-class-select" data-round-filter>
              ${roundOptions}
            </select>
          </label>
        </div>
        <div class="draft-class-filter-group">
          <label class="draft-class-select-wrap">
            <span class="filter-group-label">Position</span>
            <select class="draft-class-select" data-position-filter>
              ${positionOptions}
            </select>
          </label>
        </div>
        <div class="draft-class-filter-group draft-class-team-group">
          <div class="draft-class-team-filter-row">
            <label class="draft-class-select-wrap">
              <span class="filter-group-label">Fantasy Team</span>
              <select class="draft-class-select" data-team-filter>
                ${fantasyTeamOptions}
              </select>
            </label>
            <label class="draft-class-select-wrap">
              <span class="filter-group-label">NHL Team</span>
              <select class="draft-class-select" data-nhlteam-filter>
                ${nhlTeamOptions}
              </select>
            </label>
          </div>
        </div>
      </div>
      <div class="draft-class-vabo-note draft-class-vabo-note--full">VABO = F: Value Above Round Average. D &amp; G: Value Above Average full sample.</div>

      <div class="matchup-table-wrap draft-class-table-wrap">
      </div>

      <div class="matchup-table-wrap draft-class-table-wrap">
        <table class="matchup-table draft-class-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows || '<tr><td colspan="12">No players match the current filters.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;

  const draftClassTableWrap = draftClassPane.querySelector(".draft-class-table-wrap");
  if (draftClassTableWrap) {
    draftClassTableWrap.scrollLeft = draftClassTableScrollLeft;
    draftClassTableWrap.addEventListener("scroll", () => {
      draftClassTableScrollLeft = draftClassTableWrap.scrollLeft;
    });
  }

  draftClassPane.querySelector("[data-round-filter]")?.addEventListener("change", (event) => {
    draftClassRoundFilter = event.target.value || "ALL";
    draftClassPageIndex = 0;
    renderDraftClassBoard(seasonKey);
  });

  draftClassPane.querySelector("[data-position-filter]")?.addEventListener("change", (event) => {
    draftClassPositionFilter = event.target.value || "ALL";
    draftClassPageIndex = 0;
    renderDraftClassBoard(seasonKey);
  });

  draftClassPane.querySelector("[data-team-filter]")?.addEventListener("change", (event) => {
    draftClassFantasyTeamFilter = event.target.value || "ALL";
    draftClassPageIndex = 0;
    renderDraftClassBoard(seasonKey);
  });

  draftClassPane.querySelector("[data-nhlteam-filter]")?.addEventListener("change", (event) => {
    draftClassNhlTeamFilter = event.target.value || "ALL";
    draftClassPageIndex = 0;
    renderDraftClassBoard(seasonKey);
  });

  draftClassPane.querySelectorAll(".matchup-nav-btn[data-draft-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.getAttribute("data-draft-direction");
      if (direction === "prev") {
        draftClassPageIndex = Math.max(0, draftClassPageIndex - 1);
      } else if (direction === "next") {
        draftClassPageIndex = Math.min(totalPages - 1, draftClassPageIndex + 1);
      }
      renderDraftClassBoard(seasonKey);
    });
  });

  draftClassPane.querySelectorAll(".matchup-sort[data-draft-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-draft-column") || "PICK";
      if (draftClassSortKey === key) {
        draftClassSortDirection = draftClassSortDirection === "asc" ? "desc" : "asc";
      } else {
        draftClassSortKey = key;
        if (key === "PICK") {
          draftClassSortDirection = "asc";
        } else if (key === "FP") {
          draftClassSortDirection = "desc";
        } else {
          draftClassSortDirection = "asc";
        }
      }
      draftClassPageIndex = 0;
      renderDraftClassBoard(seasonKey);
    });
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

  const matchupSource = getSeasonPayloadForSource("matchup", seasonKey);
  const seasonNode = matchupSource?.season?.[seasonKey] || {};
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
      const highlightHeader = column.key === "FP" || column.key === "FP/G" ? " table-highlight-header" : "";
      return `<th class="${highlightHeader.trim() || ""}"><button class="matchup-sort${isActive ? " is-active" : ""}" data-column="${column.key}" type="button"><span class="matchup-sort-label">${column.label}</span><span class="matchup-sort-indicator">${indicator}</span></button></th>`;
    })
    .join("");

  const bodyRows = sortedRows
    .map((row) => {
      const cells = matchupColumns
        .map((column) => {
          const highlightCell = column.key === "FP" || column.key === "FP/G" ? " table-highlight" : "";
          return `<td class="${highlightCell.trim() || ""}">${formatMatchupCell(column, getMatchupCellValue(row, column.key))}</td>`;
        })
        .join("");
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

    const teamValue = row.Fpts ?? row.score ?? row.value ?? null;
    return [teamName, teamValue === null || teamValue === undefined ? "" : formatValue("", teamValue)];
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
  let summaryText = winner ? (winner[1] ? `${winner[0]} • ${winner[1]}` : winner[0]) : "Pending";

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
              const detailLabel = row.player || row.week || "";
              const playerHtml = detailLabel ? `<span class="team-player">${detailLabel}</span>` : "";
              const valueHtml = row.value === null || row.value === undefined ? "" : `<span class="team-value">${formatValue(itemName, row.value)}</span>`;
              return `
                <li>
                  <span class="rank">${index + 1}</span>
                  <span class="team-name">${row.team}</span>
                  ${playerHtml}
                  ${valueHtml}
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

function normalizeOwnerKey(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s&'’.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseOwnerConfigCsv(csvText) {
  const lines = String(csvText || "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return new Map();
  }

  const entries = new Map();
  lines.slice(1).forEach((line) => {
    const columns = line.split(";").map((value) => value.trim());
    if (columns.length < 2) {
      return;
    }

    const gmName = columns[0];
    const teamName = columns[1];
    if (!gmName || !teamName) {
      return;
    }

    entries.set(normalizeOwnerKey(teamName), gmName);
  });

  return entries;
}

function getOwnerConfigUrlCandidates() {
  const candidates = new Set();
  candidates.add(ownerConfigUrl);
  candidates.add("archived_years/owner_config.csv");
  candidates.add("/archived_years/owner_config.csv");

  try {
    const dataUrl = new URL(trophyDataUrl, window.location.href);
    const versionMatch = String(ownerConfigUrl).match(/[?&]v=([^&]+)/);
    const version = versionMatch ? `?v=${encodeURIComponent(versionMatch[1])}` : "";
    candidates.add(`${dataUrl.origin}/archived_years/owner_config.csv${version}`);
  } catch (error) {
    // Ignore malformed URLs and proceed with local candidates.
  }

  return Array.from(candidates);
}

async function loadOwnerConfig() {
  try {
    const urlCandidates = getOwnerConfigUrlCandidates();
    for (const url of urlCandidates) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      const entries = parseOwnerConfigCsv(text);
      if (entries.size > 0) {
        ownerConfigMap = entries;
        return;
      }
    }

    ownerConfigMap = new Map(fallbackOwnerConfigMap);
  } catch (error) {
    ownerConfigMap = new Map(fallbackOwnerConfigMap);
  }
}

function getOwnerForTeam(teamName) {
  if (!teamName) {
    return "Unknown";
  }

  const rawText = String(teamName).trim();
  const normalized = normalizeOwnerKey(rawText);
  const directOwner = ownerConfigMap.get(normalized);
  if (directOwner) {
    return directOwner;
  }

  const normalizedNoSpaces = normalized.replace(/\s+/g, "");
  for (const [mapKey, gmName] of ownerConfigMap.entries()) {
    if (mapKey === normalized || mapKey.replace(/\s+/g, "") === normalizedNoSpaces) {
      return gmName;
    }
  }

  const aliasVariants = [
    normalized.replace(/golden|bananas/gi, ""),
    normalized.replace(/gold/gi, ""),
    normalized.replace(/bananas/gi, ""),
    normalized.replace(/[^a-z0-9]/gi, ""),
    normalized.replace(/\s+/g, ""),
    rawText.toLowerCase().replace(/[^a-z0-9]/gi, ""),
  ];

  for (const variant of aliasVariants) {
    for (const [mapKey, gmName] of ownerConfigMap.entries()) {
      const aliasKey = mapKey.replace(/[^a-z0-9]/gi, "");
      if (aliasKey === variant.replace(/[^a-z0-9]/gi, "")) {
        return gmName;
      }
    }
  }

  const fallbackOwner = fallbackOwnerConfigMap.get(normalized)
    || fallbackOwnerConfigMap.get(normalizedNoSpaces)
    || fallbackOwnerConfigMap.get(rawText.toLowerCase());
  if (fallbackOwner) {
    return fallbackOwner;
  }

  return rawText || "Unknown";
}

function getBingoSeasonSections() {
  return [
    ["regseason", "trophies"],
    ["regseason", "awards"],
    ["regseason", "bounties"],
    ["postseason", "winners"],
    ["postseason", "awards"],
    ["postseason", "bounties"],
    ["postseason", "achievements"],
    ["shadowtrackers", null],
  ];
}

const bingoBoardPrimaryLayout = [
  "Stanley Cup",
  "President's Trophy",
  "Clarence S. Campbell",
  "Prince of Wales",
  "Hart",
  "Conn Smythe",
  "Art Ross",
  "Rocket Richard",
  "Norris",
  "Vezina",
  "Calder",
  "Lady Byng",
  "Selke",
  "Jack Adams",
  "Jim Gregory",
  "Back's Backe Back-2-Back",
  "It's Vegas Baby!",
  "Scout's Honor",
  "Fantalytic's Frenzy",
  "The King is Dead!",
  "Chasing the Cup!",
  "Bitter Looser or Righteous Winner!",
  "Orange Lantern",
];

const bingoBoardShadowRows = [
  "Runner Up",
  "True President's Trophy",
  "Fake President's Trophy",
];

function normalizeBingoItemName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function shouldHideBingoOwnerColumn(ownerName) {
  const normalized = normalizeBingoItemName(ownerName);
  return normalized === "withheld" || normalized === "carry over";
}

const bingoLayoutByNormalizedKey = new Map(
  [...bingoBoardPrimaryLayout, ...bingoBoardShadowRows].map((itemName) => [normalizeBingoItemName(itemName), itemName])
);

function getLeaderboardRankValue(rawValue) {
  if (typeof rawValue === "number") {
    return rawValue;
  }

  if (typeof rawValue !== "string") {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Number(rawValue.replace(/[^0-9.-]/g, ""));
  if (!Number.isNaN(parsed) && String(rawValue).includes(":")) {
    return parsed;
  }
  if (!Number.isNaN(parsed) && String(rawValue).includes("-")) {
    const parts = rawValue.split("-").map((part) => Number(part.trim().replace(/[^0-9.-]/g, ""))).filter((part) => !Number.isNaN(part));
    if (parts.length >= 3 && parts[0] !== undefined) {
      return parts[0] * 1000 - parts[1] * 10 + parts[2];
    }
  }

  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return Number.NEGATIVE_INFINITY;
}

function isLowestWinsAward(itemName) {
  return String(itemName || "").trim().toLowerCase().includes("lady byng");
}

function getBingoWinnerOwners(itemValue, seasonKey, itemName = "") {
  if (!itemValue) {
    return [];
  }

  const teamNames = [];

  if (Array.isArray(itemValue)) {
    const firstEntry = itemValue.find((entry) => entry && typeof entry === "object");
    if (!firstEntry) {
      return [];
    }

    const teamName = firstEntry.Team || firstEntry["Fantasy Team"] || firstEntry["Team Name"] || "";
    if (teamName && teamName !== "Winner/Leader TBD") {
      teamNames.push(String(teamName).trim());
    }

    return Array.from(new Set(teamNames.map((name) => getOwnerForTeam(name)).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right));
  }

  if (typeof itemValue === "object") {
    const leaderboardEntries = Object.entries(itemValue)
      .filter(([key]) => key !== "status" && key !== "value" && key !== "Winner/Leader TBD")
      .map(([teamName, teamValue]) => ({ teamName, teamValue }))
      .filter(({ teamName }) => teamName);

    if (leaderboardEntries.length > 0) {
      const topEntry = leaderboardEntries.reduce((best, current) => {
        const currentScore = getLeaderboardRankValue(current.teamValue);
        const bestScore = getLeaderboardRankValue(best.teamValue);
        const isLowestWins = isLowestWinsAward(itemName);
        const shouldReplace = isLowestWins ? currentScore < bestScore : currentScore > bestScore;
        if (shouldReplace) {
          return current;
        }
        return best;
      }, leaderboardEntries[0]);

      const topOwner = getOwnerForTeam(topEntry.teamName);
      return topOwner ? [topOwner] : [];
    }
  }

  return [];
}

function getSeasonPayloadForSource(sourceKey, seasonKey) {
  const sourceMap = {
    trophy: { active: trackerData, history: historicalTrackerData },
    matchup: { active: matchupData, history: historicalMatchupData },
    draft: { active: draftClassData, history: historicalDraftClassData },
  };

  const targetSource = sourceMap[sourceKey] || { active: {}, history: {} };
  const activeSeasonMap = targetSource.active?.season || {};
  const historySeasonMap = targetSource.history?.season || {};

  if (seasonKey && Object.prototype.hasOwnProperty.call(activeSeasonMap, seasonKey)) {
    return targetSource.active;
  }
  if (seasonKey && Object.prototype.hasOwnProperty.call(historySeasonMap, seasonKey)) {
    return targetSource.history;
  }

  return targetSource.active || targetSource.history || {};
}

function buildBingoBoardData() {
  const seasonMap = {
    ...(historicalTrackerData.season || {}),
    ...(trackerData.season || {}),
  };
  const counts = new Map();
  const currentSeasonCounts = new Set();
  const rowOrder = [];
  const gmSet = new Set();

  const seasonKeys = Object.keys(seasonMap).sort((left, right) => right.localeCompare(left));
  const latestSeasonKey = seasonKeys[0] || "2026-2027";

  const orderedSections = getBingoSeasonSections();
  Object.keys(seasonMap).forEach((seasonKey) => {
    const seasonData = seasonMap[seasonKey] || {};
    orderedSections.forEach(([groupKey, sectionKey]) => {
      const container = sectionKey ? (seasonData[groupKey] || {})[sectionKey] : (seasonData[groupKey] || {});
      if (!container || typeof container !== "object") {
        return;
      }

      Object.entries(container).forEach(([itemName, itemValue]) => {
        const normalizedItemKey = normalizeBingoItemName(itemName);
        const displayItemName = bingoLayoutByNormalizedKey.get(normalizedItemKey) || itemName;

        if (!rowOrder.includes(displayItemName)) {
          rowOrder.push(displayItemName);
        }

        const owners = getBingoWinnerOwners(itemValue, seasonKey, itemName);
        owners.forEach((ownerName) => {
          gmSet.add(ownerName);
          const totalKey = `${displayItemName}::${ownerName}`;
          const nextValue = (counts.get(totalKey) || 0) + 1;
          counts.set(totalKey, nextValue);

          if (seasonKey === latestSeasonKey) {
            currentSeasonCounts.add(totalKey);
          }
        });
      });
    });
  });

  const rowOrderSet = new Set(rowOrder);
  const primaryRows = [
    ...bingoBoardPrimaryLayout.filter((itemName) => rowOrderSet.has(itemName)),
    ...rowOrder.filter((itemName) => !bingoBoardPrimaryLayout.includes(itemName) && !bingoBoardShadowRows.includes(itemName)),
  ];
  const shadowRows = bingoBoardShadowRows.filter((itemName) => rowOrderSet.has(itemName));

  const getOwnerCountForItem = (ownerName, itemName) => counts.get(`${itemName}::${ownerName}`) || 0;
  const getOwnerUniquePrimaryCount = (ownerName) => {
    let uniqueCount = 0;
    bingoBoardPrimaryLayout.forEach((itemName) => {
      if (getOwnerCountForItem(ownerName, itemName) > 0) {
        uniqueCount += 1;
      }
    });
    return uniqueCount;
  };

  const gmColumns = Array.from(gmSet)
    .filter((ownerName) => !shouldHideBingoOwnerColumn(ownerName))
    .sort((left, right) => {
    const stanleyDiff = getOwnerCountForItem(right, "Stanley Cup") - getOwnerCountForItem(left, "Stanley Cup");
    if (stanleyDiff !== 0) {
      return stanleyDiff;
    }

    const uniqueDiff = getOwnerUniquePrimaryCount(right) - getOwnerUniquePrimaryCount(left);
    if (uniqueDiff !== 0) {
      return uniqueDiff;
    }

    return left.localeCompare(right);
  });
  return { primaryRows, shadowRows, gmColumns, counts, currentSeasonCounts };
}

function renderBingoBoard() {
  if (!bingoBoardPane) {
    return;
  }

  const { primaryRows, shadowRows, gmColumns, counts, currentSeasonCounts } = buildBingoBoardData();

  const rowOrder = [...primaryRows, ...shadowRows];

  if (!rowOrder.length || !gmColumns.length) {
    bingoBoardPane.innerHTML = '<div class="empty-state">No award history available for the Bingo Board.</div>';
    return;
  }

  const headerCells = [
    '<th class="bingo-grid-header bingo-grid-corner" aria-label="Award title"></th>',
    ...gmColumns.map((gm) => {
      const width = Math.max(18, Math.min(38, gm.length * 5.6 + 8));
      return `<th class="bingo-grid-header" style="--gm-col-width:${width}px; width:${width}px; min-width:${width}px; max-width:${width}px;"><span>${gm}</span></th>`;
    }),
  ].join("");

  const renderDataRow = (itemName) => {
    const cells = gmColumns.map((gm) => {
      const totalKey = `${itemName}::${gm}`;
      const count = counts.get(totalKey) || 0;
      const isCurrentSeasonWinner = currentSeasonCounts.has(totalKey);
      if (!count) {
        return '<td class="bingo-grid-cell bingo-grid-empty"></td>';
      }
      const cellClass = isCurrentSeasonWinner ? "bingo-grid-won-current" : "bingo-grid-won";
      return `<td class="bingo-grid-cell ${cellClass}" title="${gm}: ${count} win${count === 1 ? "" : "s"}"><span class="bingo-count-pill">${count}</span></td>`;
    });

    return `<tr><th class="bingo-row-label">${itemName}</th>${cells.join("")}</tr>`;
  };

  const primaryRowsHtml = primaryRows.map((itemName) => renderDataRow(itemName)).join("");
  const shadowRowsHtml = shadowRows.map((itemName) => renderDataRow(itemName)).join("");
  const breakRowHtml = shadowRows.length
    ? `<tr class="bingo-row-break"><th class="bingo-row-break-label" colspan="${gmColumns.length + 1}"></th></tr>`
    : "";
  const bodyRows = `${primaryRowsHtml}${breakRowHtml}${shadowRowsHtml}`;

  bingoBoardPane.innerHTML = `
    <section class="bingo-board-card">
      <div class="bingo-board-header">
        <div>
          <p class="eyebrow">Bingo Board</p>
          <h3 class="section-header">All-time GM title history</h3>
        </div>
      </div>
      <div class="bingo-board-wrap">
        <table class="bingo-board-table">
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTrophies(seasonKey) {
  const seasonPayload = getSeasonPayloadForSource("trophy", seasonKey);
  const seasonData = seasonPayload?.season?.[seasonKey] || {};
  const seasonGroups = [
    { key: "regseason", label: "Regular Season" },
    { key: "postseason", label: "Playoffs" },
    { key: "shadowtrackers", label: "Shadow Trackers" },
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
  if (draftClassTabSeason) {
    draftClassTabSeason.textContent = "";
  }
  renderMatchupBoard(seasonKey);
  renderLeaderboard(seasonKey);
  if (draftClassPane) {
    renderDraftClassBoard(seasonKey);
  }
  renderBingoBoard();

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

    if (key === "shadowtrackers") {
      Object.entries(groupValue).forEach(([itemName, itemValue]) => {
        groupWrap.appendChild(renderCard(itemName, itemValue));
      });
      trophyGrid.appendChild(groupWrap);
      return;
    }

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
  const [trophyResponse, matchupResponse, draftClassResponse, historyTrophyResponse, historyMatchupResponse, historyDraftClassResponse] = await Promise.all([
    fetch(trophyDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(matchupDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(draftClassDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(trophyHistoryDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(matchupHistoryDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(draftClassHistoryDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
  ]);

  if (!trophyResponse.ok) {
    throw new Error(`Failed to load trophy data (${trophyResponse.status})`);
  }
  if (!matchupResponse.ok) {
    throw new Error(`Failed to load matchup data (${matchupResponse.status})`);
  }

  trackerData = trophyResponse.ok ? await trophyResponse.json() : { season: {} };
  matchupData = matchupResponse.ok ? await matchupResponse.json() : { season: {} };
  draftClassData = draftClassResponse.ok ? await draftClassResponse.json() : { season: {} };
  historicalTrackerData = historyTrophyResponse.ok ? await historyTrophyResponse.json() : { season: {} };
  historicalMatchupData = historyMatchupResponse.ok ? await historyMatchupResponse.json() : { season: {} };
  historicalDraftClassData = historyDraftClassResponse.ok ? await historyDraftClassResponse.json() : { season: {} };
  await loadOwnerConfig();

  const seasonSet = new Set([
    ...Object.keys(trackerData.season || {}),
    ...Object.keys(matchupData.season || {}),
    ...Object.keys(draftClassData.season || {}),
    ...Object.keys(historicalTrackerData.season || {}),
    ...Object.keys(historicalMatchupData.season || {}),
    ...Object.keys(historicalDraftClassData.season || {}),
  ]);
  const seasons = [...seasonSet].sort((a, b) => b.localeCompare(a));

  if (!seasons.length) {
    seasonSelect.innerHTML = "<option value=''>No seasons available</option>";
    matchupBoard.innerHTML = '<div class="empty-state">No matchup data was returned from Cloudflare.</div>';
    trophyGrid.innerHTML = '<div class="empty-state">No trophy data was returned from Cloudflare.</div>';
    return;
  }

  const preferredSeason = seasons.includes("2026-2027") ? "2026-2027" : seasons[0];

  seasonSelect.innerHTML = seasons
    .map((seasonKey) => `<option value="${seasonKey}">${seasonKey}</option>`)
    .join("");

  seasonSelect.value = preferredSeason;
  renderBingoBoard();
  renderTrophies(preferredSeason);
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
if (tabDraftClass) {
  tabDraftClass.addEventListener("click", () => setTopBoardTab("draft-class"));
}
if (tabBingoBoard) {
  tabBingoBoard.addEventListener("click", () => setTopBoardTab("bingo"));
}

(async () => {
  try {
    setTopBoardTab(activeTopBoardTab);
    await loadTrackerData();
  } catch (error) {
    trophyGrid.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
})();
