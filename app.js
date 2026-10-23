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
const trophyCount = document.getElementById("trophyCount");
const teamCount = document.getElementById("teamCount");
const lastUpdatedText = document.getElementById("lastUpdatedText");
const seasonSelectShell = document.querySelector(".season-select-shell");
const seasonSelectArrow = document.querySelector(".season-select-arrow");
const matchupBoard = document.getElementById("matchupBoard");
const trophyGrid = document.getElementById("trophyGrid");
const leaderboard = document.getElementById("leaderboard");
const tabMatchupBoard = document.getElementById("tabMatchupBoard");
const tabSeasonLeaderboard = document.getElementById("tabSeasonLeaderboard");
const tabDraftClass = document.getElementById("tabDraftClass");
const tabFaSnipes = document.getElementById("tabFaSnipes");
const tabBingoBoard = document.getElementById("tabBingoBoard");
const tabTombolaBoard = document.getElementById("tabTombolaBoard");
const matchupPane = document.getElementById("matchupPane");
const leaderboardPane = document.getElementById("leaderboardPane");
const draftClassPane = document.getElementById("draftClassPane");
const faSnipesPane = document.getElementById("faSnipesPane");
const bingoBoardPane = document.getElementById("bingoBoardPane");
const tombolaPane = document.getElementById("tombolaPane");
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
const faPlayerStatsDataUrl = window.__GHL_FA_PLAYER_STATS_DATA_URL__ || "/fa-player-stats";
const rostersDataUrl = window.__GHL_ROSTERS_DATA_URL__ || "/rosters";
const trophyHistoryDataUrl = window.__GHL_TROPHY_DATA_HISTORY_URL__ || "/trophy-data-history";
const matchupHistoryDataUrl = window.__GHL_MATCHUP_DATA_HISTORY_URL__ || "/matchup-data-history";
const draftClassHistoryDataUrl = window.__GHL_DRAFT_CLASS_HISTORY_DATA_URL__ || "/drafted-player-stats-history";
const rostersHistoryDataUrl = String(window.__GHL_ROSTERS_DATA_HISTORY_URL__ || "").trim();
const ownerConfigUrl = window.__GHL_OWNER_CONFIG_URL__ || "config/owner_config.csv";
const logoConfigUrl = window.__GHL_LOGO_CONFIG_URL__ || "config/logo_config.csv";

let trackerData = {};
let matchupData = {};
let draftClassData = {};
let faPlayerStatsData = {};
let rostersData = {};
let historicalTrackerData = {};
let historicalMatchupData = {};
let historicalDraftClassData = {};
let historicalFaPlayerStatsData = {};
let historicalRostersData = {};
let ownerConfigMap = new Map();
let teamLogoConfigMap = new Map();
const fallbackTeamLogoConfigMap = new Map([
  ["bangkok ladyboys", "https://fantraximg.com/logos/v8q/tmLogo_v8qhbh89k0v0wspm_128.jpg"],
  ["bonan bonebreakers", "https://fantraximg.com/logos/zmk/tmLogo_zmks50rqmuzvzghv_128.webp"],
  ["gavle raiders", "https://fantraximg.com/logos/ylw/tmLogo_ylwfh32bl8vr97jm_128.jpg"],
  ["hagastrom hellraisers", "https://fantraximg.com/logos/eta/tmLogo_eta0noi5l8vpw7nz_128.jpg"],
  ["rinkeby runners", "https://fantraximg.com/logos/gda/tmLogo_gda3cbcxkmjnp4w2_128.jpg"],
  ["taipei 101's", "https://fantraximg.com/logos/vuw/tmLogo_vuwpztv7mgqxf48f_128.webp"],
  ["taipei 101s", "https://fantraximg.com/logos/vuw/tmLogo_vuwpztv7mgqxf48f_128.webp"],
  ["tessin bourbons", "https://fantraximg.com/logos/0km/tmLogo_0kmgqgikmgc8mips_128.webp"],
  ["tuna tacos", "https://fantraximg.com/logos/300/tmLogo_300hp7jwk0vfhi51_128.jpg"],
  ["valhalla valkyries", "https://fantraximg.com/logos/1zl/tmLogo_1zlsvqy1muzw1wit_128.webp"],
  ["vastermalm frogs", "https://fantraximg.com/logos/p5s/tmLogo_p5s9mklymgcaf8ob_128.webp"],
  ["wan chai oysters", "https://fantraximg.com/logos/2xz/tmLogo_2xzxrasemgcalrpp_128.webp"],
  ["omalm golden bananas", "https://fantraximg.com/logos/0el/tmLogo_0elr7dv8mgcbb3cy_128.webp"],
  ["ostermalm golden bananas", "https://fantraximg.com/logos/0el/tmLogo_0elr7dv8mgcbb3cy_128.webp"],
]);
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
let draftClassRoundFilter = new Set();
let draftClassPositionFilter = new Set();
let draftClassFantasyTeamFilter = new Set();
let draftClassNhlTeamFilter = new Set();
let faSnipesSortKey = "FP";
let faSnipesSortDirection = "desc";
let faSnipesPageIndex = 0;
let faSnipesFantasyTeamFilter = new Set();
let faSnipesOpenMultiFilter = null;
let activeTopBoardTab = "leaderboard";
let matchupTableScrollLeft = 0;
let draftClassTableScrollLeft = 0;
let faSnipesTableScrollLeft = 0;
let matchupScrollRestoreTimers = [];
let draftOpenMultiFilter = null;
let draftOutsideClickHandlerBound = false;
let faSnipesOutsideClickHandlerBound = false;
let leaderboardLogoOverlay = null;
let leaderboardLogoOverlayImage = null;
let tombolaFromTeamFilter = "";
let tombolaToTeamFilter = "";
let tombolaFromPlayerFilterIds = new Set();
let tombolaFromPlayerFilterOpen = false;
let tombolaToPlayerFilterIds = new Set();
let tombolaToPlayerFilterOpen = false;
let tombolaLastSuggestion = null;
let tombolaLastSuggestionSignature = "";
let tombolaDrawCursorByKey = new Map();
let tombolaLastEngineMessage = "";
let tombolaLastSeason = "";
let tombolaTradeMode = "fair";
let tombolaTradeStructure = "";
let tombolaExcludeGoalies = false;
let tombolaSendPosFilter = "";
let tombolaGetPosFilter = "";
let tombolaGetPosPlusOne = false;
let tombolaOutsideClickHandlerBound = false;
const lineupTargets = { F: 12, D: 4, G: 2 };
const TOMBOLA_EXHAUSTED_MESSAGE = "All unique suggestions for this exact setup have been shown. Change a filter or team, then draw again.";

function getTombolaStructureLimits(structure) {
  if (structure === "1:1") {
    return { outgoing: 1, incoming: 1 };
  }
  if (structure === "1:2") {
    return { outgoing: 1, incoming: 2 };
  }
  if (structure === "2:1") {
    return { outgoing: 2, incoming: 1 };
  }
  return null;
}

function ensureLeaderboardLogoOverlay() {
  if (leaderboardLogoOverlay && leaderboardLogoOverlayImage) {
    return;
  }

  leaderboardLogoOverlay = document.createElement("div");
  leaderboardLogoOverlay.className = "leaderboard-logo-overlay";
  leaderboardLogoOverlay.setAttribute("aria-hidden", "true");
  leaderboardLogoOverlay.innerHTML = `
    <div class="leaderboard-logo-overlay-surface" role="dialog" aria-modal="true" aria-label="Team logo preview">
      <img class="leaderboard-logo-overlay-image" src="" alt="" />
    </div>
  `;

  document.body.appendChild(leaderboardLogoOverlay);
  leaderboardLogoOverlayImage = leaderboardLogoOverlay.querySelector(".leaderboard-logo-overlay-image");

  leaderboardLogoOverlay.addEventListener("click", (event) => {
    if (event.target === leaderboardLogoOverlay) {
      closeLeaderboardLogoOverlay();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && leaderboardLogoOverlay?.classList.contains("is-open")) {
      closeLeaderboardLogoOverlay();
    }
  });
}

function openLeaderboardLogoOverlay(logoUrl, teamName) {
  if (!logoUrl) {
    return;
  }

  ensureLeaderboardLogoOverlay();
  if (!leaderboardLogoOverlay || !leaderboardLogoOverlayImage) {
    return;
  }

  leaderboardLogoOverlayImage.src = logoUrl;
  leaderboardLogoOverlayImage.alt = `${teamName || "Team"} logo`;
  leaderboardLogoOverlay.classList.add("is-open");
  leaderboardLogoOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-logo-overlay-open");
}

function closeLeaderboardLogoOverlay() {
  if (!leaderboardLogoOverlay || !leaderboardLogoOverlayImage) {
    return;
  }

  leaderboardLogoOverlay.classList.remove("is-open");
  leaderboardLogoOverlay.setAttribute("aria-hidden", "true");
  leaderboardLogoOverlayImage.src = "";
  leaderboardLogoOverlayImage.alt = "";
  document.body.classList.remove("is-logo-overlay-open");
}

