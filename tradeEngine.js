(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TradeEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_LINEUP_TARGETS = { F: 12, D: 4, G: 2 };

  const TRADE_ENGINE_CONFIG = {
    observedProductionWeight: 0.48,
    draftPriorWeight: 0.32,
    discrepancySignalWeight: 0.2,
    regressionRiskPenaltyWeight: 0.18,
    ageUncertaintyPenaltyWeight: 0.08,
    keeperMarketAdjustment: 0.04,
    freeAgentMarketAdjustment: -0.08,
    unknownMarketAdjustment: -0.04,
    freeAgentDraftBaseline: 0.24,
    keeperDraftBaseline: 0.72,
    unknownDraftBaseline: 0.3,
    latePickRegressionBias: 0.16,
    freeAgentRegressionBias: 0.18,
    earlyPickBuyLowBoost: 0.2,
    ageUncertaintyPerYearFrom27: 0.008,
    ageUpsideUnder24: 0.01,
    ageRiskPerYearOver31: 0.012,
    positionalScarcityWeight: 0.34,
    lineupDeltaWeight: 1.2,
    packageExpectedWeight: 0.95,
    packageMarketWeight: 0.38,
    packageRiskWeight: 0.34,
    rosterBalanceWeight: 0.52,
    fairBalancePenaltyWeight: 0.65,
    fairDraftJumpPenaltyWeight: 0.5,
    fairFaForAnchorPenaltyWeight: 0.28,
    enablePlausibilityGuardrails: true,
    twoForOneGoodPlayerRarityPenaltyFair: 0.44,
    twoForOneGoodPlayerRarityPenaltyFleece: 0.26,
    faPackageMeaningfulPickCutoff: 160,
    faForEarlyPickCutoff: 72,
    faForEarlyPickFpgMargin: 0.6,
    sideImbalanceDraftLossMin: 0.2,
    sideImbalanceUtilityFloor: 0,
    oneSidedGiverUtilityMin: 0.25,
    rareConsolidationCounterpartyMinUtility: 0.05,
    goodAssetPercentile: 0.62,
    goodAssetFallbackThreshold: 0.56,
    goodAssetMinObservedSignal: 0.45,
    fleeceCaptureWeight: 0.72,
    fleeceDraftToleranceBoost: 0.3,
    fleeceOpponentFloor: -0.28,
    fairOpponentFloor: -0.2,
    maxPlayerPoolPerTeam: 11,
    maxCombosPerSide: 28,
    maxCrossEvaluationsPerStructure: 520,
    nearDuplicateOverlapThreshold: 0.67,
    maxOutputProposals: 8,
    minimumValidFpg: 0,
  };

  function toNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  function normalizeKey(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase();
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizePosition(value) {
    const raw = String(value || "").toUpperCase();
    if (raw.includes("G")) {
      return "G";
    }
    if (raw.includes("D")) {
      return "D";
    }
    return "F";
  }

  function isRookieFlag(value) {
    const raw = String(value || "").trim().toUpperCase();
    return raw === "R" || raw === "ROOKIE" || raw === "Y";
  }

  function classifyAcquisition(draftPickRaw) {
    const raw = draftPickRaw === null || draftPickRaw === undefined ? "" : String(draftPickRaw).trim();
    if (!raw) {
      return {
        type: "FREE_AGENT",
        draftPick: null,
        label: "FA",
      };
    }

    const numeric = Number(raw);
    if (Number.isFinite(numeric) && Math.round(numeric) === 999) {
      return {
        type: "KEEPER",
        draftPick: null,
        label: "Keeper",
      };
    }

    if (Number.isFinite(numeric) && numeric > 0) {
      const normalized = Math.round(numeric);
      return {
        type: "DRAFTED",
        draftPick: normalized,
        label: `PK${normalized}`,
      };
    }

    return {
      type: "UNKNOWN",
      draftPick: null,
      label: "Unknown",
    };
  }

  function percentile(values, quantile) {
    if (!values.length) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const idx = clamp(Math.floor((sorted.length - 1) * quantile), 0, sorted.length - 1);
    return sorted[idx];
  }

  function average(values) {
    if (!values.length) {
      return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function parseDraftRound(value) {
    if (Number.isFinite(value)) {
      return Number(value);
    }

    const text = String(value || "").trim();
    if (!text) {
      return NaN;
    }

    const matched = text.match(/\d+/);
    return matched ? Number(matched[0]) : NaN;
  }

  function getDraftCurveValue(pick, maxDraftPick) {
    if (!Number.isFinite(pick) || pick <= 0 || !Number.isFinite(maxDraftPick) || maxDraftPick <= 0) {
      return 0;
    }
    return clamp(1 - (Math.log(pick + 1) / Math.log(maxDraftPick + 1)), 0, 1);
  }

  function buildReplacementValues(players, freeAgentsByPos) {
    const replacementByPos = { F: 0, D: 0, G: 0 };
    const replacementSource = { F: "fallback", D: "fallback", G: "fallback" };

    ["F", "D", "G"].forEach((position) => {
      const fromFreeAgency = (freeAgentsByPos[position] || [])
        .map((player) => player.fpg)
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => b - a);

      if (fromFreeAgency.length >= 3) {
        replacementByPos[position] = average(fromFreeAgency.slice(0, 3));
        replacementSource[position] = "free-agent";
        return;
      }

      const fromLeague = players
        .filter((player) => player.pos === position)
        .map((player) => player.fpg)
        .filter((value) => Number.isFinite(value) && value > 0);

      replacementByPos[position] = percentile(fromLeague, 0.35);
    });

    return {
      replacementByPos,
      replacementSource,
    };
  }

  function normalizeRosterPlayers(rosterRows) {
    const rawPlayers = [];

    (rosterRows || []).forEach((row) => {
      if (!row || typeof row !== "object") {
        return;
      }

      const name = normalizeText(row.Player || row.PLAYER || row.player);
      const fantasyTeam = normalizeText(row["Fantasy Team"] || row.teamName || row.TeamName || row.team);
      if (!name || !fantasyTeam) {
        return;
      }

      const draftPickRaw = row.DraftPick ?? row["Draft Pick"] ?? row.draftPick ?? row["DraftPick"];
      const draftRoundRaw = row.DraftRound ?? row["Draft Round"] ?? row.draftRound;
      const acquisition = classifyAcquisition(draftPickRaw);
      const idBase = normalizeText(row.playerID || row.ID || row.Id || row.playerId);
      const stableId = idBase || `${normalizeKey(fantasyTeam)}:${normalizeKey(name)}`;

      rawPlayers.push({
        id: stableId,
        uniqueId: `${normalizeKey(fantasyTeam)}:${stableId}`,
        name,
        fantasyTeam,
        nhlTeam: normalizeText(row.Team || row.NHLTEAM || row["NHL Team"]),
        pos: normalizePosition(row.Position || row.POS || row.Pos),
        rookie: isRookieFlag(row.Rookie),
        age: toNumber(row.Age, NaN),
        fpg: toNumber(row["FP/G"], NaN),
        fpts: toNumber(row.FPts, NaN),
        rkov: normalizeText(row.RkOv),
        ros: toNumber(row.Ros, toNumber(row.ROS, 0)),
        acquisitionType: acquisition.type,
        acquisitionLabel: acquisition.label,
        draftPick: acquisition.draftPick,
        draftPickRaw,
        draftRoundRaw,
        draftRound: toNumber(draftRoundRaw, NaN),
      });
    });

    const byUniqueId = new Map();
    rawPlayers.forEach((player) => {
      const existing = byUniqueId.get(player.uniqueId);
      if (!existing || (Number.isFinite(player.fpg) && player.fpg > existing.fpg)) {
        byUniqueId.set(player.uniqueId, player);
      }
    });

    return Array.from(byUniqueId.values());
  }

  function normalizeFreeAgentPlayers(faRows) {
    const freeAgentsByPos = { F: [], D: [], G: [] };

    (faRows || []).forEach((row) => {
      if (!row || typeof row !== "object") {
        return;
      }

      const statusRaw = String(row.STATUS || row.Status || "").toUpperCase();
      const fantasyTeam = normalizeText(row["FANTASY TEAM"] || row["Fantasy Team"] || row.fantasyTeam || "");
      const isFreeAgent = statusRaw === "FA" || statusRaw.startsWith("W ") || !fantasyTeam;
      if (!isFreeAgent) {
        return;
      }

      const name = normalizeText(row.PLAYER || row.Player || row.player);
      if (!name) {
        return;
      }

      const pos = normalizePosition(row.POS || row.Position || row.Pos);
      const fpg = toNumber(row["FP/G"], NaN);
      if (!Number.isFinite(fpg) || fpg <= 0) {
        return;
      }

      freeAgentsByPos[pos].push({
        name,
        pos,
        fpg,
      });
    });

    return freeAgentsByPos;
  }

  function enrichPlayerValuations(players, config) {
    const validFpg = players.map((player) => player.fpg).filter((value) => Number.isFinite(value) && value >= config.minimumValidFpg);
    const validFpts = players.map((player) => player.fpts).filter((value) => Number.isFinite(value));
    const draftPicks = players
      .map((player) => player.draftPick)
      .filter((value) => Number.isFinite(value) && value > 0);

    const minFpg = validFpg.length ? Math.min(...validFpg) : 0;
    const maxFpg = validFpg.length ? Math.max(...validFpg) : 1;
    const fpgRange = Math.max(0.001, maxFpg - minFpg);

    const minFpts = validFpts.length ? Math.min(...validFpts) : 0;
    const maxFpts = validFpts.length ? Math.max(...validFpts) : 1;
    const fptsRange = Math.max(0.001, maxFpts - minFpts);

    const maxDraftPick = draftPicks.length ? Math.max(...draftPicks) : 240;

    return players.map((player) => {
      const fpgSafe = Number.isFinite(player.fpg) ? player.fpg : 0;
      const fptsSafe = Number.isFinite(player.fpts) ? player.fpts : 0;

      const observedProduction = clamp((fpgSafe - minFpg) / fpgRange, 0, 1);
      const totalsNorm = clamp((fptsSafe - minFpts) / fptsRange, 0, 1);
      const observedSignal = clamp((observedProduction * 0.78) + (totalsNorm * 0.22), 0, 1);

      let draftExpectedValue;
      if (player.acquisitionType === "DRAFTED" && Number.isFinite(player.draftPick) && player.draftPick > 0) {
        draftExpectedValue = getDraftCurveValue(player.draftPick, maxDraftPick);
      } else if (player.acquisitionType === "KEEPER") {
        draftExpectedValue = config.keeperDraftBaseline;
      } else if (player.acquisitionType === "FREE_AGENT") {
        draftExpectedValue = config.freeAgentDraftBaseline;
      } else {
        draftExpectedValue = config.unknownDraftBaseline;
      }

      const discrepancy = clamp(observedSignal - draftExpectedValue, -1, 1);
      const overperformance = Math.max(0, discrepancy);
      const underperformance = Math.max(0, -discrepancy);

      let regressionRisk = overperformance * (1 - draftExpectedValue) * (1 + config.latePickRegressionBias);
      if (player.acquisitionType === "FREE_AGENT") {
        regressionRisk += config.freeAgentRegressionBias * overperformance;
      }
      if (player.acquisitionType === "KEEPER") {
        regressionRisk *= 0.88;
      }
      regressionRisk = clamp(regressionRisk, 0, 1);

      let ageUncertainty = 0;
      if (Number.isFinite(player.age) && player.age > 0) {
        ageUncertainty += Math.abs(player.age - 27) * config.ageUncertaintyPerYearFrom27;
        if (player.age > 31) {
          ageUncertainty += (player.age - 31) * config.ageRiskPerYearOver31;
        }
      }
      ageUncertainty = clamp(ageUncertainty, 0, 0.35);

      let ageAdjustment = 0;
      if (Number.isFinite(player.age) && player.age < 24) {
        ageAdjustment += config.ageUpsideUnder24;
      }

      const buyLowSignal = clamp(underperformance * draftExpectedValue * (1 + config.earlyPickBuyLowBoost), 0, 1);
      const sellHighSignal = clamp(overperformance * (1 - draftExpectedValue), 0, 1);
      const breakoutSignal = clamp(overperformance * observedSignal * (1 - regressionRisk * 0.5), 0, 1);

      let marketAdjustment = 0;
      if (player.acquisitionType === "KEEPER") {
        marketAdjustment = config.keeperMarketAdjustment;
      } else if (player.acquisitionType === "FREE_AGENT") {
        marketAdjustment = config.freeAgentMarketAdjustment;
      } else if (player.acquisitionType === "UNKNOWN") {
        marketAdjustment = config.unknownMarketAdjustment;
      }

      const marketPerceivedValue = clamp(
        (draftExpectedValue * 0.62)
          + (observedSignal * 0.38)
          + marketAdjustment,
        0,
        1
      );

      const expectedValue = clamp(
        (observedSignal * config.observedProductionWeight)
          + (draftExpectedValue * config.draftPriorWeight)
          + (buyLowSignal * config.discrepancySignalWeight)
          + ageAdjustment
          - (regressionRisk * config.regressionRiskPenaltyWeight)
          - (ageUncertainty * config.ageUncertaintyPenaltyWeight),
        0,
        1
      );

      const opportunityGap = clamp(expectedValue - marketPerceivedValue, -1, 1);

      let opportunityType = "balanced";
      if (buyLowSignal >= sellHighSignal && buyLowSignal >= breakoutSignal && buyLowSignal > 0.12) {
        opportunityType = "buy-low";
      } else if (sellHighSignal >= buyLowSignal && sellHighSignal >= breakoutSignal && sellHighSignal > 0.12) {
        opportunityType = "sell-high";
      } else if (breakoutSignal > 0.14) {
        opportunityType = "breakout";
      }

      return {
        ...player,
        observedProduction,
        observedSignal,
        draftExpectedValue,
        discrepancy,
        regressionRisk,
        ageUncertainty,
        buyLowSignal,
        sellHighSignal,
        breakoutSignal,
        marketPerceivedValue,
        expectedValue,
        opportunityGap,
        opportunityType,
      };
    });
  }

  function buildTeamProfiles(players, lineupTargets, replacementByPos, config) {
    const teamMap = new Map();
    players.forEach((player) => {
      if (!teamMap.has(player.fantasyTeam)) {
        teamMap.set(player.fantasyTeam, []);
      }
      teamMap.get(player.fantasyTeam).push(player);
    });

    const teamProfiles = new Map();

    for (const [teamName, teamPlayers] of teamMap.entries()) {
      const byPos = {
        F: teamPlayers.filter((player) => player.pos === "F"),
        D: teamPlayers.filter((player) => player.pos === "D"),
        G: teamPlayers.filter((player) => player.pos === "G"),
      };

      Object.values(byPos).forEach((list) => {
        list.sort((left, right) => {
          if (right.observedSignal !== left.observedSignal) {
            return right.observedSignal - left.observedSignal;
          }
          return left.uniqueId.localeCompare(right.uniqueId);
        });
      });

      const counts = {
        F: byPos.F.length,
        D: byPos.D.length,
        G: byPos.G.length,
      };

      const needs = {
        F: Math.max(0, lineupTargets.F - counts.F),
        D: Math.max(0, lineupTargets.D - counts.D),
        G: Math.max(0, lineupTargets.G - counts.G),
      };

      const surplus = {
        F: Math.max(0, counts.F - lineupTargets.F),
        D: Math.max(0, counts.D - lineupTargets.D),
        G: Math.max(0, counts.G - lineupTargets.G),
      };

      const replacementCosts = {
        F: replacementByPos.F,
        D: replacementByPos.D,
        G: replacementByPos.G,
      };

      const tradeabilityScoreById = new Map();
      teamPlayers.forEach((player) => {
        const needPenalty = needs[player.pos] * 0.16;
        const surplusBoost = surplus[player.pos] * 0.13;
        const sellHighBias = player.sellHighSignal * 0.3;
        const marketPremium = clamp(player.marketPerceivedValue - player.expectedValue, -1, 1) * 0.26;
        const score = (player.marketPerceivedValue * 0.34)
          + (player.observedSignal * 0.16)
          + sellHighBias
          + marketPremium
          + surplusBoost
          - needPenalty;
        tradeabilityScoreById.set(player.uniqueId, score);
      });

      const targetabilityScoreById = new Map();
      teamPlayers.forEach((player) => {
        const needBoost = needs[player.pos] * 0.2;
        const scarcityBoost = Math.max(0, (lineupTargets[player.pos] - counts[player.pos])) * 0.05;
        const score = (player.expectedValue * 0.42)
          + (player.buyLowSignal * 0.25)
          + (player.breakoutSignal * 0.18)
          + (player.observedSignal * 0.1)
          - (player.regressionRisk * 0.12)
          + needBoost
          + scarcityBoost;
        targetabilityScoreById.set(player.uniqueId, score);
      });

      teamProfiles.set(teamName, {
        teamName,
        players: [...teamPlayers].sort((left, right) => left.uniqueId.localeCompare(right.uniqueId)),
        byPos,
        counts,
        needs,
        surplus,
        lineupTargets,
        replacementCosts,
        positionalTotals: {
          F: sum(byPos.F.map((player) => Number.isFinite(player.fpg) ? player.fpg : 0)),
          D: sum(byPos.D.map((player) => Number.isFinite(player.fpg) ? player.fpg : 0)),
          G: sum(byPos.G.map((player) => Number.isFinite(player.fpg) ? player.fpg : 0)),
        },
        positionalAverages: {
          F: average(byPos.F.map((player) => Number.isFinite(player.fpg) ? player.fpg : 0)),
          D: average(byPos.D.map((player) => Number.isFinite(player.fpg) ? player.fpg : 0)),
          G: average(byPos.G.map((player) => Number.isFinite(player.fpg) ? player.fpg : 0)),
        },
        tradeabilityScoreById,
        targetabilityScoreById,
      });
    }

    return { teamMap, teamProfiles };
  }

  function getLineupStrength(players, lineupTargets, replacementByPos) {
    const grouped = { F: [], D: [], G: [] };
    players.forEach((player) => {
      grouped[player.pos].push(player.fpg);
    });

    let strength = 0;
    const shortages = { F: 0, D: 0, G: 0 };
    const lineupByPos = { F: 0, D: 0, G: 0 };

    ["F", "D", "G"].forEach((position) => {
      const values = grouped[position].filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => b - a);
      const needed = lineupTargets[position];
      const chosen = values.slice(0, needed);
      const chosenSum = chosen.reduce((sum, value) => sum + value, 0);
      lineupByPos[position] = chosenSum;
      strength += chosenSum;

      const missing = Math.max(0, needed - chosen.length);
      shortages[position] = missing;
      if (missing > 0) {
        strength += replacementByPos[position] * missing;
      }
    });

    return {
      strength,
      shortages,
      lineupByPos,
    };
  }

  function evaluateTeamDelta(profile, outgoingPlayers, incomingPlayers, config) {
    const outgoingSet = new Set(outgoingPlayers.map((player) => player.uniqueId));
    const incomingSet = new Set(incomingPlayers.map((player) => player.uniqueId));

    const beforePlayers = profile.players;
    const afterPlayers = beforePlayers
      .filter((player) => !outgoingSet.has(player.uniqueId))
      .concat(incomingPlayers.filter((player) => !incomingSet.has(player.uniqueId) || !beforePlayers.some((p) => p.uniqueId === player.uniqueId)));

    const beforeState = getLineupStrength(beforePlayers, profile.lineupTargets, profile.replacementCosts);
    const afterState = getLineupStrength(afterPlayers, profile.lineupTargets, profile.replacementCosts);

    const getPosCounts = (players) => players.reduce((acc, player) => {
      acc[player.pos] += 1;
      return acc;
    }, { F: 0, D: 0, G: 0 });

    const beforeCounts = getPosCounts(beforePlayers);
    const afterCounts = getPosCounts(afterPlayers);

    const beforeDeviation = ["F", "D", "G"].reduce((total, pos) => {
      return total + Math.abs(beforeCounts[pos] - profile.lineupTargets[pos]);
    }, 0);

    const afterDeviation = ["F", "D", "G"].reduce((total, pos) => {
      return total + Math.abs(afterCounts[pos] - profile.lineupTargets[pos]);
    }, 0);

    const rosterBalanceGain = beforeDeviation - afterDeviation;

    const outgoingExpectedValue = sum(outgoingPlayers.map((player) => player.expectedValue));
    const incomingExpectedValue = sum(incomingPlayers.map((player) => player.expectedValue));

    const outgoingMarketValue = sum(outgoingPlayers.map((player) => player.marketPerceivedValue));
    const incomingMarketValue = sum(incomingPlayers.map((player) => player.marketPerceivedValue));

    const outgoingRiskCost = sum(outgoingPlayers.map((player) => player.regressionRisk + player.ageUncertainty));
    const incomingRiskCost = sum(incomingPlayers.map((player) => player.regressionRisk + player.ageUncertainty));

    const lineupDelta = afterState.strength - beforeState.strength;
    const baselineStrength = Math.max(1, beforeState.strength);
    const lineupDeltaNormalized = lineupDelta / baselineStrength;
    const packageExpectedDelta = incomingExpectedValue - outgoingExpectedValue;
    const packageMarketDelta = incomingMarketValue - outgoingMarketValue;
    const riskDelta = incomingRiskCost - outgoingRiskCost;
    const shortageDelta = ["F", "D", "G"].reduce((sum, pos) => sum + (beforeState.shortages[pos] - afterState.shortages[pos]), 0);

    const totalDelta = (lineupDeltaNormalized * config.lineupDeltaWeight)
      + (packageExpectedDelta * config.packageExpectedWeight)
      + (packageMarketDelta * config.packageMarketWeight)
      + (shortageDelta * config.positionalScarcityWeight)
      + (rosterBalanceGain * config.rosterBalanceWeight)
      - (riskDelta * config.packageRiskWeight);

    return {
      totalDelta,
      lineupDelta,
      lineupDeltaNormalized,
      packageExpectedDelta,
      packageMarketDelta,
      riskDelta,
      shortageDelta,
      rosterBalanceGain,
      beforeCounts,
      afterCounts,
      beforeState,
      afterState,
    };
  }

  function chooseCombinations(players, count, lockedPlayers, scoreById, maxCombos) {
    if (count < lockedPlayers.length) {
      return [];
    }

    const lockedIds = new Set(lockedPlayers.map((player) => player.uniqueId));
    const freePlayers = players.filter((player) => !lockedIds.has(player.uniqueId));
    const remainingCount = count - lockedPlayers.length;

    const picks = [];

    function recurse(startIndex, chosen) {
      if (chosen.length === remainingCount) {
        const combo = lockedPlayers.concat(chosen);
        const comboScore = combo.reduce((sum, player) => sum + (scoreById.get(player.uniqueId) || 0), 0);
        const signature = combo.map((player) => player.uniqueId).sort().join("|");
        picks.push({ combo, comboScore, signature });
        return;
      }

      for (let index = startIndex; index < freePlayers.length; index += 1) {
        chosen.push(freePlayers[index]);
        recurse(index + 1, chosen);
        chosen.pop();
      }
    }

    recurse(0, []);

    picks.sort((left, right) => {
      if (right.comboScore !== left.comboScore) {
        return right.comboScore - left.comboScore;
      }
      return left.signature.localeCompare(right.signature);
    });

    return picks.slice(0, maxCombos).map((entry) => entry.combo);
  }

  function buildCandidatePool(profile, scoreById, options) {
    const requiredPos = normalizeText(options?.requiredPos).toUpperCase();
    const excludeGoalies = !!options?.excludeGoalies;
    const fixedPlayers = options?.fixedPlayers || [];
    const baseMaxPool = Math.max(1, toNumber(options?.maxPool, 1));

    const eligible = profile.players
      .filter((player) => !excludeGoalies || player.pos !== "G")
      .sort((left, right) => {
        const scoreDiff = (scoreById.get(right.uniqueId) || 0) - (scoreById.get(left.uniqueId) || 0);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return left.uniqueId.localeCompare(right.uniqueId);
      });

    const fixedById = new Map(fixedPlayers.map((player) => [player.uniqueId, player]));
    const requiredCandidates = requiredPos
      ? eligible.filter((player) => player.pos === requiredPos)
      : [];

    const prioritized = [];
    const seen = new Set();
    const tryPush = (player) => {
      if (!player || seen.has(player.uniqueId)) {
        return;
      }
      seen.add(player.uniqueId);
      prioritized.push(player);
    };

    fixedPlayers.forEach(tryPush);
    requiredCandidates.forEach(tryPush);
    eligible.forEach(tryPush);

    const requiredCount = requiredCandidates.length;
    const poolLimit = Math.max(baseMaxPool, fixedById.size, requiredCount);
    return prioritized.slice(0, poolLimit);
  }

  function buildNoProposalReason(contextInfo) {
    const {
      fromTeamName,
      toTeamName,
      sendPosFilter,
      getPosFilter,
      getPosRequirePlusOne,
      mode,
      checkedCombos,
      rejectedBySend,
      rejectedByGet,
      rejectedByModeFloor,
      rejectedByDraftFpgRule,
      rejectedByGetPlusOne = 0,
      skippedByStructures,
      missingOutgoingCombos,
      missingIncomingCombos,
      missingSendPosOnOutgoingPool,
      missingGetPosOnIncomingPool,
    } = contextInfo;

    if (sendPosFilter && missingSendPosOnOutgoingPool > 0 && checkedCombos === 0) {
      return `${fromTeamName} has no eligible ${sendPosFilter} candidates in the current outgoing pool after active constraints.`;
    }

    if (getPosFilter && missingGetPosOnIncomingPool > 0 && checkedCombos === 0) {
      const targetScope = toTeamName || "eligible opponents";
      return `No eligible ${getPosFilter} targets were found on ${targetScope} after active constraints.`;
    }

    if (sendPosFilter && rejectedBySend > 0 && rejectedBySend >= rejectedByGet && rejectedBySend >= rejectedByModeFloor) {
      return `No trades satisfied SEND ${sendPosFilter} (from team must net-send at least one ${sendPosFilter}).`;
    }

    if (getPosFilter && getPosRequirePlusOne && rejectedByGetPlusOne > 0
      && rejectedByGetPlusOne >= rejectedBySend && rejectedByGetPlusOne >= rejectedByModeFloor
      && rejectedByGetPlusOne >= rejectedByDraftFpgRule) {
      return `No trades satisfied GET ${getPosFilter} +1 (from team must net-receive exactly one ${getPosFilter}).`;
    }

    if (getPosFilter && rejectedByGet > 0 && rejectedByGet >= rejectedBySend && rejectedByGet >= rejectedByModeFloor) {
      return getPosRequirePlusOne
        ? `No trades satisfied GET ${getPosFilter} +1 (from team must net-receive exactly one ${getPosFilter}).`
        : `No trades satisfied GET ${getPosFilter} (from team must receive at least one ${getPosFilter} in the package).`;
    }

    if (rejectedByModeFloor > 0 && rejectedByModeFloor >= rejectedBySend && rejectedByModeFloor >= rejectedByGet) {
      return mode === "fleece"
        ? "No proposals passed fleece viability thresholds for both teams under current filters."
        : "No proposals passed fair-balance viability thresholds for both teams under current filters.";
    }

    if (rejectedByDraftFpgRule > 0 && rejectedByDraftFpgRule >= rejectedByModeFloor) {
      return "No proposals passed the trade-plausibility guardrails (draft pick, FP/G and two-sided value checks).";
    }

    if (missingOutgoingCombos > 0 || missingIncomingCombos > 0 || skippedByStructures > 0) {
      return "Roster-size and fixed-player constraints left no valid trade structures for the selected teams.";
    }

    return "No valid proposals met all selected constraints and roster-feasibility checks.";
  }

  function getTradeStructures(singleTradeOnly, tradeStructure) {
    const normalizedStructure = normalizeText(tradeStructure);
    if (normalizedStructure === "1:1") {
      return [[1, 1]];
    }
    if (normalizedStructure === "1:2") {
      return [[1, 2]];
    }
    if (normalizedStructure === "2:1") {
      return [[2, 1]];
    }

    if (singleTradeOnly) {
      return [[1, 1]];
    }

    return [
      [1, 1], [1, 2], [1, 3],
      [2, 1], [2, 2], [2, 3],
      [3, 1], [3, 2], [3, 3],
    ];
  }

  const GUARDRAIL_REASONS = [
    "draft_and_fpg_dominated",
    "implausible_asset_exchange",
    "two_sided_value_imbalance",
  ];

  // Only ordinary fantasy draft picks are comparable by pick number.
  // Keepers (999) and free agents (blank) are separate categories and never enter this comparison.
  function isOrdinaryDrafted(player) {
    return player?.acquisitionType === "DRAFTED"
      && Number.isFinite(player.draftPick)
      && player.draftPick > 0;
  }

  // True when `betterPlayer` has an earlier ordinary pick AND higher FP/G than `otherPlayer`.
  function isDraftAndFpgDominance(betterPlayer, otherPlayer) {
    if (!isOrdinaryDrafted(betterPlayer) || !isOrdinaryDrafted(otherPlayer)) {
      return false;
    }

    const betterFpg = Number(betterPlayer.fpg);
    const otherFpg = Number(otherPlayer.fpg);
    if (!Number.isFinite(betterFpg) || !Number.isFinite(otherFpg)) {
      return false;
    }

    return betterPlayer.draftPick < otherPlayer.draftPick && betterFpg > otherFpg;
  }

  function isGoodPlayerAsset(player, threshold, minObservedSignal) {
    return Number.isFinite(player?.expectedValue)
      && Number.isFinite(player?.observedSignal)
      && player.expectedValue >= threshold
      && player.observedSignal >= minObservedSignal;
  }

  function getGoodAssetThreshold(profile, config) {
    const values = (profile?.players || [])
      .map((player) => player.expectedValue)
      .filter((value) => Number.isFinite(value));
    return percentile(values, config.goodAssetPercentile) || config.goodAssetFallbackThreshold;
  }

  function isSingleFaType(player) {
    const type = String(player?.acquisitionType || "");
    return type === "FREE_AGENT" || type === "UNKNOWN";
  }

  // Evaluates one manager's side of a trade. `given` is what that manager sends, `received` what they get.
  // Returns the first guardrail reason that fails, plus whether this is a (rare) two-strong-for-one-better trade.
  function assessTradeSide(side, config, mode) {
    const { given, received } = side;
    const receivedSingle = received.length === 1 ? received[0] : null;
    const outcome = { reasons: [], rareConsolidation: false };

    // 1. Hard rule (1:1 and 2:1 from this manager's view): never give up a player who is better on BOTH
    //    ordinary draft pick and FP/G than the single player received.
    if (receivedSingle
      && (given.length === 1 || given.length === 2)
      && given.some((player) => isDraftAndFpgDominance(player, receivedSingle))) {
      outcome.reasons.push("draft_and_fpg_dominated");
    }

    // 2. Draft assets for a single free agent are not a normal exchange.
    if (receivedSingle && isSingleFaType(receivedSingle)) {
      const ordinaryPicks = given.filter(isOrdinaryDrafted);
      if (ordinaryPicks.length >= 2
        && ordinaryPicks.some((player) => player.draftPick <= config.faPackageMeaningfulPickCutoff)) {
        outcome.reasons.push("implausible_asset_exchange");
      } else if (mode === "fair"
        && given.length === 1
        && isOrdinaryDrafted(given[0])
        && given[0].draftPick <= config.faForEarlyPickCutoff) {
        const fpgGap = Number(receivedSingle.fpg) - Number(given[0].fpg);
        if (!(fpgGap >= config.faForEarlyPickFpgMargin)) {
          outcome.reasons.push("implausible_asset_exchange");
        }
      }
    }

    // 3. Two strong players for one better (earlier pick + higher FP/G) player is rare: both must be genuinely
    //    strong assets and the counterparty must have a real reason to accept.
    if (receivedSingle
      && given.length === 2
      && given.every((player) => isDraftAndFpgDominance(receivedSingle, player))) {
      const bothGood = given.every((player) => isGoodPlayerAsset(player, side.goodAssetThreshold, config.goodAssetMinObservedSignal));
      if (!bothGood) {
        outcome.reasons.push("implausible_asset_exchange");
      } else if (!(side.counterpartyUtility >= config.rareConsolidationCounterpartyMinUtility)) {
        outcome.reasons.push("two_sided_value_imbalance");
      } else {
        outcome.rareConsolidation = true;
      }
    }

    // 4. Two-sided check: a manager who gives up clearly more draft value AND the best FP/G asset, with no
    //    roster-specific utility to compensate, would not plausibly accept.
    // 4. Two-sided check: a manager who gives up the best draft asset AND the best FP/G asset by a clear margin,
    //    with no roster-specific utility to compensate, would not plausibly accept. Best assets are compared
    //    (not sums) so that sending more players is not mistaken for sending more value.
    const bestGivenDraft = Math.max(...given.map((player) => player.draftExpectedValue));
    const bestReceivedDraft = Math.max(...received.map((player) => player.draftExpectedValue));
    const draftMargin = bestGivenDraft - bestReceivedDraft;
    const bestGivenFpg = Math.max(...given.map((player) => (Number.isFinite(player.fpg) ? player.fpg : -Infinity)));
    const bestReceivedFpg = Math.max(...received.map((player) => (Number.isFinite(player.fpg) ? player.fpg : -Infinity)));
    if (draftMargin > config.sideImbalanceDraftLossMin
      && bestGivenFpg > bestReceivedFpg
      && side.utility < config.sideImbalanceUtilityFloor) {
      outcome.reasons.push("two_sided_value_imbalance");
    }

    // 5. Overwhelmingly one-sided package: a manager gives MORE players including the better draft asset and the
    //    higher-FP/G asset, yet receives fewer players. Only a strong roster-specific gain can justify it.
    if (given.length > received.length
      && draftMargin > 0
      && bestGivenFpg > bestReceivedFpg
      && side.utility < config.oneSidedGiverUtilityMin) {
      outcome.reasons.push("two_sided_value_imbalance");
    }

    return outcome;
  }

  // Dedicated plausibility step, separate from valuation. Evaluates both managers' perspectives and never
  // reverses the proposal direction. Rejection reasons are explainable via GUARDRAIL_REASONS.
  function validateTradePlausibility(params) {
    const config = { ...TRADE_ENGINE_CONFIG, ...(params?.config || {}) };
    const mode = params?.mode === "fleece" ? "fleece" : "fair";
    const outgoingPlayers = params?.outgoingPlayers || [];
    const incomingPlayers = params?.incomingPlayers || [];
    const fromUtility = toNumber(params?.fromUtility, 0);
    const toUtility = toNumber(params?.toUtility, 0);

    if (!config.enablePlausibilityGuardrails || !outgoingPlayers.length || !incomingPlayers.length) {
      return { ok: true, reason: "", reasons: [], rareConsolidation: false };
    }

    const fromOutcome = assessTradeSide({
      given: outgoingPlayers,
      received: incomingPlayers,
      utility: fromUtility,
      counterpartyUtility: toUtility,
      goodAssetThreshold: toNumber(params?.goodAssetThresholdFrom, config.goodAssetFallbackThreshold),
    }, config, mode);

    const toOutcome = assessTradeSide({
      given: incomingPlayers,
      received: outgoingPlayers,
      utility: toUtility,
      counterpartyUtility: fromUtility,
      goodAssetThreshold: toNumber(params?.goodAssetThresholdTo, config.goodAssetFallbackThreshold),
    }, config, mode);

    const reasons = fromOutcome.reasons.concat(toOutcome.reasons);
    if (reasons.length) {
      const reason = GUARDRAIL_REASONS.find((candidate) => reasons.includes(candidate)) || reasons[0];
      return { ok: false, reason, reasons, rareConsolidation: false };
    }

    return {
      ok: true,
      reason: "",
      reasons: [],
      rareConsolidation: fromOutcome.rareConsolidation || toOutcome.rareConsolidation,
    };
  }

  function packageSignature(fromTeamName, toTeamName, outgoingPlayers, incomingPlayers) {
    const outgoing = outgoingPlayers.map((player) => player.uniqueId).sort().join(",");
    const incoming = incomingPlayers.map((player) => player.uniqueId).sort().join(",");
    return `${fromTeamName}|${toTeamName}|${outgoing}|${incoming}`;
  }

  function overlapRatio(leftIds, rightIds) {
    const left = new Set(leftIds);
    const right = new Set(rightIds);
    const intersection = [...left].filter((id) => right.has(id)).length;
    const denominator = Math.max(1, Math.min(left.size, right.size));
    return intersection / denominator;
  }

  function isNearDuplicate(existing, candidate, threshold) {
    if (existing.toTeamName !== candidate.toTeamName) {
      return false;
    }

    const existingOutgoing = existing.outgoingPlayers.map((player) => player.uniqueId);
    const existingIncoming = existing.incomingPlayers.map((player) => player.uniqueId);
    const candidateOutgoing = candidate.outgoingPlayers.map((player) => player.uniqueId);
    const candidateIncoming = candidate.incomingPlayers.map((player) => player.uniqueId);

    return overlapRatio(existingOutgoing, candidateOutgoing) >= threshold
      && overlapRatio(existingIncoming, candidateIncoming) >= threshold;
  }

  function buildRationale(mode, fromTeamName, toTeamName, scoring, fromDelta, toDelta, outgoingPlayers, incomingPlayers, replacementSource) {
    const lines = [];
    const structure = `${outgoingPlayers.length}:${incomingPlayers.length}`;
    lines.push(`Structure ${structure}: ${fromTeamName} sends ${outgoingPlayers.length}, receives ${incomingPlayers.length}.`);

    const observedDelta = incomingPlayers.reduce((sum, player) => sum + player.fpg, 0) - outgoingPlayers.reduce((sum, player) => sum + player.fpg, 0);
    lines.push(`Observed FP/G swing for ${fromTeamName}: ${observedDelta >= 0 ? "+" : ""}${observedDelta.toFixed(2)} (current-season).`);

    const outgoingDraft = sum(outgoingPlayers.map((player) => player.draftExpectedValue));
    const incomingDraft = sum(incomingPlayers.map((player) => player.draftExpectedValue));
    lines.push(`Draft-prior balance (heuristic): ${fromTeamName} ${incomingDraft >= outgoingDraft ? "gains" : "gives"} ${(Math.abs(incomingDraft - outgoingDraft)).toFixed(2)} draft-value units.`);

    const outgoingRegression = average(outgoingPlayers.map((player) => player.regressionRisk));
    const incomingRegression = average(incomingPlayers.map((player) => player.regressionRisk));
    lines.push(`Regression-uncertainty shift (heuristic): ${fromTeamName} ${incomingRegression <= outgoingRegression ? "reduces" : "adds"} uncertainty (${incomingRegression.toFixed(2)} vs ${outgoingRegression.toFixed(2)}).`);

    const outgoingBuyLow = outgoingPlayers.filter((player) => player.opportunityType === "buy-low").length;
    const incomingBuyLow = incomingPlayers.filter((player) => player.opportunityType === "buy-low").length;
    const outgoingSellHigh = outgoingPlayers.filter((player) => player.opportunityType === "sell-high").length;
    const incomingSellHigh = incomingPlayers.filter((player) => player.opportunityType === "sell-high").length;
    lines.push(`Opportunity mix: incoming buy-low ${incomingBuyLow}, incoming sell-high ${incomingSellHigh}, outgoing buy-low ${outgoingBuyLow}, outgoing sell-high ${outgoingSellHigh}.`);

    if (mode === "fleece") {
      lines.push("Fleece mode emphasizes value-capture opportunities from market-prior vs current-production discrepancies, while keeping minimum opponent plausibility.");
    } else {
      lines.push("Fair mode prioritizes two-way plausibility: package value, lineup impact, and manageable draft-prior jumps for both teams.");
    }

    lines.push(`Lineup impact estimate: ${fromTeamName} ${fromDelta.lineupDelta >= 0 ? "+" : ""}${fromDelta.lineupDelta.toFixed(2)} FP/G, ${toTeamName} ${toDelta.lineupDelta >= 0 ? "+" : ""}${toDelta.lineupDelta.toFixed(2)} FP/G.`);
    lines.push(`Roster-balance effect: ${fromTeamName} ${fromDelta.rosterBalanceGain >= 0 ? "+" : ""}${fromDelta.rosterBalanceGain.toFixed(2)}, ${toTeamName} ${toDelta.rosterBalanceGain >= 0 ? "+" : ""}${toDelta.rosterBalanceGain.toFixed(2)} (closer to target composition).`);

    const replacementNote = ["F", "D", "G"]
      .filter((pos) => replacementSource[pos] !== "free-agent")
      .map((pos) => pos)
      .join(", ");

    if (replacementNote) {
      lines.push(`Replacement-level for ${replacementNote} uses fallback league baselines because sufficient FA samples were unavailable.`);
    }

    lines.push("Main risk: all regression and market-mispricing signals are deterministic heuristics from current FP/G, draft position, age, and roster composition (no historical model)." );
    return lines;
  }

  function buildDisplayMeta(player) {
    const ageText = Number.isFinite(player.age) && player.age > 0 ? `Age ${Math.round(player.age)}` : "Age --";
    return `${player.pos} | FP/G ${Number.isFinite(player.fpg) ? player.fpg.toFixed(2) : "--"} | ${ageText} | ${player.acquisitionLabel}`;
  }

  function validateFixedSelections(context, fromTeamName, toTeamName, fixedOutgoingIds, fixedIncomingIds) {
    const fromProfile = context.teamProfiles.get(fromTeamName);
    if (!fromProfile) {
      return { ok: false, reason: "Select a valid From Fantasy Team first." };
    }

    const resolveSelection = (profile, rawId) => {
      const normalized = normalizeText(rawId);
      if (!normalized) {
        return null;
      }

      const exactUnique = profile.players.find((player) => player.uniqueId === normalized);
      if (exactUnique) {
        return exactUnique;
      }

      const byStableId = profile.players.find((player) => player.id === normalized);
      if (byStableId) {
        return byStableId;
      }

      return null;
    };

    const resolvedOutgoingUniqueIds = new Set();
    const resolvedIncomingUniqueIds = new Set();

    for (const id of fixedOutgoingIds) {
      const resolved = resolveSelection(fromProfile, id);
      if (!resolved) {
        return { ok: false, reason: "One or more selected FROM players are not on the selected FROM team." };
      }
      resolvedOutgoingUniqueIds.add(resolved.uniqueId);
    }

    if (fixedIncomingIds.size && !toTeamName) {
      return { ok: false, reason: "Select a To Fantasy Team when TO Players are fixed." };
    }

    if (toTeamName) {
      if (toTeamName === fromTeamName) {
        return { ok: false, reason: "Trade cannot be generated against the same fantasy team." };
      }

      const toProfile = context.teamProfiles.get(toTeamName);
      if (!toProfile) {
        return { ok: false, reason: "Select a valid To Fantasy Team." };
      }

      for (const id of fixedIncomingIds) {
        const resolved = resolveSelection(toProfile, id);
        if (!resolved) {
          return { ok: false, reason: "One or more selected TO players are not on the selected TO team." };
        }
        resolvedIncomingUniqueIds.add(resolved.uniqueId);
      }
    }

    return {
      ok: true,
      resolvedOutgoingUniqueIds,
      resolvedIncomingUniqueIds,
    };
  }

  function buildContext(options) {
    const config = { ...TRADE_ENGINE_CONFIG, ...(options?.config || {}) };
    const lineupTargets = {
      ...DEFAULT_LINEUP_TARGETS,
      ...(options?.lineupTargets || {}),
    };

    const rosterPlayers = normalizeRosterPlayers(options?.rosterRows || []);
    const freeAgentsByPos = normalizeFreeAgentPlayers(options?.freeAgentRows || []);
    const valuedPlayers = enrichPlayerValuations(rosterPlayers, config);
    const replacement = buildReplacementValues(valuedPlayers, freeAgentsByPos);
    const teams = buildTeamProfiles(valuedPlayers, lineupTargets, replacement.replacementByPos, config);

    return {
      config,
      lineupTargets,
      allPlayers: valuedPlayers,
      teamMap: teams.teamMap,
      teamProfiles: teams.teamProfiles,
      replacementByPos: replacement.replacementByPos,
      replacementSource: replacement.replacementSource,
    };
  }

  function generateProposals(context, params) {
    const config = context.config;
    const fromTeamName = normalizeText(params?.fromTeamName);
    const toTeamName = normalizeText(params?.toTeamName);
    const mode = params?.mode === "fleece" ? "fleece" : "fair";
    const singleTradeOnly = !!params?.singleTradeOnly;
    const tradeStructure = normalizeText(params?.tradeStructure);
    const excludeGoalies = !!params?.excludeGoalies;
    const sendPosFilter = normalizeText(params?.sendPosFilter).toUpperCase();
    const getPosFilter = normalizeText(params?.getPosFilter).toUpperCase();
    const getPosRequirePlusOne = !!params?.getPosRequirePlusOne;
    const fixedOutgoingIds = params?.fixedOutgoingIds instanceof Set ? params.fixedOutgoingIds : new Set(params?.fixedOutgoingIds || []);
    const fixedIncomingIds = params?.fixedIncomingIds instanceof Set ? params.fixedIncomingIds : new Set(params?.fixedIncomingIds || []);

    const validation = validateFixedSelections(context, fromTeamName, toTeamName, fixedOutgoingIds, fixedIncomingIds);
    if (!validation.ok) {
      return { proposals: [], reason: validation.reason };
    }

    const fixedOutgoingUniqueIds = validation.resolvedOutgoingUniqueIds || new Set();
    const fixedIncomingUniqueIds = validation.resolvedIncomingUniqueIds || new Set();

    const fromProfile = context.teamProfiles.get(fromTeamName);
    const opponentNames = toTeamName
      ? [toTeamName]
      : [...context.teamProfiles.keys()].filter((team) => team !== fromTeamName);

    const proposals = [];
    const structures = getTradeStructures(singleTradeOnly, tradeStructure);
    const diagnostics = {
      checkedCombos: 0,
      rejectedBySend: 0,
      rejectedByGet: 0,
      rejectedByGoalie: 0,
      rejectedByModeFloor: 0,
      rejectedByDraftFpgRule: 0,
      rejectedByGetPlusOne: 0,
      rejectedByGuardrail: {
        draft_and_fpg_dominated: 0,
        implausible_asset_exchange: 0,
        two_sided_value_imbalance: 0,
      },
      skippedByStructures: 0,
      missingOutgoingCombos: 0,
      missingIncomingCombos: 0,
      missingSendPosOnOutgoingPool: 0,
      missingGetPosOnIncomingPool: 0,
    };

    const fromGoodAssetThreshold = getGoodAssetThreshold(fromProfile, config);

    for (const opponentName of opponentNames) {
      if (opponentName === fromTeamName) {
        continue;
      }

      const toProfile = context.teamProfiles.get(opponentName);
      if (!toProfile) {
        continue;
      }

      const fixedOutgoingPlayers = fromProfile.players.filter((player) => fixedOutgoingUniqueIds.has(player.uniqueId));
      const fixedIncomingPlayers = toProfile.players.filter((player) => fixedIncomingUniqueIds.has(player.uniqueId));

      const outgoingPool = buildCandidatePool(fromProfile, fromProfile.tradeabilityScoreById, {
        requiredPos: sendPosFilter,
        excludeGoalies,
        fixedPlayers: fixedOutgoingPlayers,
        maxPool: Math.max(config.maxPlayerPoolPerTeam, fixedOutgoingPlayers.length),
      });

      const incomingPool = buildCandidatePool(toProfile, toProfile.targetabilityScoreById, {
        requiredPos: getPosFilter,
        excludeGoalies,
        fixedPlayers: fixedIncomingPlayers,
        maxPool: Math.max(config.maxPlayerPoolPerTeam, fixedIncomingPlayers.length),
      });

      if (sendPosFilter && !outgoingPool.some((player) => player.pos === sendPosFilter)) {
        diagnostics.missingSendPosOnOutgoingPool += 1;
      }
      if (getPosFilter && !incomingPool.some((player) => player.pos === getPosFilter)) {
        diagnostics.missingGetPosOnIncomingPool += 1;
      }

      for (const [outCount, inCount] of structures) {
        if (fixedOutgoingPlayers.length > outCount || fixedIncomingPlayers.length > inCount) {
          diagnostics.skippedByStructures += 1;
          continue;
        }

        const outgoingCombos = chooseCombinations(
          outgoingPool,
          outCount,
          fixedOutgoingPlayers,
          fromProfile.tradeabilityScoreById,
          config.maxCombosPerSide
        );

        const incomingCombos = chooseCombinations(
          incomingPool,
          inCount,
          fixedIncomingPlayers,
          toProfile.targetabilityScoreById,
          config.maxCombosPerSide
        );

        if (!outgoingCombos.length || !incomingCombos.length) {
          if (!outgoingCombos.length) {
            diagnostics.missingOutgoingCombos += 1;
          }
          if (!incomingCombos.length) {
            diagnostics.missingIncomingCombos += 1;
          }
          continue;
        }

        let checked = 0;
        for (const outgoingPlayers of outgoingCombos) {
          for (const incomingPlayers of incomingCombos) {
            checked += 1;
            diagnostics.checkedCombos += 1;
            if (checked > config.maxCrossEvaluationsPerStructure) {
              break;
            }

            const outgoingIds = outgoingPlayers.map((player) => player.uniqueId);
            const incomingIds = incomingPlayers.map((player) => player.uniqueId);
            const overlap = outgoingIds.some((id) => incomingIds.includes(id));
            if (overlap) {
              continue;
            }

            const outgoingPosCount = outgoingPlayers.reduce((acc, player) => {
              acc[player.pos] += 1;
              return acc;
            }, { F: 0, D: 0, G: 0 });
            const incomingPosCount = incomingPlayers.reduce((acc, player) => {
              acc[player.pos] += 1;
              return acc;
            }, { F: 0, D: 0, G: 0 });

            if (sendPosFilter && (outgoingPosCount[sendPosFilter] - incomingPosCount[sendPosFilter] < 1)) {
              diagnostics.rejectedBySend += 1;
              continue;
            }
            if (getPosFilter && incomingPosCount[getPosFilter] < 1) {
              diagnostics.rejectedByGet += 1;
              continue;
            }

            if (getPosFilter && getPosRequirePlusOne
              && (incomingPosCount[getPosFilter] - outgoingPosCount[getPosFilter] !== 1)) {
              diagnostics.rejectedByGetPlusOne += 1;
              continue;
            }

            if (excludeGoalies && ([...outgoingPlayers, ...incomingPlayers].some((player) => player.pos === "G"))) {
              diagnostics.rejectedByGoalie += 1;
              continue;
            }

            const fromDelta = evaluateTeamDelta(fromProfile, outgoingPlayers, incomingPlayers, config);
            const toDelta = evaluateTeamDelta(toProfile, incomingPlayers, outgoingPlayers, config);

            // Dedicated plausibility step: runs on the fully constructed candidate, before ranking.
            const plausibility = validateTradePlausibility({
              config,
              mode,
              outgoingPlayers,
              incomingPlayers,
              fromUtility: fromDelta.totalDelta,
              toUtility: toDelta.totalDelta,
              goodAssetThresholdFrom: fromGoodAssetThreshold,
              goodAssetThresholdTo: getGoodAssetThreshold(toProfile, config),
            });
            if (!plausibility.ok) {
              diagnostics.rejectedByDraftFpgRule += 1;
              diagnostics.rejectedByGuardrail[plausibility.reason] += 1;
              continue;
            }

            const fromObservedDelta = incomingPlayers.reduce((sum, player) => sum + player.observedSignal, 0)
              - outgoingPlayers.reduce((sum, player) => sum + player.observedSignal, 0);
            const fromDraftDelta = incomingPlayers.reduce((sum, player) => sum + player.draftExpectedValue, 0)
              - outgoingPlayers.reduce((sum, player) => sum + player.draftExpectedValue, 0);
            const fromExpectedDelta = incomingPlayers.reduce((sum, player) => sum + player.expectedValue, 0)
              - outgoingPlayers.reduce((sum, player) => sum + player.expectedValue, 0);
            const inefficiencyCapture = incomingPlayers.reduce((sum, player) => sum + player.opportunityGap, 0)
              - outgoingPlayers.reduce((sum, player) => sum + player.opportunityGap, 0);
            const fromRiskDelta = incomingPlayers.reduce((sum, player) => sum + player.regressionRisk + player.ageUncertainty, 0)
              - outgoingPlayers.reduce((sum, player) => sum + player.regressionRisk + player.ageUncertainty, 0);

            const outgoingEarlyAnchors = outgoingPlayers.filter((player) => Number.isFinite(player.draftPick) && player.draftPick > 0 && player.draftPick <= 24).length;
            const incomingEarlyAnchors = incomingPlayers.filter((player) => Number.isFinite(player.draftPick) && player.draftPick > 0 && player.draftPick <= 24).length;
            const outgoingOnlyFaOrLate = outgoingPlayers.every((player) => !Number.isFinite(player.draftPick) || player.draftPick > 100);
            const incomingHasEarlyAnchor = incomingEarlyAnchors > 0;
            const faForAnchorPenalty = outgoingOnlyFaOrLate && incomingHasEarlyAnchor ? 1 : 0;
            const draftJumpPenalty = Math.max(0, fromDraftDelta - (0.22 + (Math.max(0, outgoingPlayers.length - 1) * 0.12)));

            const twoForOneUpgradePenalty = plausibility.rareConsolidation
              ? (mode === "fleece"
                ? config.twoForOneGoodPlayerRarityPenaltyFleece
                : config.twoForOneGoodPlayerRarityPenaltyFair)
              : 0;

            const denominator = Math.max(0.5, Math.abs(fromDelta.totalDelta) + Math.abs(toDelta.totalDelta));
            const fairnessScore = 1 - clamp(Math.abs(fromDelta.totalDelta - toDelta.totalDelta) / denominator, 0, 1);
            const fitScore = clamp((fromDelta.shortageDelta + toDelta.shortageDelta + 4) / 8, 0, 1);
            const upsideScore = clamp(
              (fromExpectedDelta
                + outgoingPlayers.length)
              / Math.max(1, outgoingPlayers.length + incomingPlayers.length),
              0,
              1
            );

            let composite;
            if (mode === "fleece") {
              if (toDelta.totalDelta < config.fleeceOpponentFloor) {
                diagnostics.rejectedByModeFloor += 1;
                continue;
              }
              composite = (
                (fromDelta.totalDelta * 1.14)
                + (fromObservedDelta * 0.22)
                + (fromDraftDelta * (0.16 + config.fleeceDraftToleranceBoost))
                + (inefficiencyCapture * config.fleeceCaptureWeight)
                - (Math.max(0, fromRiskDelta) * 0.18)
                + (fitScore * 0.56)
                + (fairnessScore * 0.2)
                - twoForOneUpgradePenalty
              );
            } else {
              if (fromDelta.totalDelta < config.fairOpponentFloor || toDelta.totalDelta < config.fairOpponentFloor) {
                diagnostics.rejectedByModeFloor += 1;
                continue;
              }
              const balancePenalty = Math.abs(fromDelta.totalDelta - toDelta.totalDelta) * config.fairBalancePenaltyWeight;
              const draftPenalty = draftJumpPenalty * config.fairDraftJumpPenaltyWeight;
              const anchorPenalty = faForAnchorPenalty * config.fairFaForAnchorPenaltyWeight;
              composite = (
                (fromDelta.totalDelta + toDelta.totalDelta)
                + (fromObservedDelta * 0.12)
                + (fromDraftDelta * 0.1)
                + (inefficiencyCapture * 0.25)
                - (Math.max(0, fromRiskDelta) * 0.24)
                + (fitScore * 0.75)
                + (fairnessScore * 0.7)
                - balancePenalty
                - draftPenalty
                - anchorPenalty
                - twoForOneUpgradePenalty
              );
            }

            const fromAdvantageRatio = clamp(fromDelta.totalDelta / Math.max(0.01, Math.abs(toDelta.totalDelta) + Math.abs(fromDelta.totalDelta)), -1, 1);

            const compositeNormalized = clamp((composite + 1.5) / 3, 0, 1);

            proposals.push({
              fromTeamName,
              toTeamName: opponentName,
              outgoingPlayers,
              incomingPlayers,
              structure: `${outgoingPlayers.length}:${incomingPlayers.length}`,
              scoring: {
                composite: compositeNormalized,
                compositeRaw: composite,
                fairness: fairnessScore,
                fitScore,
                upsideScore,
                fromAdvantageRatio,
                fromUtility: fromDelta.totalDelta,
                toUtility: toDelta.totalDelta,
                observedDelta: fromObservedDelta,
                draftPriorDelta: fromDraftDelta,
                opportunityDelta: inefficiencyCapture,
                riskDelta: fromRiskDelta,
                faForAnchorPenalty,
                draftJumpPenalty,
                twoForOneUpgradePenalty,
              },
              rationale: buildRationale(
                mode,
                fromTeamName,
                opponentName,
                { composite, fairnessScore, fitScore, upsideScore, fromAdvantageRatio },
                fromDelta,
                toDelta,
                outgoingPlayers,
                incomingPlayers,
                context.replacementSource
              ),
              details: {
                fromDelta,
                toDelta,
              },
              signature: packageSignature(fromTeamName, opponentName, outgoingPlayers, incomingPlayers),
            });
          }
        }
      }
    }

    // Exact dedupe first so ordering and selection never depend on generation order.
    const uniqueBySignature = new Map();
    proposals.forEach((proposal) => {
      const existing = uniqueBySignature.get(proposal.signature);
      if (!existing) {
        uniqueBySignature.set(proposal.signature, proposal);
        return;
      }

      const proposalComposite = Number.isFinite(proposal.scoring.compositeRaw)
        ? proposal.scoring.compositeRaw
        : proposal.scoring.composite;
      const existingComposite = Number.isFinite(existing.scoring.compositeRaw)
        ? existing.scoring.compositeRaw
        : existing.scoring.composite;

      if (proposalComposite > existingComposite) {
        uniqueBySignature.set(proposal.signature, proposal);
        return;
      }

      if (proposalComposite === existingComposite
        && proposal.scoring.fairness > existing.scoring.fairness) {
        uniqueBySignature.set(proposal.signature, proposal);
      }
    });

    const uniqueProposals = Array.from(uniqueBySignature.values());

    uniqueProposals.sort((left, right) => {
      const rightComposite = Number.isFinite(right.scoring.compositeRaw)
        ? right.scoring.compositeRaw
        : right.scoring.composite;
      const leftComposite = Number.isFinite(left.scoring.compositeRaw)
        ? left.scoring.compositeRaw
        : left.scoring.composite;

      if (rightComposite !== leftComposite) {
        return rightComposite - leftComposite;
      }
      if (right.scoring.fairness !== left.scoring.fairness) {
        return right.scoring.fairness - left.scoring.fairness;
      }
      if (right.scoring.fitScore !== left.scoring.fitScore) {
        return right.scoring.fitScore - left.scoring.fitScore;
      }
      if (right.scoring.upsideScore !== left.scoring.upsideScore) {
        return right.scoring.upsideScore - left.scoring.upsideScore;
      }
      return left.signature.localeCompare(right.signature);
    });

    let rankedProposals = uniqueProposals;
    if (!toTeamName) {
      const firstPerOpponent = [];
      const seenOpponents = new Set();
      for (const proposal of uniqueProposals) {
        if (seenOpponents.has(proposal.toTeamName)) {
          continue;
        }
        seenOpponents.add(proposal.toTeamName);
        firstPerOpponent.push(proposal);
      }

      if (firstPerOpponent.length) {
        const usedSignatures = new Set(firstPerOpponent.map((proposal) => proposal.signature));
        const remainder = uniqueProposals.filter((proposal) => !usedSignatures.has(proposal.signature));
        rankedProposals = firstPerOpponent.concat(remainder);
      }
    }

    const diversified = [];
    for (const proposal of rankedProposals) {
      const duplicate = diversified.some((kept) => isNearDuplicate(kept, proposal, config.nearDuplicateOverlapThreshold));
      if (!duplicate) {
        diversified.push(proposal);
      }
      if (diversified.length >= config.maxOutputProposals) {
        break;
      }
    }

    const normalized = diversified.map((proposal) => ({
      ...proposal,
      outgoingPlayers: proposal.outgoingPlayers.map((player) => ({
        id: player.id,
        uniqueId: player.uniqueId,
        name: player.name,
        team: player.fantasyTeam,
        pos: player.pos,
        fpg: Number.isFinite(player.fpg) ? player.fpg : 0,
        fp: Number.isFinite(player.fpts) ? player.fpts : 0,
        age: Number.isFinite(player.age) ? player.age : NaN,
        rookie: player.rookie,
        pick: player.draftPick,
        pickLabel: player.acquisitionLabel,
        acquisitionType: player.acquisitionType,
        acquisitionLabel: player.acquisitionLabel,
        observedProduction: player.observedSignal,
        draftExpectedValue: player.draftExpectedValue,
        expectedValue: player.expectedValue,
        marketPerceivedValue: player.marketPerceivedValue,
        regressionRisk: player.regressionRisk,
        ageUncertainty: player.ageUncertainty,
        opportunityType: player.opportunityType,
        opportunityGap: player.opportunityGap,
        playerMetaLabel: buildDisplayMeta(player),
      })),
      incomingPlayers: proposal.incomingPlayers.map((player) => ({
        id: player.id,
        uniqueId: player.uniqueId,
        name: player.name,
        team: player.fantasyTeam,
        pos: player.pos,
        fpg: Number.isFinite(player.fpg) ? player.fpg : 0,
        fp: Number.isFinite(player.fpts) ? player.fpts : 0,
        age: Number.isFinite(player.age) ? player.age : NaN,
        rookie: player.rookie,
        pick: player.draftPick,
        pickLabel: player.acquisitionLabel,
        acquisitionType: player.acquisitionType,
        acquisitionLabel: player.acquisitionLabel,
        observedProduction: player.observedSignal,
        draftExpectedValue: player.draftExpectedValue,
        expectedValue: player.expectedValue,
        marketPerceivedValue: player.marketPerceivedValue,
        regressionRisk: player.regressionRisk,
        ageUncertainty: player.ageUncertainty,
        opportunityType: player.opportunityType,
        opportunityGap: player.opportunityGap,
        playerMetaLabel: buildDisplayMeta(player),
      })),
    }));

    return {
      proposals: normalized,
      diagnostics,
      reason: normalized.length
        ? ""
        : buildNoProposalReason({
            fromTeamName,
            toTeamName,
            sendPosFilter,
            getPosFilter,
            getPosRequirePlusOne,
            mode,
            ...diagnostics,
          }),
    };
  }

  return {
    TRADE_ENGINE_CONFIG,
    classifyAcquisition,
    buildContext,
    generateProposals,
    validateTradePlausibility,
    GUARDRAIL_REASONS,
  };
});
