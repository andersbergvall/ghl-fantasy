(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TradeEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_LINEUP_TARGETS = { F: 12, D: 4, G: 2 };

  const TRADE_ENGINE_CONFIG = {
    productionWeight: 0.56,
    futureWeight: 0.2,
    perceivedWeight: 0.24,
    draftPedigreeStrength: 0.34,
    keeperPerceptionAdjustment: 0.02,
    freeAgentPerceptionAdjustment: -0.06,
    unknownPerceptionAdjustment: -0.03,
    ageRiskPerYearOver30: 0.015,
    youthUpsideUnder24: 0.018,
    rookieUncertaintyPenalty: 0.02,
    rookieUpsideBonus: 0.015,
    positionalScarcityWeight: 0.28,
    replacementValueWeight: 0.36,
    lineupDeltaWeight: 0.62,
    packageDeltaWeight: 0.38,
    fairBalancePenaltyWeight: 0.55,
    fleeceCaptureWeight: 0.5,
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

      const acquisition = classifyAcquisition(row.DraftPick);
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
        draftPickRaw: row.DraftPick,
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

    const maxDraftPick = draftPicks.length ? Math.max(...draftPicks) : 1;

    return players.map((player) => {
      const fpgSafe = Number.isFinite(player.fpg) ? player.fpg : 0;
      const fptsSafe = Number.isFinite(player.fpts) ? player.fpts : 0;

      const productionNorm = clamp((fpgSafe - minFpg) / fpgRange, 0, 1);
      const totalsNorm = clamp((fptsSafe - minFpts) / fptsRange, 0, 1);
      const observedProduction = clamp((productionNorm * 0.78) + (totalsNorm * 0.22), 0, 1);

      let draftPedigree = 0;
      if (player.acquisitionType === "DRAFTED" && Number.isFinite(player.draftPick) && player.draftPick > 0) {
        draftPedigree = clamp(1 - (Math.log(player.draftPick + 1) / Math.log(maxDraftPick + 1)), 0, 1);
      }

      let acquisitionAdjustment = 0;
      if (player.acquisitionType === "KEEPER") {
        acquisitionAdjustment = config.keeperPerceptionAdjustment;
      } else if (player.acquisitionType === "FREE_AGENT") {
        acquisitionAdjustment = config.freeAgentPerceptionAdjustment;
      } else if (player.acquisitionType === "UNKNOWN") {
        acquisitionAdjustment = config.unknownPerceptionAdjustment;
      }

      const perceivedValue = clamp(
        (observedProduction * (1 - config.draftPedigreeStrength))
          + (draftPedigree * config.draftPedigreeStrength)
          + acquisitionAdjustment,
        0,
        1
      );

      let ageAdjustment = 0;
      if (Number.isFinite(player.age) && player.age > 30) {
        ageAdjustment -= (player.age - 30) * config.ageRiskPerYearOver30;
      }
      if (Number.isFinite(player.age) && player.age < 24) {
        ageAdjustment += config.youthUpsideUnder24;
      }

      let rookieAdjustment = 0;
      if (player.rookie) {
        rookieAdjustment += config.rookieUpsideBonus;
        rookieAdjustment -= config.rookieUncertaintyPenalty;
      }

      const futureValue = clamp(observedProduction + ageAdjustment + rookieAdjustment, 0, 1);
      const valueGap = clamp(observedProduction - perceivedValue, -1, 1);

      return {
        ...player,
        productionValue: observedProduction,
        draftPedigreeValue: draftPedigree,
        perceivedValue,
        futureValue,
        valueGap,
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
          if (right.productionValue !== left.productionValue) {
            return right.productionValue - left.productionValue;
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
        const draftGapSignal = clamp(player.perceivedValue - player.productionValue, -1, 1) * 0.22;
        const score = (player.productionValue * 0.42) + (player.futureValue * 0.2) + draftGapSignal + surplusBoost - needPenalty;
        tradeabilityScoreById.set(player.uniqueId, score);
      });

      const targetabilityScoreById = new Map();
      teamPlayers.forEach((player) => {
        const needBoost = needs[player.pos] * 0.2;
        const scarcityBoost = Math.max(0, (lineupTargets[player.pos] - counts[player.pos])) * 0.05;
        const score = (player.productionValue * 0.48) + (player.futureValue * 0.26) + (player.valueGap * 0.16) + needBoost + scarcityBoost;
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

    ["F", "D", "G"].forEach((position) => {
      const values = grouped[position].filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => b - a);
      const needed = lineupTargets[position];
      const chosen = values.slice(0, needed);
      strength += chosen.reduce((sum, value) => sum + value, 0);

      const missing = Math.max(0, needed - chosen.length);
      shortages[position] = missing;
      if (missing > 0) {
        strength += replacementByPos[position] * missing;
      }
    });

    return {
      strength,
      shortages,
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

    const outgoingTradeValue = outgoingPlayers.reduce((sum, player) => sum + ((player.productionValue * config.productionWeight) + (player.futureValue * config.futureWeight) + (player.perceivedValue * config.perceivedWeight)), 0);
    const incomingTradeValue = incomingPlayers.reduce((sum, player) => sum + ((player.productionValue * config.productionWeight) + (player.futureValue * config.futureWeight) + (player.perceivedValue * config.perceivedWeight)), 0);

    const lineupDelta = afterState.strength - beforeState.strength;
    const packageDelta = incomingTradeValue - outgoingTradeValue;
    const shortageDelta = ["F", "D", "G"].reduce((sum, pos) => sum + (beforeState.shortages[pos] - afterState.shortages[pos]), 0);

    const totalDelta = (lineupDelta * config.lineupDeltaWeight) + (packageDelta * config.packageDeltaWeight) + (shortageDelta * config.positionalScarcityWeight);

    return {
      totalDelta,
      lineupDelta,
      packageDelta,
      shortageDelta,
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
      mode,
      checkedCombos,
      rejectedBySend,
      rejectedByGet,
      rejectedByModeFloor,
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

    if (getPosFilter && rejectedByGet > 0 && rejectedByGet >= rejectedBySend && rejectedByGet >= rejectedByModeFloor) {
      return `No trades satisfied GET ${getPosFilter} (from team must net-receive at least one ${getPosFilter}).`;
    }

    if (rejectedByModeFloor > 0 && rejectedByModeFloor >= rejectedBySend && rejectedByModeFloor >= rejectedByGet) {
      return mode === "fleece"
        ? "No proposals passed fleece viability thresholds for both teams under current filters."
        : "No proposals passed fair-balance viability thresholds for both teams under current filters.";
    }

    if (missingOutgoingCombos > 0 || missingIncomingCombos > 0 || skippedByStructures > 0) {
      return "Roster-size and fixed-player constraints left no valid trade structures for the selected teams.";
    }

    return "No valid proposals met all selected constraints and roster-feasibility checks.";
  }

  function getTradeStructures(singleTradeOnly) {
    if (singleTradeOnly) {
      return [[1, 1]];
    }

    return [
      [1, 1], [1, 2], [1, 3],
      [2, 1], [2, 2], [2, 3],
      [3, 1], [3, 2], [3, 3],
    ];
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

    if (mode === "fleece") {
      lines.push("Potential buy-low / sell-high signal is heuristic from draft pedigree vs current production; no historical regression model is used.");
    } else {
      lines.push("Fair mode balances both teams' estimated package + lineup effects instead of matching raw FP/G totals.");
    }

    lines.push(`Lineup impact estimate: ${fromTeamName} ${fromDelta.lineupDelta >= 0 ? "+" : ""}${fromDelta.lineupDelta.toFixed(2)} FP/G, ${toTeamName} ${toDelta.lineupDelta >= 0 ? "+" : ""}${toDelta.lineupDelta.toFixed(2)} FP/G.`);

    const replacementNote = ["F", "D", "G"]
      .filter((pos) => replacementSource[pos] !== "free-agent")
      .map((pos) => pos)
      .join(", ");

    if (replacementNote) {
      lines.push(`Replacement-level for ${replacementNote} uses fallback league baselines because sufficient FA samples were unavailable.`);
    }

    lines.push(`Main risk: heuristic age/rookie adjustments and no historical trend data.`);
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
    const excludeGoalies = !!params?.excludeGoalies;
    const sendPosFilter = normalizeText(params?.sendPosFilter).toUpperCase();
    const getPosFilter = normalizeText(params?.getPosFilter).toUpperCase();
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
    const structures = getTradeStructures(singleTradeOnly);
    const diagnostics = {
      checkedCombos: 0,
      rejectedBySend: 0,
      rejectedByGet: 0,
      rejectedByGoalie: 0,
      rejectedByModeFloor: 0,
      skippedByStructures: 0,
      missingOutgoingCombos: 0,
      missingIncomingCombos: 0,
      missingSendPosOnOutgoingPool: 0,
      missingGetPosOnIncomingPool: 0,
    };

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
            if (getPosFilter && (incomingPosCount[getPosFilter] - outgoingPosCount[getPosFilter] < 1)) {
              diagnostics.rejectedByGet += 1;
              continue;
            }

            if (excludeGoalies && ([...outgoingPlayers, ...incomingPlayers].some((player) => player.pos === "G"))) {
              diagnostics.rejectedByGoalie += 1;
              continue;
            }

            const fromDelta = evaluateTeamDelta(fromProfile, outgoingPlayers, incomingPlayers, config);
            const toDelta = evaluateTeamDelta(toProfile, incomingPlayers, outgoingPlayers, config);

            const fromPackageValue = incomingPlayers.reduce((sum, player) => sum + player.productionValue, 0)
              - outgoingPlayers.reduce((sum, player) => sum + player.productionValue, 0);
            const perceivedCapture = incomingPlayers.reduce((sum, player) => sum + player.valueGap, 0)
              - outgoingPlayers.reduce((sum, player) => sum + player.valueGap, 0);

            const denominator = Math.max(0.5, Math.abs(fromDelta.totalDelta) + Math.abs(toDelta.totalDelta));
            const fairnessScore = 1 - clamp(Math.abs(fromDelta.totalDelta - toDelta.totalDelta) / denominator, 0, 1);
            const fitScore = clamp((fromDelta.shortageDelta + toDelta.shortageDelta + 4) / 8, 0, 1);
            const upsideScore = clamp(
              (incomingPlayers.reduce((sum, player) => sum + player.futureValue, 0)
                - outgoingPlayers.reduce((sum, player) => sum + player.futureValue, 0)
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
                (fromDelta.totalDelta * 1.1)
                + (fromPackageValue * 0.45)
                + (perceivedCapture * config.fleeceCaptureWeight)
                + (fitScore * 0.6)
                + (fairnessScore * 0.2)
              );
            } else {
              if (fromDelta.totalDelta < config.fairOpponentFloor || toDelta.totalDelta < config.fairOpponentFloor) {
                diagnostics.rejectedByModeFloor += 1;
                continue;
              }
              const balancePenalty = Math.abs(fromDelta.totalDelta - toDelta.totalDelta) * config.fairBalancePenaltyWeight;
              composite = (
                (fromDelta.totalDelta + toDelta.totalDelta)
                + (fitScore * 0.75)
                + (fairnessScore * 0.7)
                - balancePenalty
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
                observedDelta: fromPackageValue,
                perceivedDelta: perceivedCapture,
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
        playerMetaLabel: buildDisplayMeta(player),
      })),
    }));

    return {
      proposals: normalized,
      reason: normalized.length
        ? ""
        : buildNoProposalReason({
            fromTeamName,
            toTeamName,
            sendPosFilter,
            getPosFilter,
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
  };
});