function openSeasonSelectMenu() {
  if (!seasonSelect) {
    return;
  }

  seasonSelect.focus({ preventScroll: true });

  if (typeof seasonSelect.showPicker === "function") {
    try {
      seasonSelect.showPicker();
      return;
    } catch (error) {
      // Fall back to click for browsers that block showPicker.
    }
  }

  seasonSelect.click();
}

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
  const isFaSnipes = tabKey === "fa-snipes";
  const isBingo = tabKey === "bingo";
  const isTombola = tabKey === "tombola";

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
  if (tabFaSnipes) {
    tabFaSnipes.classList.toggle("is-active", isFaSnipes);
    tabFaSnipes.setAttribute("aria-selected", String(isFaSnipes));
  }
  if (tabBingoBoard) {
    tabBingoBoard.classList.toggle("is-active", isBingo);
    tabBingoBoard.setAttribute("aria-selected", String(isBingo));
  }
  if (tabTombolaBoard) {
    tabTombolaBoard.classList.toggle("is-active", isTombola);
    tabTombolaBoard.setAttribute("aria-selected", String(isTombola));
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
  if (faSnipesPane) {
    faSnipesPane.hidden = !isFaSnipes;
    if (isFaSnipes && !!seasonSelect?.value) {
      renderFaSnipesBoard(seasonSelect.value);
    }
  }
  if (bingoBoardPane) {
    bingoBoardPane.hidden = !isBingo;
    if (isBingo) {
      renderBingoBoard();
    }
  }
  if (tombolaPane) {
    tombolaPane.hidden = !isTombola;
    if (isTombola && !!seasonSelect?.value) {
      renderTombolaBoard(seasonSelect.value);
    }
  }
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function formatTombolaDraftPick(player) {
  if (player?.acquisitionLabel) {
    return player.acquisitionLabel;
  }

  if (player.pickLabel) {
    return player.pickLabel;
  }

  if (!Number.isFinite(player.pick)) {
    return player.source === "FA" ? "FA" : "UND";
  }

  return `PK${Math.round(player.pick)}`;
}

function formatTombolaPlayerFilterName(playerName) {
  const rawName = String(playerName || "").trim();
  if (!rawName || rawName.includes(".")) {
    return rawName;
  }

  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return rawName;
  }

  const firstInitial = parts[0].charAt(0).toUpperCase();
  const surname = parts[parts.length - 1];
  return `${firstInitial}. ${surname}`;
}

function getTombolaPlayerDisplayLabel(player) {
  const parseDraftRound = (value) => {
    if (Number.isFinite(value)) {
      return Number(value);
    }

    const text = String(value || "").trim();
    if (!text) {
      return NaN;
    }

    const matched = text.match(/\d+/);
    return matched ? Number(matched[0]) : NaN;
  };

  const fpgValue = Number.isFinite(player?.fpg) ? player.fpg.toFixed(2) : "--";
  const draftRound = parseDraftRound(player?.draftRoundRaw ?? player?.draftRound);
  const isDrafted = Number.isFinite(draftRound) && draftRound > 0 && draftRound !== 999;
  const draftRoundText = isDrafted ? String(Math.round(draftRound)) : "FA";
  const playerName = String(player?.name || "Unknown");
  return `${playerName} | ${draftRoundText} | ${fpgValue}`;
}

function sortTombolaPlayersForFilter(players) {
  const getDraftRoundSortValue = (player) => {
    const parseDraftRound = (value) => {
      if (Number.isFinite(value)) {
        return Number(value);
      }

      const text = String(value || "").trim();
      if (!text) {
        return NaN;
      }

      const matched = text.match(/\d+/);
      return matched ? Number(matched[0]) : NaN;
    };

    const round = parseDraftRound(player?.draftRoundRaw ?? player?.draftRound);
    return Number.isFinite(round) && round > 0 && round !== 999 ? Math.round(round) : Infinity;
  };

  return [...(players || [])].sort((left, right) => {
    const leftRound = getDraftRoundSortValue(left);
    const rightRound = getDraftRoundSortValue(right);

    const leftIsDrafted = Number.isFinite(leftRound) && leftRound !== Infinity;
    const rightIsDrafted = Number.isFinite(rightRound) && rightRound !== Infinity;

    if (leftIsDrafted && rightIsDrafted) {
      if (leftRound !== rightRound) {
        return leftRound - rightRound;
      }

      const leftFpgDrafted = Number.isFinite(left?.fpg) ? left.fpg : -Infinity;
      const rightFpgDrafted = Number.isFinite(right?.fpg) ? right.fpg : -Infinity;
      if (rightFpgDrafted !== leftFpgDrafted) {
        return rightFpgDrafted - leftFpgDrafted;
      }
    }

    if (leftIsDrafted !== rightIsDrafted) {
      return leftIsDrafted ? -1 : 1;
    }

    const leftFpgFa = Number.isFinite(left?.fpg) ? left.fpg : -Infinity;
    const rightFpgFa = Number.isFinite(right?.fpg) ? right.fpg : -Infinity;
    if (rightFpgFa !== leftFpgFa) {
      return rightFpgFa - leftFpgFa;
    }

    if (leftRound !== rightRound) {
      return leftRound - rightRound;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

function createTombolaTradeSignature(candidate) {
  if (!candidate) {
    return "";
  }

  const outgoing = (candidate.outgoingPlayers || []).map((player) => String(player.uniqueId || player.id || "")).sort().join(",");
  const incoming = (candidate.incomingPlayers || []).map((player) => String(player.uniqueId || player.id || "")).sort().join(",");
  return `${candidate.fromTeamName || ""}|${candidate.toTeamName || ""}|${outgoing}|${incoming}`;
}

function createTombolaDrawKey(seasonKey, fromTeamName, toTeamName, mode, tradeStructure, fixedOutgoingPlayerIds, fixedIncomingPlayerIds, excludeGoalies, sendPosFilter, getPosFilter, getPosPlusOne) {
  const outgoingIds = [...(fixedOutgoingPlayerIds || [])].map((value) => String(value)).sort().join(",");
  const incomingIds = [...(fixedIncomingPlayerIds || [])].map((value) => String(value)).sort().join(",");
  return [
    String(seasonKey || ""),
    String(fromTeamName || ""),
    String(toTeamName || ""),
    String(mode || "fair"),
    String(tradeStructure || ""),
    String(!!excludeGoalies),
    String(sendPosFilter || ""),
    String(getPosFilter || ""),
    String(!!getPosPlusOne),
    outgoingIds,
    incomingIds,
  ].join("|");
}

function randomChoiceWeighted(items, weightFn) {
  if (!items.length) {
    return null;
  }

  const weighted = items.map((item) => ({
    item,
    weight: Math.max(0.0001, toFiniteNumber(weightFn(item), 0.0001)),
  }));
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!totalWeight) {
    return items[Math.floor(Math.random() * items.length)];
  }

  let cursor = Math.random() * totalWeight;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.item;
    }
  }

  return weighted[weighted.length - 1].item;
}

function weightedSampleWithoutReplacement(items, count, weightFn) {
  const pool = [...items];
  const picks = [];
  while (pool.length && picks.length < count) {
    const selected = randomChoiceWeighted(pool, weightFn);
    if (!selected) {
      break;
    }

    picks.push(selected);
    const index = pool.indexOf(selected);
    if (index >= 0) {
      pool.splice(index, 1);
    }
  }
  return picks;
}

function normalizeTombolaPlayerKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function getTombolaPosBucket(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("G")) {
    return "G";
  }
  if (normalized.includes("D")) {
    return "D";
  }
  return "F";
}

function getTombolaTeamPools(seasonKey) {
  const engine = window.TradeEngine;
  if (!engine || typeof engine.buildContext !== "function") {
    return { allPlayers: [], teamMap: new Map(), teamProfiles: new Map(), lineupTargets };
  }

  const rosterRows = getRosterRows(seasonKey);
  const freeAgentRows = getFaSnipesRows(seasonKey);
  return engine.buildContext({
    rosterRows,
    freeAgentRows,
    lineupTargets,
    config: {
      maxOutputProposals: 30,
    },
  });
}

function drawTombolaTrade(seasonKey, fromTeamName, toTeamName = "", mode = "fair", tradeStructure = "", fixedOutgoingPlayerIds = new Set(), fixedIncomingPlayerIds = new Set(), excludeGoalies = false, sendPosFilter = "", getPosFilter = "", getPosPlusOne = false) {
  const engine = window.TradeEngine;
  if (!engine || typeof engine.buildContext !== "function" || typeof engine.generateProposals !== "function") {
    tombolaLastEngineMessage = "Trade engine failed to initialize.";
    return null;
  }

  const context = getTombolaTeamPools(seasonKey);
  const result = engine.generateProposals(context, {
    fromTeamName,
    toTeamName,
    mode,
    tradeStructure,
    fixedOutgoingIds: fixedOutgoingPlayerIds,
    fixedIncomingIds: fixedIncomingPlayerIds,
    excludeGoalies,
    sendPosFilter,
    getPosFilter,
    getPosRequirePlusOne: !!getPosPlusOne,
  });

  const proposals = Array.isArray(result?.proposals) ? result.proposals : [];
  tombolaLastEngineMessage = String(result?.reason || "").trim();

  if (!proposals.length) {
    return null;
  }

  const drawKey = createTombolaDrawKey(
    seasonKey,
    fromTeamName,
    toTeamName,
    mode,
    tradeStructure,
    fixedOutgoingPlayerIds,
    fixedIncomingPlayerIds,
    excludeGoalies,
    sendPosFilter,
    getPosFilter,
    getPosPlusOne
  );

  const currentCursor = tombolaDrawCursorByKey.get(drawKey) || 0;
  if (proposals.length > 0 && currentCursor >= proposals.length) {
    tombolaLastEngineMessage = TOMBOLA_EXHAUSTED_MESSAGE;
    return null;
  }

  const nextSuggestion = proposals[currentCursor] || proposals[0];
  tombolaDrawCursorByKey.set(drawKey, currentCursor + 1);
  return nextSuggestion;
}

function renderTombolaPlayerList(players) {
  return players
    .map((player) => {
      const pickText = formatTombolaDraftPick(player);
      const ageText = Number.isFinite(player.age) && player.age > 0 ? `Age ${Math.round(player.age)}` : "Age --";
      return `
        <li class="tombola-player-item">
          <span class="tombola-player-name">${escapeHtml(player.name)}</span>
          <span class="tombola-player-meta">${escapeHtml(player.pos)} | FP/G ${player.fpg.toFixed(2)} | ${escapeHtml(ageText)} | ${escapeHtml(pickText)}</span>
        </li>
      `;
    })
    .join("");
}

