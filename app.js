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
  "It's Vegas Baby!": { icon: "🎲", description: "Special bounty" },
  "Back's Backe Back-2-Back": { icon: "🔁", description: "Half-time leader" },
  "The King is Dead!": { icon: "👑", description: "Take out the President" },
  "Chasing the Cup!": { icon: "🏒", description: "Beat last year's Stanley Cup winner" },
  "Bitter Looser or Righteous Winner!": { icon: "🔥", description: "High stakes" },
  "Clarence S. Campbell": { icon: "🏟️", description: "Conference champion" },
  "Prince of Wales": { icon: "🛡️", description: "Conference champion" },
  "Orange Lantern": { icon: "🟠", description: "Looser of the looser bracket" },
};

const seasonSelect = document.getElementById("seasonSelect");
const seasonTitle = document.getElementById("seasonTitle");
const trophyCount = document.getElementById("trophyCount");
const teamCount = document.getElementById("teamCount");
const lastUpdatedText = document.getElementById("lastUpdatedText");
const trophyGrid = document.getElementById("trophyGrid");
const leaderboard = document.getElementById("leaderboard");

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

let trackerData = {};
let activeTrophyCard = null;

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

function renderLeaderboard(seasonKey) {
  const seasonData = trackerData.season?.[seasonKey] || {};
  const counts = new Map();

  collectSeasonWinners(seasonData)
    .filter(([teamName]) => teamName && teamName !== "Winner/Leader TBD" && teamName !== "Unknown Team")
    .forEach(([teamName]) => {
      counts.set(teamName, (counts.get(teamName) || 0) + 1);
    });

  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([teamName, count], index) => `
      <div class="leaderboard-row">
        <span class="leaderboard-rank">${index + 1}</span>
        <span class="leaderboard-team">${teamName}</span>
        <span class="leaderboard-count">${count}</span>
      </div>
    `)
    .join("");

  leaderboard.innerHTML = rows
    ? rows
    : '<div class="empty-state compact">No leaderboard data.</div>';
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
              const hasPlayer = Boolean(row.player);
              const playerHtml = hasPlayer ? `<span class="team-player">${row.player}</span>` : "";
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

  seasonTitle.textContent = seasonKey;
  if (lastUpdatedText) {
    lastUpdatedText.textContent = seasonData.lastupdate || seasonData.lastupdated || "--";
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
  const binId = "6abfac4bac6210605a0c5190";
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    headers: {
      "X-Bin-Meta": "false",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load tracker data (${response.status})`);
  }

  const payload = await response.json();
  trackerData = payload.record || payload;
  const seasons = Object.keys(trackerData.season || {});

  if (!seasons.length) {
    seasonSelect.innerHTML = "<option value=''>No seasons available</option>";
    trophyGrid.innerHTML = '<div class="empty-state">No season data was returned from the bin.</div>';
    return;
  }

  seasonSelect.innerHTML = seasons
    .map((seasonKey) => `<option value="${seasonKey}">${seasonKey}</option>`)
    .join("");

  seasonSelect.value = seasons[0];
  renderTrophies(seasons[0]);
}

seasonSelect.addEventListener("change", (event) => {
  renderTrophies(event.target.value);
});

(async () => {
  try {
    await loadTrackerData();
  } catch (error) {
    trophyGrid.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
})();