function renderTombolaSuggestion(result) {
  if (!result) {
    const message = tombolaLastEngineMessage || "No qualifying trade path found for this draw. Try a different destination team or draw again.";
    return `<div class="empty-state compact">${escapeHtml(message)}</div>`;
  }

  const scoreBadge = (label, score) => `<span class="tombola-score-pill"><strong>${label}</strong> ${Math.round(score * 100)}</span>`;
  const fmt = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "0.00";
    }
    return numeric.toFixed(2);
  };

  const fmtDelta = (after, before) => {
    const delta = Number(after) - Number(before);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) {
      return "";
    }
    return ` (${delta > 0 ? "+" : ""}${delta.toFixed(2)})`;
  };

  const myBefore = result?.details?.fromDelta?.beforeState?.lineupByPos || { F: 0, D: 0, G: 0 };
  const myAfter = result?.details?.fromDelta?.afterState?.lineupByPos || { F: 0, D: 0, G: 0 };
  const otherBefore = result?.details?.toDelta?.beforeState?.lineupByPos || { F: 0, D: 0, G: 0 };
  const otherAfter = result?.details?.toDelta?.afterState?.lineupByPos || { F: 0, D: 0, G: 0 };

  const lineupTable = `
    <div class="tombola-lineup-table-wrap">
      <p class="tombola-lineup-table-title">Top-Lineup FP/G (After with Delta vs Before)</p>
      <table class="tombola-lineup-table" aria-label="Top lineup FP/G before and after trade">
        <thead>
          <tr>
            <th></th>
            <th>MY TEAM</th>
            <th>OTHER TEAM</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>F (Top 12)</th>
            <td>${fmt(myAfter.F)}${fmtDelta(myAfter.F, myBefore.F)}</td>
            <td>${fmt(otherAfter.F)}${fmtDelta(otherAfter.F, otherBefore.F)}</td>
          </tr>
          <tr>
            <th>D (Top 4)</th>
            <td>${fmt(myAfter.D)}${fmtDelta(myAfter.D, myBefore.D)}</td>
            <td>${fmt(otherAfter.D)}${fmtDelta(otherAfter.D, otherBefore.D)}</td>
          </tr>
          <tr>
            <th>G (Top 2)</th>
            <td>${fmt(myAfter.G)}${fmtDelta(myAfter.G, myBefore.G)}</td>
            <td>${fmt(otherAfter.G)}${fmtDelta(otherAfter.G, otherBefore.G)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  return `
    <div class="tombola-result-card">
      <div class="tombola-result-header">
        <p class="eyebrow">Suggested Trade Path</p>
        <h4 class="tombola-result-title">${escapeHtml(result.fromTeamName)} <span>↔</span> ${escapeHtml(result.toTeamName)} ${result.structure ? `<small>(${escapeHtml(result.structure)})</small>` : ""}</h4>
      </div>
      <div class="tombola-score-row">
        ${scoreBadge("Composite", result.scoring.composite)}
        ${scoreBadge("Fit", result.scoring.fitScore)}
        ${scoreBadge("Fairness", result.scoring.fairness)}
        ${scoreBadge("From Edge", clamp((result.scoring.fromAdvantageRatio + 1) / 2, 0, 1))}
        ${scoreBadge("Upside", result.scoring.upsideScore)}
      </div>
      <div class="tombola-trade-grid">
        <section class="tombola-trade-side">
          <h5>${escapeHtml(result.fromTeamName)} sends</h5>
          <ul>${renderTombolaPlayerList(result.outgoingPlayers)}</ul>
        </section>
        <section class="tombola-trade-side">
          <h5>${escapeHtml(result.fromTeamName)} receives</h5>
          <ul>${renderTombolaPlayerList(result.incomingPlayers)}</ul>
        </section>
      </div>
      ${lineupTable}
    </div>
  `;
}

function renderTombolaBoard(seasonKey) {
  if (!tombolaPane) {
    return;
  }

  const pools = getTombolaTeamPools(seasonKey);
  const teamNames = [...pools.teamMap.keys()].sort((left, right) => left.localeCompare(right));

  if (tombolaLastSeason !== seasonKey) {
    tombolaLastSeason = seasonKey;
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaDrawCursorByKey = new Map();
    tombolaFromTeamFilter = "";
    tombolaToTeamFilter = "";
    tombolaFromPlayerFilterIds = new Set();
    tombolaFromPlayerFilterOpen = false;
    tombolaToPlayerFilterIds = new Set();
    tombolaToPlayerFilterOpen = false;
    tombolaTradeMode = "fair";
    tombolaTradeStructure = "";
    tombolaExcludeGoalies = false;
    tombolaSendPosFilter = "";
    tombolaGetPosFilter = "";
    tombolaGetPosPlusOne = false;
    tombolaLastEngineMessage = "";
  }

  if (tombolaFromTeamFilter && !teamNames.includes(tombolaFromTeamFilter)) {
    tombolaFromTeamFilter = "";
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaFromPlayerFilterIds = new Set();
    tombolaFromPlayerFilterOpen = false;
    tombolaToPlayerFilterIds = new Set();
    tombolaToPlayerFilterOpen = false;
  }
  if (tombolaToTeamFilter && !teamNames.includes(tombolaToTeamFilter)) {
    tombolaToTeamFilter = "";
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaToPlayerFilterIds = new Set();
    tombolaToPlayerFilterOpen = false;
  }
  if (tombolaToTeamFilter && tombolaToTeamFilter === tombolaFromTeamFilter) {
    tombolaToTeamFilter = "";
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaToPlayerFilterIds = new Set();
    tombolaToPlayerFilterOpen = false;
  }

  const fromTeamPlayers = tombolaFromTeamFilter
    ? sortTombolaPlayersForFilter(pools.teamProfiles.get(tombolaFromTeamFilter)?.players || [])
    : [];
  const toTeamPlayers = tombolaToTeamFilter
    ? sortTombolaPlayersForFilter(pools.teamProfiles.get(tombolaToTeamFilter)?.players || [])
    : [];

  const validPlayerIds = new Set(fromTeamPlayers.map((player) => player.id));
  tombolaFromPlayerFilterIds = new Set([...tombolaFromPlayerFilterIds].filter((playerId) => validPlayerIds.has(playerId)));
  const validToPlayerIds = new Set(toTeamPlayers.map((player) => player.id));
  tombolaToPlayerFilterIds = new Set([...tombolaToPlayerFilterIds].filter((playerId) => validToPlayerIds.has(playerId)));

  if (tombolaExcludeGoalies) {
    const nonGoalieFromIds = new Set(fromTeamPlayers.filter((player) => player.pos !== "G").map((player) => player.id));
    const nonGoalieToIds = new Set(toTeamPlayers.filter((player) => player.pos !== "G").map((player) => player.id));
    tombolaFromPlayerFilterIds = new Set([...tombolaFromPlayerFilterIds].filter((playerId) => nonGoalieFromIds.has(playerId)));
    tombolaToPlayerFilterIds = new Set([...tombolaToPlayerFilterIds].filter((playerId) => nonGoalieToIds.has(playerId)));
    if (tombolaSendPosFilter === "G") {
      tombolaSendPosFilter = "";
    }
    if (tombolaGetPosFilter === "G") {
      tombolaGetPosFilter = "";
    }
  }

  const playerFilterSummary = tombolaFromTeamFilter
    ? `${tombolaFromPlayerFilterIds.size} selected`
    : "Optional";
  const toPlayerFilterSummary = tombolaToTeamFilter
    ? `${tombolaToPlayerFilterIds.size} selected`
    : "Optional";
  const fromPlayerSummaryText = tombolaFromPlayerFilterIds.size ? `Selected (${playerFilterSummary})` : "Select (Optional)";
  const toPlayerSummaryText = tombolaToPlayerFilterIds.size ? `Selected (${toPlayerFilterSummary})` : "Select (Optional)";

  const playerOptions = fromTeamPlayers.length
    ? fromTeamPlayers.map((player) => {
        const checked = tombolaFromPlayerFilterIds.has(player.id) ? "checked" : "";
        const disabled = tombolaExcludeGoalies && player.pos === "G" ? "disabled" : "";
        const disabledClass = tombolaExcludeGoalies && player.pos === "G" ? " is-disabled" : "";
        return `
          <label class="draft-multi-option tombola-player-option${disabledClass}">
            <input type="checkbox" data-tombola-from-player="${escapeHtml(player.id)}" value="${escapeHtml(player.id)}" ${checked} ${disabled} />
            <span>${escapeHtml(getTombolaPlayerDisplayLabel(player))}</span>
          </label>
        `;
      }).join("")
    : `<div class="tombola-player-empty">${escapeHtml(playerFilterSummary)}</div>`;

  const toPlayerOptions = tombolaToTeamFilter && toTeamPlayers.length
    ? toTeamPlayers.map((player) => {
        const checked = tombolaToPlayerFilterIds.has(player.id) ? "checked" : "";
        const disabled = tombolaExcludeGoalies && player.pos === "G" ? "disabled" : "";
        const disabledClass = tombolaExcludeGoalies && player.pos === "G" ? " is-disabled" : "";
        return `
          <label class="draft-multi-option tombola-player-option${disabledClass}">
            <input type="checkbox" data-tombola-to-player="${escapeHtml(player.id)}" value="${escapeHtml(player.id)}" ${checked} ${disabled} />
            <span>${escapeHtml(getTombolaPlayerDisplayLabel(player))}</span>
          </label>
        `;
      }).join("")
    : `<div class="tombola-player-empty">${escapeHtml(toPlayerFilterSummary)}</div>`;

  const fromOptions = [`<option value="">Select team</option>`]
    .concat(teamNames.map((teamName) => `<option value="${escapeHtml(teamName)}" ${tombolaFromTeamFilter === teamName ? "selected" : ""}>${escapeHtml(teamName)}</option>`))
    .join("");

  const toOptions = [`<option value="">Any team (auto fit)</option>`]
    .concat(teamNames
      .filter((teamName) => teamName !== tombolaFromTeamFilter)
      .map((teamName) => `<option value="${escapeHtml(teamName)}" ${tombolaToTeamFilter === teamName ? "selected" : ""}>${escapeHtml(teamName)}</option>`))
    .join("");

  const hasFromTeam = !!tombolaFromTeamFilter;
  const exhaustedMessageClass = tombolaLastEngineMessage === TOMBOLA_EXHAUSTED_MESSAGE
    ? " tombola-empty-exhausted"
    : "";
  const getPlusOneNoTradeHintClass = tombolaLastEngineMessage.startsWith("No trades satisfied GET ")
    && tombolaLastEngineMessage.includes(" +1 ")
    ? " tombola-empty-hint"
    : "";
  const outputHtml = tombolaLastSuggestion
    ? renderTombolaSuggestion(tombolaLastSuggestion)
    : tombolaLastEngineMessage
      ? `<div class="empty-state compact${exhaustedMessageClass}${getPlusOneNoTradeHintClass}">${escapeHtml(tombolaLastEngineMessage)}</div>`
      : '<div class="empty-state compact tombola-empty-hint">Select a <strong>My Fantasy Team</strong> and click <strong>Draw!</strong> to generate an analytically ranked trade path.</div>';
  const disableGPosOption = tombolaExcludeGoalies ? "disabled" : "";

  tombolaPane.innerHTML = `
    <section class="tombola-board-card">
      <div class="tombola-board-header">
        <p class="eyebrow">Trade Tombola</p>
      </div>
      <div class="draft-class-toolbar tombola-controls">
        <div class="tombola-options-row">
          <div class="tombola-param-block tombola-param-block-send">
            <span class="tombola-param-label">SEND</span>
            <fieldset class="tombola-pos-radio-group tombola-param-box ${tombolaExcludeGoalies ? "is-goalie-excluded" : ""}" aria-label="Send position filter">
              <label class="tombola-pos-radio-option">
                <input type="checkbox" value="F" ${tombolaSendPosFilter === "F" ? "checked" : ""} data-tombola-send-pos-filter />
                <span>F</span>
              </label>
              <label class="tombola-pos-radio-option">
                <input type="checkbox" value="D" ${tombolaSendPosFilter === "D" ? "checked" : ""} data-tombola-send-pos-filter />
                <span>D</span>
              </label>
              <label class="tombola-pos-radio-option ${tombolaExcludeGoalies ? "is-disabled" : ""}">
                <input type="checkbox" value="G" ${tombolaSendPosFilter === "G" ? "checked" : ""} ${disableGPosOption} data-tombola-send-pos-filter />
                <span>G</span>
              </label>
            </fieldset>
          </div>
          <div class="tombola-param-block tombola-param-block-get">
            <span class="tombola-param-label">GET</span>
            <fieldset class="tombola-pos-radio-group tombola-param-box ${tombolaExcludeGoalies ? "is-goalie-excluded" : ""}" aria-label="Get position filter">
              <label class="tombola-pos-radio-option">
                <input type="checkbox" value="F" ${tombolaGetPosFilter === "F" ? "checked" : ""} data-tombola-get-pos-filter />
                <span>F</span>
              </label>
              <label class="tombola-pos-radio-option">
                <input type="checkbox" value="D" ${tombolaGetPosFilter === "D" ? "checked" : ""} data-tombola-get-pos-filter />
                <span>D</span>
              </label>
              <label class="tombola-pos-radio-option ${tombolaExcludeGoalies ? "is-disabled" : ""}">
                <input type="checkbox" value="G" ${tombolaGetPosFilter === "G" ? "checked" : ""} ${disableGPosOption} data-tombola-get-pos-filter />
                <span>G</span>
              </label>
              <label class="tombola-pos-radio-option tombola-pos-plus-one-option">
                <input id="tombolaGetPlusOne" type="checkbox" ${tombolaGetPosPlusOne ? "checked" : ""} ${tombolaGetPosFilter ? "" : "disabled"} />
                <span>+1</span>
              </label>
            </fieldset>
          </div>
        </div>
        <div class="tombola-filter-row tombola-filter-row-from">
          <label class="draft-class-filter-group tombola-control-group tombola-team-filter-group">
            <span class="filter-group-label">My Fantasy Team *</span>
            <div class="draft-class-select-wrap">
              <select id="tombolaFromTeamSelect" class="draft-class-select tombola-select">${fromOptions}</select>
            </div>
          </label>
          <label class="draft-class-filter-group tombola-control-group tombola-player-filter-group">
            <span class="filter-group-label">MY PLAYERS</span>
            <details class="draft-multi-select tombola-player-select" data-tombola-from-player-filter ${tombolaFromTeamFilter && tombolaFromPlayerFilterOpen ? "open" : ""}>
              <summary class="draft-multi-summary">${fromPlayerSummaryText}</summary>
              <div class="draft-multi-menu">
                ${playerOptions}
                <div class="tombola-player-menu-actions">
                  <button type="button" class="tombola-player-clear-btn" data-tombola-clear-from-players>Clear</button>
                </div>
              </div>
            </details>
          </label>
        </div>
        <div class="tombola-filter-row tombola-filter-row-to">
          <label class="draft-class-filter-group tombola-control-group tombola-team-filter-group">
            <span class="filter-group-label">To Fantasy Team</span>
            <div class="draft-class-select-wrap">
              <select id="tombolaToTeamSelect" class="draft-class-select tombola-select">${toOptions}</select>
            </div>
          </label>
          <label class="draft-class-filter-group tombola-control-group tombola-player-filter-group">
            <span class="filter-group-label">TO Players</span>
            <details class="draft-multi-select tombola-player-select" data-tombola-to-player-filter ${tombolaToTeamFilter && tombolaToPlayerFilterOpen ? "open" : ""}>
              <summary class="draft-multi-summary">${toPlayerSummaryText}</summary>
              <div class="draft-multi-menu">
                ${toPlayerOptions}
                <div class="tombola-player-menu-actions">
                  <button type="button" class="tombola-player-clear-btn" data-tombola-clear-to-players>Clear</button>
                </div>
              </div>
            </details>
          </label>
        </div>
        <div class="tombola-filter-row tombola-filter-row-actions">
          <div class="tombola-param-block tombola-param-block-mode">
            <span class="tombola-param-label">MODE</span>
            <fieldset class="tombola-param-box tombola-analytics-options" role="radiogroup" aria-label="Tombola trade mode">
              <label class="tombola-mode-option">
                <input id="tombolaModeFair" type="radio" name="tombolaTradeMode" value="fair" ${tombolaTradeMode === "fair" ? "checked" : ""} />
                <span>Fair</span>
              </label>
              <label class="tombola-mode-option">
                <input id="tombolaModeFleece" type="radio" name="tombolaTradeMode" value="fleece" ${tombolaTradeMode === "fleece" ? "checked" : ""} />
                <span>Fleece</span>
              </label>
            </fieldset>
          </div>
          <div class="tombola-param-block tombola-param-block-limits">
            <span class="tombola-param-label">LIMITS</span>
            <fieldset class="tombola-param-box tombola-limits-options" aria-label="Tombola limits options">
              <label class="tombola-single-option">
                <input type="checkbox" value="1:1" data-tombola-structure-filter ${tombolaTradeStructure === "1:1" ? "checked" : ""} />
                <span>1:1 Trade</span>
              </label>
              <label class="tombola-single-option">
                <input type="checkbox" value="1:2" data-tombola-structure-filter ${tombolaTradeStructure === "1:2" ? "checked" : ""} />
                <span>1:2 Trade</span>
              </label>
              <label class="tombola-single-option">
                <input type="checkbox" value="2:1" data-tombola-structure-filter ${tombolaTradeStructure === "2:1" ? "checked" : ""} />
                <span>2:1 Trade</span>
              </label>
              <label class="tombola-single-option tombola-exclude-g-option">
                <input id="tombolaExcludeG" type="checkbox" ${tombolaExcludeGoalies ? "checked" : ""} />
                <span>Exclude G</span>
              </label>
            </fieldset>
          </div>
          <div class="draft-class-filter-group tombola-control-group tombola-draw-wrap tombola-draw-wrap--actions">
            <span class="filter-group-label">&nbsp;</span>
            <button id="tombolaDrawBtn" class="tombola-draw-btn" type="button" ${hasFromTeam ? "" : "disabled"}>Draw!</button>
          </div>
        </div>
      </div>
      <div class="tombola-output">${outputHtml}</div>
    </section>
  `;

  const fromSelect = tombolaPane.querySelector("#tombolaFromTeamSelect");
  const toSelect = tombolaPane.querySelector("#tombolaToTeamSelect");
  const fairModeInput = tombolaPane.querySelector("#tombolaModeFair");
  const fleeceModeInput = tombolaPane.querySelector("#tombolaModeFleece");
  const structureInputs = tombolaPane.querySelectorAll("[data-tombola-structure-filter]");
  const excludeGInput = tombolaPane.querySelector("#tombolaExcludeG");
  const getPlusOneInput = tombolaPane.querySelector("#tombolaGetPlusOne");
  const sendPosFilterInputs = tombolaPane.querySelectorAll("[data-tombola-send-pos-filter]");
  const getPosFilterInputs = tombolaPane.querySelectorAll("[data-tombola-get-pos-filter]");
  const drawButton = tombolaPane.querySelector("#tombolaDrawBtn");
  const outputNode = tombolaPane.querySelector(".tombola-output");
  const fromSummaryEl = tombolaPane.querySelector("[data-tombola-from-player-filter] .draft-multi-summary");
  const toSummaryEl = tombolaPane.querySelector("[data-tombola-to-player-filter] .draft-multi-summary");

  const getSummaryText = (selectedCount) => {
    if (!selectedCount) {
      return "Select (Optional)";
    }
    return `Selected (${selectedCount} selected)`;
  };

  const clearSuggestionOutput = () => {
    if (outputNode) {
      outputNode.innerHTML = '<div class="empty-state compact tombola-empty-hint">Select a <strong>My Fantasy Team</strong> and click <strong>Draw!</strong> to generate an analytically ranked trade path.</div>';
    }
  };

  tombolaPane.querySelectorAll("[data-tombola-from-player-filter] .draft-multi-option input").forEach((input) => {
    input.addEventListener("change", () => {
      const selectedIds = Array.from(tombolaPane.querySelectorAll("[data-tombola-from-player]:checked"))
        .map((checkbox) => checkbox.value)
        .filter(Boolean);
      const structureLimits = getTombolaStructureLimits(tombolaTradeStructure);
      if (structureLimits && selectedIds.length > structureLimits.outgoing) {
        const keptIds = selectedIds.slice(-structureLimits.outgoing);
        const keptSet = new Set(keptIds);
        tombolaPane.querySelectorAll("[data-tombola-from-player]").forEach((checkbox) => {
          checkbox.checked = keptSet.has(checkbox.value);
        });
        tombolaFromPlayerFilterIds = keptSet;
      } else {
        tombolaFromPlayerFilterIds = new Set(selectedIds);
      }
      tombolaFromPlayerFilterOpen = true;
      tombolaLastSuggestion = null;
      tombolaLastSuggestionSignature = "";
      tombolaLastEngineMessage = "";
      if (fromSummaryEl) {
        fromSummaryEl.textContent = getSummaryText(tombolaFromPlayerFilterIds.size);
      }
      clearSuggestionOutput();
    });
  });

  tombolaPane.querySelectorAll("[data-tombola-to-player-filter] .draft-multi-option input").forEach((input) => {
    input.addEventListener("change", () => {
      const selectedIds = Array.from(tombolaPane.querySelectorAll("[data-tombola-to-player]:checked"))
        .map((checkbox) => checkbox.value)
        .filter(Boolean);
      const structureLimits = getTombolaStructureLimits(tombolaTradeStructure);
      if (structureLimits && selectedIds.length > structureLimits.incoming) {
        const keptIds = selectedIds.slice(-structureLimits.incoming);
        const keptSet = new Set(keptIds);
        tombolaPane.querySelectorAll("[data-tombola-to-player]").forEach((checkbox) => {
          checkbox.checked = keptSet.has(checkbox.value);
        });
        tombolaToPlayerFilterIds = keptSet;
      } else {
        tombolaToPlayerFilterIds = new Set(selectedIds);
      }
      tombolaToPlayerFilterOpen = true;
      tombolaLastSuggestion = null;
      tombolaLastSuggestionSignature = "";
      tombolaLastEngineMessage = "";
      if (toSummaryEl) {
        toSummaryEl.textContent = getSummaryText(tombolaToPlayerFilterIds.size);
      }
      clearSuggestionOutput();
    });
  });

  tombolaPane.querySelectorAll("[data-tombola-from-player-filter]").forEach((detailsElement) => {
    detailsElement.addEventListener("toggle", () => {
      tombolaFromPlayerFilterOpen = detailsElement.open;
    });
  });

  tombolaPane.querySelectorAll("[data-tombola-to-player-filter]").forEach((detailsElement) => {
    detailsElement.addEventListener("toggle", () => {
      tombolaToPlayerFilterOpen = detailsElement.open;
    });
  });

  tombolaPane.querySelector("[data-tombola-clear-from-players]")?.addEventListener("click", () => {
    tombolaFromPlayerFilterIds = new Set();
    tombolaFromPlayerFilterOpen = true;
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    tombolaPane.querySelectorAll("[data-tombola-from-player]").forEach((checkbox) => {
      checkbox.checked = false;
    });
    if (fromSummaryEl) {
      fromSummaryEl.textContent = getSummaryText(0);
    }
    clearSuggestionOutput();
  });

  tombolaPane.querySelector("[data-tombola-clear-to-players]")?.addEventListener("click", () => {
    tombolaToPlayerFilterIds = new Set();
    tombolaToPlayerFilterOpen = true;
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    tombolaPane.querySelectorAll("[data-tombola-to-player]").forEach((checkbox) => {
      checkbox.checked = false;
    });
    if (toSummaryEl) {
      toSummaryEl.textContent = getSummaryText(0);
    }
    clearSuggestionOutput();
  });

  if (!tombolaOutsideClickHandlerBound) {
    document.addEventListener("click", (event) => {
      if (!tombolaPane || tombolaPane.hidden) {
        return;
      }
      if (!(event.target instanceof Element)) {
        return;
      }
      if (event.target.closest("[data-tombola-from-player-filter]") || event.target.closest("[data-tombola-to-player-filter]")) {
        return;
      }

      tombolaFromPlayerFilterOpen = false;
      tombolaToPlayerFilterOpen = false;
      tombolaPane.querySelectorAll("[data-tombola-from-player-filter], [data-tombola-to-player-filter]").forEach((detailsElement) => {
        detailsElement.open = false;
      });
    });
    tombolaOutsideClickHandlerBound = true;
  }

  fromSelect?.addEventListener("change", () => {
    tombolaFromTeamFilter = fromSelect.value;
    if (tombolaToTeamFilter === tombolaFromTeamFilter) {
      tombolaToTeamFilter = "";
      tombolaToPlayerFilterIds = new Set();
      tombolaToPlayerFilterOpen = false;
    }
    tombolaFromPlayerFilterIds = new Set();
    tombolaFromPlayerFilterOpen = false;
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    renderTombolaBoard(seasonKey);
  });

  toSelect?.addEventListener("change", () => {
    tombolaToTeamFilter = toSelect.value;
    tombolaToPlayerFilterIds = new Set();
    tombolaToPlayerFilterOpen = false;
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    renderTombolaBoard(seasonKey);
  });

  fairModeInput?.addEventListener("change", () => {
    tombolaTradeMode = "fair";
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    renderTombolaBoard(seasonKey);
  });

  fleeceModeInput?.addEventListener("change", () => {
    tombolaTradeMode = "fleece";
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    renderTombolaBoard(seasonKey);
  });

  structureInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      if (input.checked) {
        structureInputs.forEach((otherInput) => {
          if (otherInput !== input && otherInput instanceof HTMLInputElement) {
            otherInput.checked = false;
          }
        });
        tombolaTradeStructure = input.value;
      } else {
        tombolaTradeStructure = "";
      }

      const structureLimits = getTombolaStructureLimits(tombolaTradeStructure);
      if (structureLimits) {
        tombolaFromPlayerFilterIds = new Set(Array.from(tombolaFromPlayerFilterIds).slice(0, structureLimits.outgoing));
        tombolaToPlayerFilterIds = new Set(Array.from(tombolaToPlayerFilterIds).slice(0, structureLimits.incoming));
      }

      tombolaLastSuggestion = null;
      tombolaLastSuggestionSignature = "";
      tombolaLastEngineMessage = "";
      renderTombolaBoard(seasonKey);
    });
  });

  excludeGInput?.addEventListener("change", () => {
    tombolaExcludeGoalies = !!excludeGInput.checked;
    if (tombolaExcludeGoalies && tombolaSendPosFilter === "G") {
      tombolaSendPosFilter = "";
    }
    if (tombolaExcludeGoalies && tombolaGetPosFilter === "G") {
      tombolaGetPosFilter = "";
    }
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    renderTombolaBoard(seasonKey);
  });

  sendPosFilterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      if (input.checked) {
        sendPosFilterInputs.forEach((otherInput) => {
          if (otherInput !== input && otherInput instanceof HTMLInputElement) {
            otherInput.checked = false;
          }
        });
        tombolaSendPosFilter = input.value;
      } else {
        tombolaSendPosFilter = "";
      }

      tombolaLastSuggestion = null;
      tombolaLastSuggestionSignature = "";
      tombolaLastEngineMessage = "";
      renderTombolaBoard(seasonKey);
    });
  });

  getPosFilterInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      if (input.checked) {
        getPosFilterInputs.forEach((otherInput) => {
          if (otherInput !== input && otherInput instanceof HTMLInputElement) {
            otherInput.checked = false;
          }
        });
        tombolaGetPosFilter = input.value;
      } else {
        tombolaGetPosFilter = "";
      }

      if (!tombolaGetPosFilter) {
        tombolaGetPosPlusOne = false;
      }

      tombolaLastSuggestion = null;
      tombolaLastSuggestionSignature = "";
      tombolaLastEngineMessage = "";
      renderTombolaBoard(seasonKey);
    });
  });

  getPlusOneInput?.addEventListener("change", () => {
    tombolaGetPosPlusOne = !!getPlusOneInput.checked;
    tombolaLastSuggestion = null;
    tombolaLastSuggestionSignature = "";
    tombolaLastEngineMessage = "";
    renderTombolaBoard(seasonKey);
  });

  drawButton?.addEventListener("click", () => {
    if (!tombolaFromTeamFilter) {
      return;
    }

    // Always run a fresh generation pass with current filters and selections.
    tombolaLastSuggestion = drawTombolaTrade(
      seasonKey,
      tombolaFromTeamFilter,
      tombolaToTeamFilter,
      tombolaTradeMode,
      tombolaTradeStructure,
      new Set(tombolaFromPlayerFilterIds),
      new Set(tombolaToPlayerFilterIds),
      tombolaExcludeGoalies,
      tombolaSendPosFilter,
      tombolaGetPosFilter,
      tombolaGetPosPlusOne
    );
    renderTombolaBoard(seasonKey);
  });
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
  ensureLeaderboardLogoOverlay();

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
    .map(([teamName, leads]) => {
      const leadCount = leads.length;
      const teamLogoUrl = getTeamLogoUrl(teamName);
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
            <span class="leaderboard-logo" aria-hidden="true">${teamLogoUrl
    ? `<img class="leaderboard-logo-image" src="${escapeHtml(teamLogoUrl)}" data-logo-src="${escapeHtml(teamLogoUrl)}" alt="" loading="lazy" decoding="async" />
               <span class="leaderboard-logo-fallback leaderboard-logo-fallback--hidden"></span>`
    : '<span class="leaderboard-logo-fallback"></span>'}</span>
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

  leaderboard.querySelectorAll(".leaderboard-logo-image").forEach((imageElement) => {
    imageElement.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!(imageElement instanceof HTMLImageElement) || imageElement.classList.contains("leaderboard-logo-image--hidden")) {
        return;
      }

      const teamName = imageElement.closest(".leaderboard-row")?.querySelector(".leaderboard-team")?.textContent?.trim() || "Team";
      const logoUrl = imageElement.getAttribute("data-logo-src") || imageElement.currentSrc || imageElement.src;
      openLeaderboardLogoOverlay(logoUrl, teamName);
    });

    imageElement.addEventListener("error", () => {
      if (!(imageElement instanceof HTMLImageElement)) {
        return;
      }

      const originalLogoUrl = imageElement.getAttribute("data-logo-src") || "";
      const alreadyRetried = imageElement.getAttribute("data-proxy-tried") === "1";
      if (!alreadyRetried && originalLogoUrl) {
        try {
          const normalizedUrl = originalLogoUrl.replace(/^https?:\/\//i, "");
          imageElement.setAttribute("data-proxy-tried", "1");
          imageElement.src = `https://images.weserv.nl/?url=${encodeURIComponent(normalizedUrl)}`;
          return;
        } catch (error) {
          // Fall through to visual fallback marker.
        }
      }

      imageElement.classList.add("leaderboard-logo-image--hidden");
      const fallbackDot = imageElement.parentElement?.querySelector(".leaderboard-logo-fallback");
      if (fallbackDot) {
        fallbackDot.classList.remove("leaderboard-logo-fallback--hidden");
      }
    });
  });

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

const faSnipesColumns = [
  { key: "PLAYER", label: "PLAYER", type: "string" },
  { key: "POS", label: "POS", type: "string" },
  { key: "FP", label: "FP", type: "number" },
  { key: "FP RK", label: "FP RK", type: "number" },
  { key: "FP/G", label: "FP/G", type: "number" },
  { key: "FP/G RK", label: "FP/G RK", type: "number" },
  { key: "ROS", label: "ROS", type: "number" },
  { key: "FANTASY TEAM", label: "FANTASY TEAM", type: "string" },
  { key: "NHL TEAM", label: "NHL TEAM", type: "string" },
];

function getFaSnipesRows(seasonKey) {
  const faSource = getSeasonPayloadForSource("fa", seasonKey);
  const seasonNode = faSource?.season?.[seasonKey] || {};
  const rows = seasonNode.players || [];
  return Array.isArray(rows) ? rows : [];
}

function getRosterRows(seasonKey) {
  const rosterSource = getSeasonPayloadForSource("rosters", seasonKey);
  const seasonNode = rosterSource?.season?.[seasonKey] || rosterSource?.season || rosterSource || {};
  const teams = seasonNode.teams || seasonNode.Teams || seasonNode.rosters || seasonNode.Rosters || {};
  const rows = [];

  if (Array.isArray(seasonNode)) {
    seasonNode.forEach((row) => {
      if (row && typeof row === "object") {
        rows.push(row);
      }
    });
    return rows;
  }

  if (Array.isArray(teams)) {
    teams.forEach((teamEntry) => {
      if (!teamEntry || typeof teamEntry !== "object") {
        return;
      }
      const teamName = String(teamEntry.team || teamEntry.Team || teamEntry.teamName || teamEntry["Fantasy Team"] || "").trim();
      const players = Array.isArray(teamEntry.players) ? teamEntry.players : Array.isArray(teamEntry.Players) ? teamEntry.Players : [];
      players.forEach((player) => {
        if (!player || typeof player !== "object") {
          return;
        }
        rows.push({
          ...player,
          teamName: teamName || String(player["Fantasy Team"] || player.team || player.teamName || "").trim(),
        });
      });
    });
    return rows;
  }

  Object.entries(teams).forEach(([teamName, teamValue]) => {
    const players = Array.isArray(teamValue?.players)
      ? teamValue.players
      : Array.isArray(teamValue?.Players)
        ? teamValue.Players
        : Array.isArray(teamValue)
          ? teamValue
          : [];
    players.forEach((player) => {
      rows.push({
        ...player,
        teamName: teamValue?.team || teamValue?.Team || teamName,
      });
    });
  });

  return rows;
}

function getFaSnipesCellValue(row, key) {
  if (!row || typeof row !== "object") {
    return undefined;
  }
  return row[key];
}

function formatFaSnipesCell(column, value) {
  if (column.key === "ROS") {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return "0%";
    }
    return `${Math.round(numeric)}%`;
  }

  if (column.key === "FP RK" || column.key === "FP/G RK") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(Math.round(numeric)) : "";
  }

  if (column.type === "number") {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return "0.00";
    }
    return numeric.toFixed(2);
  }

  return value === undefined || value === null ? "" : String(value);
}

function sortFaSnipesRows(rows) {
  const column = faSnipesColumns.find((entry) => entry.key === faSnipesSortKey) || faSnipesColumns[0];
  const direction = faSnipesSortDirection === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = getFaSnipesCellValue(left, column.key);
    const rightValue = getFaSnipesCellValue(right, column.key);

    if (column.type === "number") {
      const leftNumber = getDraftClassSortNumber(leftValue);
      const rightNumber = getDraftClassSortNumber(rightValue);
      if (leftNumber !== rightNumber) {
        return (leftNumber - rightNumber) * direction;
      }
      return String(left?.PLAYER || "").localeCompare(String(right?.PLAYER || ""));
    }

    const leftText = String(leftValue ?? "");
    const rightText = String(rightValue ?? "");
    const compare = leftText.localeCompare(rightText);
    if (compare !== 0) {
      return compare * direction;
    }
    return String(left?.PLAYER || "").localeCompare(String(right?.PLAYER || ""));
  });
}

function renderFaSnipesBoard(seasonKey) {
  if (!faSnipesPane) {
    return;
  }

  const existingTableWrap = faSnipesPane.querySelector(".fa-snipes-table-wrap");
  if (existingTableWrap) {
    faSnipesTableScrollLeft = existingTableWrap.scrollLeft;
  }

  const allFaRows = getFaSnipesRows(seasonKey);
  const fantasyTeamOptions = Array.from(new Set(allFaRows
    .map((row) => String(row?.["FANTASY TEAM"] || "").trim())
    .filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((teamKey) => ({ value: teamKey, label: teamKey }));

  faSnipesFantasyTeamFilter = getFilteredSelection(faSnipesFantasyTeamFilter, fantasyTeamOptions.map((option) => option.value));

  const filteredFaRows = allFaRows.filter((row) => {
    const fantasyTeamValue = String(row?.["FANTASY TEAM"] || "").trim();
    return !faSnipesFantasyTeamFilter.size || faSnipesFantasyTeamFilter.has(fantasyTeamValue);
  });

  const faRows = sortFaSnipesRows(filteredFaRows);
  const pageRows = faRows;

  const headerCells = faSnipesColumns
    .map((column) => {
      const isActive = faSnipesSortKey === column.key;
      const indicator = isActive ? (faSnipesSortDirection === "asc" ? "↑" : "↓") : "↕";
      return `<th><button class="matchup-sort${isActive ? " is-active" : ""}" data-fa-column="${column.key}" type="button"><span class="matchup-sort-label">${column.label}</span><span class="matchup-sort-indicator">${indicator}</span></button></th>`;
    })
    .join("");

  const bodyRows = pageRows
    .map((row) => {
      const cells = faSnipesColumns
        .map((column, columnIndex) => {
          const stickyClass = columnIndex === 0 ? " table-highlight" : "";
          return `<td class="${stickyClass.trim()}">${formatFaSnipesCell(column, getFaSnipesCellValue(row, column.key))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  faSnipesPane.innerHTML = `
    <div class="draft-class-header">
      <div class="draft-class-header-title">
        <p class="eyebrow">FA Snipes |</p>
        <div class="draft-class-meta">${faRows.length} players</div>
      </div>
    </div>
    <div class="draft-class-toolbar">
      <div class="draft-class-filter-group draft-class-team-group">
        <div class="draft-class-team-filter-row">
          <label class="draft-class-select-wrap fa-snipes-team-filter-wrap">
            <span class="filter-group-label">Fantasy Team</span>
            ${renderFaCheckboxDropdown({
              filterType: "team",
              selectedSet: faSnipesFantasyTeamFilter,
              options: fantasyTeamOptions,
              triggerLabel: "Select",
            })}
          </label>
        </div>
      </div>
    </div>
    <div class="matchup-table-wrap draft-class-table-wrap fa-snipes-table-wrap">
      <table class="matchup-table draft-class-table fa-snipes-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="9">No FA snipes found for this season.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  const faTableWrap = faSnipesPane.querySelector(".fa-snipes-table-wrap");
  if (faTableWrap) {
    faTableWrap.scrollLeft = faSnipesTableScrollLeft;
    faTableWrap.addEventListener("scroll", () => {
      faSnipesTableScrollLeft = faTableWrap.scrollLeft;
    });
  }

  faSnipesPane.querySelectorAll(".matchup-sort[data-fa-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-fa-column") || "FP";
      if (faSnipesSortKey === key) {
        faSnipesSortDirection = faSnipesSortDirection === "asc" ? "desc" : "asc";
      } else {
        faSnipesSortKey = key;
        if (["FP", "FP/G"].includes(key)) {
          faSnipesSortDirection = "desc";
        } else if (["FP RK", "FP/G RK", "ROS"].includes(key)) {
          faSnipesSortDirection = "asc";
        } else {
          faSnipesSortDirection = "asc";
        }
      }
      faSnipesPageIndex = 0;
      renderFaSnipesBoard(seasonKey);
    });
  });

  faSnipesPane.querySelectorAll(".draft-multi-select")?.forEach((detailsElement) => {
    detailsElement.addEventListener("toggle", () => {
      const filterType = detailsElement.getAttribute("data-fa-multi-filter");
      if (detailsElement.open) {
        faSnipesOpenMultiFilter = filterType;
        faSnipesPane.querySelectorAll(".draft-multi-select").forEach((otherElement) => {
          if (otherElement !== detailsElement) {
            otherElement.open = false;
          }
        });
      } else if (faSnipesOpenMultiFilter === filterType) {
        faSnipesOpenMultiFilter = null;
      }
    });
  });

  faSnipesPane.querySelectorAll("[data-fa-multi-option='team']")?.forEach((input) => {
    input.addEventListener("change", () => {
      const selectedValues = Array.from(faSnipesPane.querySelectorAll("[data-fa-multi-option='team']:checked"))
        .map((checkbox) => checkbox.value);
      faSnipesFantasyTeamFilter = new Set(selectedValues);
      faSnipesOpenMultiFilter = "team";
      faSnipesPageIndex = 0;
      renderFaSnipesBoard(seasonKey);
    });
  });

  faSnipesPane.querySelectorAll("[data-fa-multi-clear]")?.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const filterType = button.getAttribute("data-fa-multi-clear");
      if (filterType === "team") {
        faSnipesFantasyTeamFilter = new Set();
      }
      faSnipesOpenMultiFilter = filterType;
      faSnipesPageIndex = 0;
      renderFaSnipesBoard(seasonKey);
    });
  });

  if (!faSnipesOutsideClickHandlerBound) {
    document.addEventListener("click", (event) => {
      if (!faSnipesPane || faSnipesPane.hidden) {
        return;
      }
      if (!(event.target instanceof Element)) {
        return;
      }
      if (event.target.closest(".draft-multi-select")) {
        return;
      }

      faSnipesOpenMultiFilter = null;
      faSnipesPane.querySelectorAll(".draft-multi-select[open]").forEach((detailsElement) => {
        detailsElement.open = false;
      });
    });
    faSnipesOutsideClickHandlerBound = true;
  }
}

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFilteredSelection(selectedSet, allowedValues) {
  return new Set([...selectedSet].filter((value) => allowedValues.includes(value)));
}

function renderDraftCheckboxDropdown({
  filterType,
  selectedSet,
  options,
  triggerLabel,
}) {
  const optionRows = options
    .map((option) => {
      const checked = selectedSet.has(option.value) ? "checked" : "";
      return `
        <label class="draft-multi-option">
          <input type="checkbox" data-multi-option="${filterType}" value="${escapeHtml(option.value)}" ${checked} />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `;
    })
    .join("");

  return `
    <details class="draft-multi-select" data-multi-filter="${filterType}" ${draftOpenMultiFilter === filterType ? "open" : ""}>
      <summary class="draft-multi-summary">${escapeHtml(triggerLabel)}</summary>
      <div class="draft-multi-menu">
        ${optionRows}
        <button class="draft-multi-clear" type="button" data-multi-clear="${filterType}">Clear</button>
      </div>
    </details>
  `;
}

function renderFaCheckboxDropdown({
  filterType,
  selectedSet,
  options,
  triggerLabel,
}) {
  const optionRows = options
    .map((option) => {
      const checked = selectedSet.has(option.value) ? "checked" : "";
      return `
        <label class="draft-multi-option">
          <input type="checkbox" data-fa-multi-option="${filterType}" value="${escapeHtml(option.value)}" ${checked} />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `;
    })
    .join("");

  return `
    <details class="draft-multi-select" data-fa-multi-filter="${filterType}" ${faSnipesOpenMultiFilter === filterType ? "open" : ""}>
      <summary class="draft-multi-summary">${escapeHtml(triggerLabel)}</summary>
      <div class="draft-multi-menu">
        ${optionRows}
        <button class="draft-multi-clear" type="button" data-fa-multi-clear="${filterType}">Clear</button>
      </div>
    </details>
  `;
}

function getDraftClassFilteredRows(seasonKey) {
  const rows = getDraftClassRows(seasonKey);

  return rows.filter((row) => {
    const roundValue = String(row?.ROUND || row?.Round || "").trim();
    const roundMatch = !draftClassRoundFilter.size || draftClassRoundFilter.has(roundValue);

    const positionValue = String(row?.POS || "").trim().toUpperCase();
    const positionBucket = getDraftClassPositionBucket(positionValue);
    const positionMatch = !draftClassPositionFilter.size || draftClassPositionFilter.has(positionBucket);

    const fantasyTeamValue = String(row?.["Fantasy Team"] || "").trim();
    const fantasyTeamMatch = !draftClassFantasyTeamFilter.size || draftClassFantasyTeamFilter.has(fantasyTeamValue);

    const nhlTeamValue = String(row?.NHLTEAM || row?.TEAM || row?.["Team"] || "").trim();
    const nhlTeamMatch = !draftClassNhlTeamFilter.size || draftClassNhlTeamFilter.has(nhlTeamValue);

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
  const pageRows = draftRows;

  const roundOptions = [...Array.from({ length: 21 }, (_, index) => `R${index + 1}`), "K"]
    .map((roundKey) => ({ value: roundKey, label: roundKey }));
  draftClassRoundFilter = getFilteredSelection(draftClassRoundFilter, roundOptions.map((option) => option.value));

  const positionOptions = ["D", "G", "F"]
    .map((positionKey) => ({ value: positionKey, label: positionKey }));
  draftClassPositionFilter = getFilteredSelection(draftClassPositionFilter, positionOptions.map((option) => option.value));

  const fantasyTeamOptions = Array.from(new Set(getDraftClassRows(seasonKey)
    .map((row) => String(row?.["Fantasy Team"] || "").trim())
    .filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((teamKey) => ({ value: teamKey, label: teamKey }));
  draftClassFantasyTeamFilter = getFilteredSelection(draftClassFantasyTeamFilter, fantasyTeamOptions.map((option) => option.value));

  const nhlTeamOptions = Array.from(new Set(getDraftClassRows(seasonKey)
    .map((row) => String(row?.NHLTEAM || row?.TEAM || row?.["Team"] || "").trim())
    .filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((teamKey) => ({ value: teamKey, label: teamKey }));
  draftClassNhlTeamFilter = getFilteredSelection(draftClassNhlTeamFilter, nhlTeamOptions.map((option) => option.value));

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
    <div class="draft-class-header">
      <div class="draft-class-header-title">
        <p class="eyebrow">Draft Class |</p>
        <div class="draft-class-meta">${draftRows.length} players</div>
      </div>
    </div>

    <div class="draft-class-toolbar">
      <div class="draft-class-filter-group draft-round-filter-group">
        <label class="draft-class-select-wrap draft-round-filter-wrap">
          <span class="filter-group-label">ROUND</span>
          ${renderDraftCheckboxDropdown({
            filterType: "round",
            selectedSet: draftClassRoundFilter,
            options: roundOptions,
            triggerLabel: "Select",
          })}
        </label>
      </div>
      <div class="draft-class-filter-group draft-position-filter-group">
        <label class="draft-class-select-wrap draft-position-filter-wrap">
          <span class="filter-group-label">Position</span>
          ${renderDraftCheckboxDropdown({
            filterType: "position",
            selectedSet: draftClassPositionFilter,
            options: positionOptions,
            triggerLabel: "Select",
          })}
        </label>
      </div>
      <div class="draft-class-filter-group draft-class-team-group">
        <div class="draft-class-team-filter-row">
          <label class="draft-class-select-wrap draft-fantasy-team-filter-wrap">
            <span class="filter-group-label">Fantasy Team</span>
            ${renderDraftCheckboxDropdown({
              filterType: "team",
              selectedSet: draftClassFantasyTeamFilter,
              options: fantasyTeamOptions,
              triggerLabel: "Select",
            })}
          </label>
          <label class="draft-class-select-wrap draft-nhlteam-filter-wrap">
            <span class="filter-group-label">NHL Team</span>
            ${renderDraftCheckboxDropdown({
              filterType: "nhlteam",
              selectedSet: draftClassNhlTeamFilter,
              options: nhlTeamOptions,
              triggerLabel: "Select",
            })}
          </label>
        </div>
      </div>
    </div>
    <div class="draft-class-vabo-note draft-class-vabo-note--full">VABO = F: Value Above Round Average. D &amp; G: Value Above Average full sample.</div>

    <div class="matchup-table-wrap draft-class-table-wrap">
      <table class="matchup-table draft-class-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="12">No players match the current filters.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  const draftClassTableWrap = draftClassPane.querySelector(".draft-class-table-wrap");
  if (draftClassTableWrap) {
    draftClassTableWrap.scrollLeft = draftClassTableScrollLeft;
    draftClassTableWrap.addEventListener("scroll", () => {
      draftClassTableScrollLeft = draftClassTableWrap.scrollLeft;
    });
  }

  draftClassPane.querySelectorAll(".draft-multi-select")?.forEach((detailsElement) => {
    detailsElement.addEventListener("toggle", () => {
      const filterType = detailsElement.getAttribute("data-multi-filter");
      if (detailsElement.open) {
        draftOpenMultiFilter = filterType;
        draftClassPane.querySelectorAll(".draft-multi-select").forEach((otherElement) => {
          if (otherElement !== detailsElement) {
            otherElement.open = false;
          }
        });
      } else if (draftOpenMultiFilter === filterType) {
        draftOpenMultiFilter = null;
      }
    });
  });

  draftClassPane.querySelectorAll("[data-multi-option='round']")?.forEach((input) => {
    input.addEventListener("change", () => {
      const selectedValues = Array.from(draftClassPane.querySelectorAll("[data-multi-option='round']:checked"))
        .map((checkbox) => checkbox.value);
      draftClassRoundFilter = new Set(selectedValues);
      draftOpenMultiFilter = "round";
      draftClassPageIndex = 0;
      renderDraftClassBoard(seasonKey);
    });
  });

  draftClassPane.querySelectorAll("[data-multi-option='position']")?.forEach((input) => {
    input.addEventListener("change", () => {
      const selectedValues = Array.from(draftClassPane.querySelectorAll("[data-multi-option='position']:checked"))
        .map((checkbox) => checkbox.value);
      draftClassPositionFilter = new Set(selectedValues);
      draftOpenMultiFilter = "position";
      draftClassPageIndex = 0;
      renderDraftClassBoard(seasonKey);
    });
  });

  draftClassPane.querySelectorAll("[data-multi-option='team']")?.forEach((input) => {
    input.addEventListener("change", () => {
      const selectedValues = Array.from(draftClassPane.querySelectorAll("[data-multi-option='team']:checked"))
        .map((checkbox) => checkbox.value);
      draftClassFantasyTeamFilter = new Set(selectedValues);
      draftOpenMultiFilter = "team";
      draftClassPageIndex = 0;
      renderDraftClassBoard(seasonKey);
    });
  });

  draftClassPane.querySelectorAll("[data-multi-option='nhlteam']")?.forEach((input) => {
    input.addEventListener("change", () => {
      const selectedValues = Array.from(draftClassPane.querySelectorAll("[data-multi-option='nhlteam']:checked"))
        .map((checkbox) => checkbox.value);
      draftClassNhlTeamFilter = new Set(selectedValues);
      draftOpenMultiFilter = "nhlteam";
      draftClassPageIndex = 0;
      renderDraftClassBoard(seasonKey);
    });
  });

  draftClassPane.querySelectorAll("[data-multi-clear]")?.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const filterType = button.getAttribute("data-multi-clear");
      if (filterType === "round") {
        draftClassRoundFilter = new Set();
      }
      if (filterType === "position") {
        draftClassPositionFilter = new Set();
      }
      if (filterType === "team") {
        draftClassFantasyTeamFilter = new Set();
      }
      if (filterType === "nhlteam") {
        draftClassNhlTeamFilter = new Set();
      }
      draftOpenMultiFilter = filterType;
      draftClassPageIndex = 0;
      renderDraftClassBoard(seasonKey);
    });
  });

  if (!draftOutsideClickHandlerBound) {
    document.addEventListener("click", (event) => {
      if (!draftClassPane || draftClassPane.hidden) {
        return;
      }
      if (!(event.target instanceof Element)) {
        return;
      }
      if (event.target.closest(".draft-multi-select")) {
        return;
      }

      draftOpenMultiFilter = null;
      draftClassPane.querySelectorAll(".draft-multi-select[open]").forEach((detailsElement) => {
        detailsElement.open = false;
      });
    });
    draftOutsideClickHandlerBound = true;
  }

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

function parseLogoConfigCsv(csvText) {
  const lines = String(csvText || "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) {
    return new Map();
  }

  const entries = new Map();
  lines.forEach((line) => {
    const delimiter = line.includes(";") ? ";" : ",";
    const columns = line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
    if (columns.length < 2) {
      return;
    }

    const teamName = columns[0];
    const logoUrl = columns[1];
    if (!teamName || !logoUrl) {
      return;
    }

    entries.set(normalizeOwnerKey(teamName), logoUrl);
  });

  return entries;
}

function getOwnerConfigUrlCandidates() {
  const candidates = new Set();
  candidates.add(ownerConfigUrl);
  candidates.add("config/owner_config.csv");
  candidates.add("/config/owner_config.csv");
  candidates.add("archived_years/owner_config.csv");
  candidates.add("/archived_years/owner_config.csv");

  try {
    const dataUrl = new URL(trophyDataUrl, window.location.href);
    const versionMatch = String(ownerConfigUrl).match(/[?&]v=([^&]+)/);
    const version = versionMatch ? `?v=${encodeURIComponent(versionMatch[1])}` : "";
    candidates.add(`${dataUrl.origin}/config/owner_config.csv${version}`);
  } catch (error) {
    // Ignore malformed URLs and proceed with local candidates.
  }

  return Array.from(candidates);
}

function getLogoConfigUrlCandidates() {
  const candidates = new Set();
  candidates.add(logoConfigUrl);
  candidates.add("config/logo_config.csv");
  candidates.add("/config/logo_config.csv");
  candidates.add("logo_config.csv");
  candidates.add("/logo_config.csv");
  candidates.add("archived_years/logo_config.csv");
  candidates.add("/archived_years/logo_config.csv");

  try {
    const dataUrl = new URL(trophyDataUrl, window.location.href);
    const versionMatch = String(logoConfigUrl).match(/[?&]v=([^&]+)/);
    const version = versionMatch ? `?v=${encodeURIComponent(versionMatch[1])}` : "";
    candidates.add(`${dataUrl.origin}/config/logo_config.csv${version}`);
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

async function loadLogoConfig() {
  try {
    const urlCandidates = getLogoConfigUrlCandidates();
    for (const url of urlCandidates) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      const entries = parseLogoConfigCsv(text);
      if (entries.size > 0) {
        teamLogoConfigMap = new Map(fallbackTeamLogoConfigMap);
        entries.forEach((logoUrl, teamKey) => {
          teamLogoConfigMap.set(teamKey, logoUrl);
        });
        return;
      }
    }

    teamLogoConfigMap = new Map(fallbackTeamLogoConfigMap);
  } catch (error) {
    teamLogoConfigMap = new Map(fallbackTeamLogoConfigMap);
  }
}

function getTeamLogoUrl(teamName) {
  if (!teamName) {
    return "";
  }

  const rawText = String(teamName).trim();
  const normalized = normalizeOwnerKey(rawText);
  const normalizedNoSpaces = normalized.replace(/\s+/g, "");

  const findLogoByTeamKey = (teamKey) => {
    const direct = teamLogoConfigMap.get(teamKey);
    if (direct) {
      return direct;
    }
    const teamKeyNoSpaces = teamKey.replace(/\s+/g, "");
    for (const [mapKey, logoUrl] of teamLogoConfigMap.entries()) {
      if (mapKey === teamKey || mapKey.replace(/\s+/g, "") === teamKeyNoSpaces) {
        return logoUrl;
      }
    }
    return "";
  };

  const findLogoByOwnerCode = (ownerCode) => {
    if (!ownerCode) {
      return "";
    }
    const normalizedOwner = normalizeOwnerKey(ownerCode);
    const normalizedOwnerNoSpaces = normalizedOwner.replace(/\s+/g, "");

    for (const [teamKey, gmName] of ownerConfigMap.entries()) {
      const gmKey = normalizeOwnerKey(gmName);
      if (gmKey === normalizedOwner || gmKey.replace(/\s+/g, "") === normalizedOwnerNoSpaces) {
        const resolved = findLogoByTeamKey(teamKey);
        if (resolved) {
          return resolved;
        }
      }
    }

    for (const [teamKey, gmName] of fallbackOwnerConfigMap.entries()) {
      const gmKey = normalizeOwnerKey(gmName);
      if (gmKey === normalizedOwner || gmKey.replace(/\s+/g, "") === normalizedOwnerNoSpaces) {
        const resolved = findLogoByTeamKey(teamKey);
        if (resolved) {
          return resolved;
        }
      }
    }

    return "";
  };

  const directLogo = teamLogoConfigMap.get(normalized);
  if (directLogo) {
    return directLogo;
  }

  for (const [mapKey, logoUrl] of teamLogoConfigMap.entries()) {
    if (mapKey === normalized || mapKey.replace(/\s+/g, "") === normalizedNoSpaces) {
      return logoUrl;
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
    const variantKey = normalizeOwnerKey(variant);
    const resolved = findLogoByTeamKey(variantKey);
    if (resolved) {
      return resolved;
    }

    const resolvedByOwner = findLogoByOwnerCode(variant);
    if (resolvedByOwner) {
      return resolvedByOwner;
    }

    for (const [mapKey, logoUrl] of teamLogoConfigMap.entries()) {
      const aliasKey = mapKey.replace(/[^a-z0-9]/gi, "");
      if (aliasKey === variant.replace(/[^a-z0-9]/gi, "")) {
        return logoUrl;
      }
    }
  }

  const resolvedByOwner = findLogoByOwnerCode(rawText);
  if (resolvedByOwner) {
    return resolvedByOwner;
  }

  return "";
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
    fa: { active: faPlayerStatsData, history: historicalFaPlayerStatsData },
    rosters: { active: rostersData, history: historicalRostersData },
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
        <p class="eyebrow bingo-board-title">BINGO BOARD</p>
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
  if (faSnipesPane) {
    renderFaSnipesBoard(seasonKey);
  }
  renderBingoBoard();
  if (tombolaPane) {
    renderTombolaBoard(seasonKey);
  }

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
  const rostersHistoryRequest = rostersHistoryDataUrl
    ? fetch(rostersHistoryDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 }))
    : Promise.resolve({ ok: false, status: 0 });

  const [trophyResponse, matchupResponse, draftClassResponse, faPlayerStatsResponse, rostersResponse, historyTrophyResponse, historyMatchupResponse, historyDraftClassResponse, historyRostersResponse] = await Promise.all([
    fetch(trophyDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(matchupDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(draftClassDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(faPlayerStatsDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(rostersDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(trophyHistoryDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(matchupHistoryDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    fetch(draftClassHistoryDataUrl, { cache: "no-store" }).catch(() => ({ ok: false, status: 0 })),
    rostersHistoryRequest,
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
  faPlayerStatsData = faPlayerStatsResponse.ok ? await faPlayerStatsResponse.json() : { season: {} };
  rostersData = rostersResponse.ok ? await rostersResponse.json() : { season: {} };
  historicalTrackerData = historyTrophyResponse.ok ? await historyTrophyResponse.json() : { season: {} };
  historicalMatchupData = historyMatchupResponse.ok ? await historyMatchupResponse.json() : { season: {} };
  historicalDraftClassData = historyDraftClassResponse.ok ? await historyDraftClassResponse.json() : { season: {} };
  historicalFaPlayerStatsData = { season: {} };
  historicalRostersData = historyRostersResponse.ok ? await historyRostersResponse.json() : { season: {} };
  await loadOwnerConfig();
  await loadLogoConfig();

  const seasonSet = new Set([
    ...Object.keys(trackerData.season || {}),
    ...Object.keys(matchupData.season || {}),
    ...Object.keys(draftClassData.season || {}),
    ...Object.keys(faPlayerStatsData.season || {}),
    ...Object.keys(rostersData.season || {}),
    ...Object.keys(historicalTrackerData.season || {}),
    ...Object.keys(historicalMatchupData.season || {}),
    ...Object.keys(historicalDraftClassData.season || {}),
    ...Object.keys(historicalFaPlayerStatsData.season || {}),
    ...Object.keys(historicalRostersData.season || {}),
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
  faSnipesPageIndex = 0;
  renderTrophies(event.target.value);
});

if (seasonSelectShell) {
  seasonSelectShell.addEventListener("click", (event) => {
    if (event.target === seasonSelect) {
      return;
    }
    openSeasonSelectMenu();
  });
}

if (seasonSelectArrow) {
  seasonSelectArrow.addEventListener("click", () => {
    openSeasonSelectMenu();
  });
}

if (tabMatchupBoard) {
  tabMatchupBoard.addEventListener("click", () => setTopBoardTab("matchup"));
}
if (tabSeasonLeaderboard) {
  tabSeasonLeaderboard.addEventListener("click", () => setTopBoardTab("leaderboard"));
}
if (tabDraftClass) {
  tabDraftClass.addEventListener("click", () => setTopBoardTab("draft-class"));
}
if (tabFaSnipes) {
  tabFaSnipes.addEventListener("click", () => setTopBoardTab("fa-snipes"));
}
if (tabBingoBoard) {
  tabBingoBoard.addEventListener("click", () => setTopBoardTab("bingo"));
}
if (tabTombolaBoard) {
  tabTombolaBoard.addEventListener("click", () => setTopBoardTab("tombola"));
}

(async () => {
  try {
    setTopBoardTab(activeTopBoardTab);
    await loadTrackerData();
  } catch (error) {
    trophyGrid.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
})();
