const catalog = require("../data/voyage-catalog.json");

const DIRECTIONS = ["north", "east", "south", "west"];
const OPPOSITE = { north: "south", east: "west", south: "north", west: "east" };
const OFFSETS = { north: -3, east: 1, south: 3, west: -1 };
const ROTATE_CLOCKWISE = { north: "east", east: "south", south: "west", west: "north" };
const TIER_ONE_UNIQUE_AREAS = [
  "Diving Shoals",
  "Pelagic Abyss",
  "Sea Pillars",
  "Sunken Totems",
  "Clam Infested Shelf",
  "Kishara's Rest",
  "Anchorfield",
  "Infested Bathyspheres",
];
const TIER_ONE_UNIQUE_AREA_BONUS = 500000;

const PROFILES = {
  general: {
    label: "General Profit",
    weights: {
      "Item Quantity": 150,
      "Item Rarity": 155,
      "More Rarity of Items found": 165,
      "Increased Pack size": 135,
      "Increased Quantity of Items found": 150,
      "Additional Divine Orb": 8000,
      "Golden Lanterns": 1800,
      "More Currency found": 900,
      "Basic Currency converted to Stacked Decks": 2200,
      "Diviner's Strongboxes": 185,
      "Operative's Strongboxes": 145,
      "Arcanist's Strongboxes": 130,
      "Strongboxes": 115,
      "Increased number of Rare Monsters": 88,
      "Increased Magic Monsters": 64,
      "Monsters are at least Magic": 76,
      "Rare Monsters Fracture on death": 95,
      "Essenced natural inhabitants": 82,
      "Possessed Rare Monsters": 72,
      "Additional Sea Beast packs": 58,
      "Additional Crab packs": 56,
      "Additional Drowned packs": 56,
      "Octopus packs": 54,
      "Crab packs": 54,
      "Increased Dead Man's Sulphur found": 22,
      "Messages in Bottles": 42,
      "Unique Ring conversion chance": 48,
      "Unique Amulet conversion chance": 48,
      "Unique Belt conversion chance": 44,
      "Wildwood Wisps": -45,
      "Imprisoned Monsters": -18,
      "Pantheon Modifier": -18,
      "Flasks have Quality": -30,
      "Soul Eater": -45,
      "No Equipment, Flask or Tincture drops": -25,
    },
  },
  packsize: {
    label: "Pack Size / Monster Density",
    weights: {
      "Increased Pack size": 150,
      "Additional Sea Beast packs": 90,
      "Additional Crab packs": 88,
      "Additional Drowned packs": 88,
      "Octopus packs": 84,
      "Crab packs": 84,
      "Increased number of Rare Monsters": 96,
      "Increased Magic Monsters": 82,
      "Monsters are at least Magic": 90,
      "Increased Quantity of Items found": 72,
      "Soul Eater": -55,
    },
  },
  divcards: {
    label: "Div Cards / Strongboxes",
    weights: {
      "Diviner's Strongboxes": 160,
      "Strongboxes": 80,
      "Operative's Strongboxes": 90,
      "Arcanist's Strongboxes": 75,
      "Increased Quantity of Items found": 120,
      "Increased Pack size": 100,
      "Increased number of Rare Monsters": 70,
      "Monsters are at least Magic": 72,
      "Soul Eater": -45,
    },
  },
  sulphur: {
    label: "Sulphur / Ducats",
    weights: {
      "Increased Dead Man's Sulphur found": 145,
      "Increased Quantity of Items found": 95,
      "Increased Pack size": 84,
      "Messages in Bottles": 65,
      "Lost Kalguuran shipment": 80,
      "Soul Eater": -35,
    },
  },
  safe: {
    label: "Safe / Low-Risk",
    weights: {
      "Increased Quantity of Items found": 90,
      "Increased Pack size": 75,
      "Strongboxes": 70,
      "Diviner's Strongboxes": 95,
      "Arcanist's Strongboxes": 75,
      "Operative's Strongboxes": 75,
      "Soul Eater": -160,
      "Possessed Rare Monsters": -70,
      "Essenced natural inhabitants": -50,
      "Rare Monsters Fracture on death": 65,
      "Monsters are at least Magic": -30,
      "Increased number of Rare Monsters": -20,
    },
  },
};

function slugify(text) {
  return String(text || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%+ -]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedAreaText(text) {
  return slugify(text).replace(/[-']/g, " ").replace(/\s+/g, " ").trim();
}

const NORMALIZED_TIER_ONE_UNIQUE_AREAS = TIER_ONE_UNIQUE_AREAS.map((name) => ({ name, normalized: normalizedAreaText(name) }));

function tierOneUniqueAreaName(chart) {
  if (chart && Object.prototype.hasOwnProperty.call(chart, "tierOneUniqueArea")) return chart.tierOneUniqueArea;
  const haystack = normalizedAreaText(`${chart?.displayName || ""}\n${chart?.rawText || ""}`);
  return NORMALIZED_TIER_ONE_UNIQUE_AREAS.find((entry) => haystack.includes(entry.normalized))?.name || null;
}

function adjacentIndex(index, direction) {
  const row = Math.floor(index / 3);
  const column = index % 3;
  if (!(direction in OFFSETS)) return null;
  if (direction === "north" && row === 0) return null;
  if (direction === "east" && column === 2) return null;
  if (direction === "south" && row === 2) return null;
  if (direction === "west" && column === 0) return null;
  return index + OFFSETS[direction];
}

function connectedIndexes(index, connections) {
  return connections.map((direction) => adjacentIndex(index, direction)).filter((value) => value !== null);
}

function rotateConnections(connections, rotation = 0) {
  let rotated = [...connections];
  for (let step = 0; step < rotation; step += 90) {
    rotated = rotated.map((direction) => ROTATE_CLOCKWISE[direction]);
  }
  return rotated;
}

function chartConnections(chart) {
  const pattern = getPattern(chart.patternId);
  const baseConnections = pattern?.connections || chart.connections || [];
  return chart.rotation ? rotateConnections(baseConnections, chart.rotation) : baseConnections;
}

function effectTargets(index, effect, connections) {
  if (effect.scope === "self") return [index];
  if (effect.scope === "connected") return connectedIndexes(index, connections);
  if (effect.scope === "voyage") return Array.from({ length: 9 }, (_, i) => i);
  if (effect.scope === "border") return [index];
  return [index];
}

function reciprocalEdges(board) {
  const edges = [];
  board.forEach((chart, index) => {
    if (!chart) return;
    chartConnections(chart).forEach((direction) => {
      const target = adjacentIndex(index, direction);
      if (target === null || target < index || !board[target]) return;
      if (chartConnections(board[target]).includes(OPPOSITE[direction])) edges.push([index, target]);
    });
  });
  return edges;
}

function reciprocalConnectedIndexes(board, sourceIndex) {
  return reciprocalEdges(board).flatMap(([left, right]) => {
    if (left === sourceIndex) return [right];
    if (right === sourceIndex) return [left];
    return [];
  });
}

function borderModifierAppliesToAdjacent(modifier) {
  return /\badjacent\s+(areas|charts)\b/i.test(`${modifier?.summary || ""} ${modifier?.rawText || ""}`);
}

function fixedModifierTargets(board, sourceIndex, modifier) {
  if (modifier?.sourceType === "border" && borderModifierAppliesToAdjacent(modifier)) {
    return reciprocalConnectedIndexes(board, sourceIndex);
  }
  return [sourceIndex];
}

function connectedComponent(start, edges) {
  const seen = new Set();
  const pending = start === undefined ? [] : [start];
  while (pending.length) {
    const index = pending.pop();
    if (seen.has(index)) continue;
    seen.add(index);
    for (const [a, b] of edges) {
      if (a === index && !seen.has(b)) pending.push(b);
      if (b === index && !seen.has(a)) pending.push(a);
    }
  }
  return seen;
}

function evaluateValidity(board) {
  const occupied = board.flatMap((chart, index) => chart ? [index] : []);
  const edges = reciprocalEdges(board);
  const connected = connectedComponent(occupied[0], edges);
  const invalidConnectors = [];
  board.forEach((chart, index) => {
    if (!chart) return;
    chartConnections(chart).forEach((direction) => {
      const target = adjacentIndex(index, direction);
      // Outside-edge exits are legal Voyage paths; only internal mismatches invalidate a board.
      if (target === null) return;
      if (!board[target]) {
        invalidConnectors.push({ tileIndex: index, direction, targetIndex: target, reason: "empty-tile" });
        return;
      }
      if (!chartConnections(board[target]).includes(OPPOSITE[direction])) {
        invalidConnectors.push({ tileIndex: index, direction, targetIndex: target, reason: "non-reciprocal" });
      }
    });
  });
  const degrees = Array.from({ length: 9 }, () => 0);
  edges.forEach(([left, right]) => { degrees[left] += 1; degrees[right] += 1; });
  const occupiedDegrees = occupied.map((index) => degrees[index]);
  const endpointCount = occupiedDegrees.filter((degree) => degree === 1).length;
  const branchCount = occupiedDegrees.filter((degree) => degree > 2).length;
  const isConnected = occupied.length > 0 && occupied.every((i) => connected.has(i));
  const isRunnable = occupied.length === 9 && isConnected && invalidConnectors.length === 0;
  const isLinearPath = isRunnable && edges.length === 8 && endpointCount === 2 && branchCount === 0;
  return {
    isValid: isRunnable,
    isRunnable,
    occupiedCount: occupied.length,
    requiredChartCount: 9,
    isConnected,
    reciprocalEdges: edges,
    invalidConnectors,
    degrees,
    endpointCount,
    branchCount,
    isLinearPath,
  };
}

function topologyScore(validity) {
  if (!validity.isValid) return -500000;
  const completeConnectedBonus = 320000;
  const linearBonus = validity.isLinearPath ? 220000 : 0;
  const edgePenalty = Math.abs(validity.reciprocalEdges.length - 8) * 18000;
  const branchPenalty = validity.branchCount * 55000;
  const deadEndPenalty = Math.max(0, validity.endpointCount - 2) * 12000;
  return completeConnectedBonus + linearBonus - edgePenalty - branchPenalty - deadEndPenalty;
}

function medianEffectValue(effect) {
  if (Number.isFinite(effect.value)) return effect.value;
  if (Number.isFinite(effect.minimumValue) && Number.isFinite(effect.maximumValue)) return (effect.minimumValue + effect.maximumValue) / 2;
  return effect.aggregation === "descriptive" ? 1 : 0;
}

function weightFor(label, profileKey = "general") {
  const weights = PROFILES[profileKey]?.weights || PROFILES.general.weights;
  if (weights[label] !== undefined) return weights[label];
  const clean = slugify(label);
  for (const [key, value] of Object.entries(weights)) {
    if (clean.includes(slugify(key)) || slugify(key).includes(clean)) return value;
  }
  return 10;
}

function isTopTierRewardLabel(label) {
  const normalized = slugify(label);
  return normalized.includes("divine orb")
    || normalized.includes("golden lantern")
    || normalized.includes("more currency")
    || normalized.includes("currency converted to stacked decks");
}

function scoreEffect(effect, profileKey = "general", targetCount = 1) {
  const base = weightFor(effect.label, profileKey);
  const value = medianEffectValue(effect);
  const scopeMult = effect.scope === "voyage" ? 9 : Math.max(1, targetCount);
  const unitMult = effect.unit === "%" ? Math.max(1, value / 10) : Math.max(1, value);
  return base * unitMult * scopeMult;
}

function allAreaModifierSources() {
  const borderSources = catalog.borderModifiers.map((modifier) => ({
    id: modifier.id,
    name: modifier.name,
    summary: modifier.summary,
    sourceType: "border",
    effects: modifier.effects,
  }));
  const explicitSources = catalog.chartModifiers.map((modifier) => ({
    id: modifier.id,
    name: modifier.rewardCounterweight?.line || modifier.name,
    summary: [modifier.rewardCounterweight?.line, ...modifier.areaModifiers].filter(Boolean).join("; "),
    sourceType: "explicit",
    effects: modifier.rewardCounterweight ? [{
      id: modifier.rewardCounterweight.id,
      scope: "area",
      label: modifier.rewardCounterweight.label,
      aggregation: "per-area",
      value: modifier.rewardCounterweight.value,
      unit: modifier.rewardCounterweight.unit,
    }] : [],
  }));
  return [...borderSources, ...explicitSources];
}

function getBorderModifier(id) {
  return catalog.borderModifiers.find((entry) => entry.id === id) || null;
}

function borderModifierOptions() {
  return catalog.borderModifiers.map((modifier) => ({
    id: modifier.id,
    name: modifier.name,
    summary: modifier.summary,
    familyName: modifier.familyName,
    tierLabel: modifier.tierLabel,
    score: Math.round(modifier.effects.reduce((total, effect) => total + scoreEffect(effect, "general", 1), 0)),
  })).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

function inferAreaModifier(line) {
  const normalized = slugify(line);
  if (!normalized) return null;
  let best = null;
  let bestScore = -1;
  for (const modifier of allAreaModifierSources()) {
    const parts = [modifier.name, modifier.summary, ...modifier.effects.map((effect) => effect.label)].filter(Boolean).map(slugify);
    let score = 0;
    for (const part of parts) {
      if (part && normalized.includes(part)) score += part.length;
      else {
        const tokens = part.split(" ").filter((token) => token.length > 3);
        score += tokens.filter((token) => normalized.includes(token)).length * 3;
      }
    }
    const numeric = normalized.match(/\d+/)?.[0];
    if (numeric && parts.some((part) => part.includes(numeric))) score += 8;
    if (score > bestScore) { best = modifier; bestScore = score; }
  }
  if (!best || bestScore <= 0) {
    const value = Number(normalized.match(/\d+/)?.[0] || 1);
    const label = normalized.includes("sulphur") ? "Increased Dead Man's Sulphur found"
      : normalized.includes("quantity") ? "Increased Quantity of Items found"
      : normalized.includes("strongbox") ? "Strongboxes"
      : line.trim();
    return {
      id: `custom-${slugify(label).replace(/\s+/g, "-")}`,
      name: line.trim(),
      summary: line.trim(),
      sourceType: "custom",
      effects: [{ id: slugify(label).replace(/\s+/g, "-"), scope: "area", label, aggregation: "per-area", value, unit: normalized.includes("%") ? "%" : "" }],
    };
  }
  return best;
}

function parseAreaModifierText(text, tileIndex = 0) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  return raw.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[-—]+$/.test(line) && !/^area modifiers$/i.test(line))
    .map((line) => {
      const modifier = inferAreaModifier(line);
      return modifier ? { ...modifier, rawText: line, tileIndex } : null;
    })
    .filter(Boolean);
}

function normalizeAreaModifiers(areaModifiers = []) {
  return Array.from({ length: 9 }, (_, index) => areaModifiers[index] || []);
}

function normalizeBoardBorderModifiers(boardBorderModifiers = []) {
  return Array.from({ length: 9 }, (_, index) => {
    if (index === 4) return {};
    const raw = boardBorderModifiers[index];
    const entries = typeof raw === "string" || raw?.id
      ? [["border", typeof raw === "string" ? raw : raw.id]]
      : Object.entries(raw || {});
    return Object.fromEntries(entries.map(([side, value]) => {
      const id = typeof value === "string" ? value : value?.id;
      if (!id) return null;
      const modifier = getBorderModifier(id);
      if (!modifier) return null;
      return [side, {
        ...modifier,
        side,
        sourceType: "border",
        rawText: modifier.summary || modifier.name,
        tileIndex: index,
      }];
    }).filter(Boolean));
  });
}

function tileBorderModifierList(normalizedTileBorderModifiers) {
  if (!normalizedTileBorderModifiers) return [];
  if (Array.isArray(normalizedTileBorderModifiers)) return normalizedTileBorderModifiers.filter(Boolean);
  return Object.values(normalizedTileBorderModifiers).filter(Boolean);
}

function exposedBorderSides(index) {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return [
    row === 0 ? "north" : null,
    column === 2 ? "east" : null,
    row === 2 ? "south" : null,
    column === 0 ? "west" : null,
  ].filter(Boolean);
}

function emptyBoardBorderModifierState() {
  return Array.from({ length: 9 }, (_, index) => {
    const sides = exposedBorderSides(index);
    return Object.fromEntries(sides.map((side) => [side, null]));
  });
}

function setBoardBorderModifierValue(boardBorderModifiers = [], tileIndex, side, modifierId) {
  const next = emptyBoardBorderModifierState();
  const normalized = normalizeBoardBorderModifiers(boardBorderModifiers);
  normalized.forEach((tileModifiers, index) => {
    for (const [entrySide, modifier] of Object.entries(tileModifiers || {})) {
      const allowedSides = exposedBorderSides(index);
      const targetSide = allowedSides.includes(entrySide) ? entrySide : allowedSides[0];
      if (targetSide) next[index][targetSide] = modifier.id;
    }
  });
  if (!exposedBorderSides(tileIndex).includes(side)) throw new Error("That tile side is not on the Voyage board border.");
  next[tileIndex][side] = modifierId || null;
  return next;
}

function combinedTileModifiers(areaModifiers = [], boardBorderModifiers = []) {
  const normalizedAreaModifiers = normalizeAreaModifiers(areaModifiers);
  const normalizedBoardBorderModifiers = normalizeBoardBorderModifiers(boardBorderModifiers);
  return Array.from({ length: 9 }, (_, index) => [
    ...normalizedAreaModifiers[index],
    ...tileBorderModifierList(normalizedBoardBorderModifiers[index]),
  ]);
}

function areaModifierTileValue(modifiers, profileKey = "general") {
  return modifiers.reduce((total, modifier) => total + modifier.effects.reduce((sum, effect) => {
    return sum + scoreEffect(effect, profileKey, 1);
  }, 0), 0);
}

function areaTargetMultiplier(tileIndex, areaModifiers, profileKey = "general") {
  const tileValue = areaModifierTileValue(areaModifiers[tileIndex] || [], profileKey);
  return 1 + Math.min(1.75, Math.max(0, tileValue) / 5000);
}

function getImplicit(id) {
  return catalog.chartImplicits.find((entry) => entry.id === id) || null;
}

function getPattern(id) {
  return catalog.chartPatterns.find((entry) => entry.id === id) || null;
}

function scoreChart(chart, profileKey = "general", position = 4) {
  const implicit = getImplicit(chart.implicitId);
  const effectScore = implicit ? implicit.effects.reduce((total, effect) => {
    const targets = effectTargets(position, effect, chartConnections(chart));
    return total + scoreEffect(effect, profileKey, targets.length);
  }, 0) : 0;
  return effectScore + (tierOneUniqueAreaName(chart) ? TIER_ONE_UNIQUE_AREA_BONUS : 0);
}

function evaluateBoard(board, profileKey = "general", areaModifiers = [], boardBorderModifiers = []) {
  const normalizedAreaModifiers = normalizeAreaModifiers(areaModifiers);
  const normalizedBoardBorderModifiers = normalizeBoardBorderModifiers(boardBorderModifiers);
  const fixedTileModifiers = combinedTileModifiers(normalizedAreaModifiers, normalizedBoardBorderModifiers);
  const effectiveFixedTileModifiers = Array.from({ length: 9 }, () => []);
  const areaScores = Array.from({ length: 9 }, () => 0);
  const appliedModifiers = Array.from({ length: 9 }, () => []);
  const totals = new Map();
  const notes = [];
  fixedTileModifiers.forEach((modifiers, sourceTileIndex) => {
    modifiers.forEach((modifier) => {
      const targets = fixedModifierTargets(board, sourceTileIndex, modifier);
      if (modifier.sourceType === "border" && borderModifierAppliesToAdjacent(modifier) && !targets.length) {
        notes.push(`Inactive border mod: ${modifier.name} on tile ${sourceTileIndex + 1} has no touching reciprocal Chart line`);
      }
      targets.forEach((target) => effectiveFixedTileModifiers[target].push(modifier));
      modifier.effects.forEach((effect) => {
        const contributionPerTarget = scoreEffect(effect, profileKey, 1);
        targets.forEach((target) => {
          areaScores[target] += contributionPerTarget;
          appliedModifiers[target].push({
            source: modifier.sourceType === "border" ? `Board border at tile ${sourceTileIndex + 1}` : `Area modifier at tile ${sourceTileIndex + 1}`,
            sourceTile: sourceTileIndex,
            label: effect.label,
            value: medianEffectValue(effect),
            unit: effect.unit || "",
            scope: borderModifierAppliesToAdjacent(modifier) ? "connected-border" : effect.scope,
            score: contributionPerTarget,
          });
        });
        const key = `${effect.label}|${effect.unit || ""}`;
        const existing = totals.get(key) || { label: effect.label, unit: effect.unit || "", value: 0, count: 0, descriptive: 0 };
        if (effect.aggregation === "descriptive") existing.descriptive += targets.length;
        else existing.value += medianEffectValue(effect) * targets.length;
        existing.count += targets.length;
        totals.set(key, existing);
        if (weightFor(effect.label, profileKey) < 0 && targets.length) notes.push(`Risk: ${effect.label} from fixed tile ${sourceTileIndex + 1}`);
      });
    });
  });
  board.forEach((chart, index) => {
    if (!chart) return;
    const implicit = getImplicit(chart.implicitId);
    if (!implicit) return;
    implicit.effects.forEach((effect) => {
      const targets = effect.scope === "connected"
        ? reciprocalConnectedIndexes(board, index)
        : effectTargets(index, effect, chartConnections(chart));
      const contribution = scoreEffect(effect, profileKey, targets.length);
      targets.forEach((target) => {
        const tileMultiplier = areaTargetMultiplier(target, effectiveFixedTileModifiers, profileKey);
        const targetContribution = (contribution / Math.max(1, targets.length)) * tileMultiplier;
        areaScores[target] += targetContribution;
        appliedModifiers[target].push({
          source: `Chart #${chart.inventorySlot || "?"}`,
          sourceTile: index,
          label: effect.label,
          value: medianEffectValue(effect),
          unit: effect.unit || "",
          scope: effect.scope,
          score: targetContribution,
        });
      });
      const key = `${effect.label}|${effect.unit || ""}`;
      const existing = totals.get(key) || { label: effect.label, unit: effect.unit || "", value: 0, count: 0, descriptive: 0 };
      if (effect.aggregation === "descriptive") existing.descriptive += 1;
      else existing.value += medianEffectValue(effect) * Math.max(1, targets.length);
      existing.count += 1;
      totals.set(key, existing);
      if (weightFor(effect.label, profileKey) < 0) notes.push(`Risk: ${effect.label} from ${chart.displayName || chart.name}`);
    });
  });
  const validity = evaluateValidity(board);
  const routeScore = topologyScore(validity);
  const rewardScore = areaScores.reduce((a, b) => a + b, 0);
  const topTierRewardScore = appliedModifiers.flat().reduce((total, modifier) => {
    return total + (isTopTierRewardLabel(modifier.label) ? Math.max(0, modifier.score || 0) : 0);
  }, 0);
  const centerConnections = validity.degrees[4] || 0;
  const tierOneUniqueAreas = board.flatMap((chart) => {
    const name = tierOneUniqueAreaName(chart);
    return name ? [{ name, inventorySlot: chart.inventorySlot || null }] : [];
  });
  const score = rewardScore + routeScore;
  return {
    score,
    validScore: rewardScore,
    routeScore,
    rewardScore,
    topTierRewardScore,
    centerConnections,
    tierOneUniqueAreas,
    tierOneUniqueAreaCount: tierOneUniqueAreas.length,
    validity,
    areaScores,
    areaModifiers: normalizedAreaModifiers,
    boardBorderModifiers: normalizedBoardBorderModifiers,
    fixedTileModifiers,
    effectiveFixedTileModifiers,
    appliedModifiers,
    totals: Array.from(totals.values()).sort((a, b) => Math.abs(b.value || b.descriptive) - Math.abs(a.value || a.descriptive)),
    notes,
  };
}

function inferPattern(text) {
  const explicitShape = inferExplicitShapePattern(text);
  if (explicitShape) return explicitShape;
  const normalized = slugify(text);
  let best = catalog.chartPatterns[0];
  let bestScore = -1;
  for (const pattern of catalog.chartPatterns) {
    const names = [pattern.name, pattern.id].map(slugify);
    const score = names.reduce((s, name) => s + (name && normalized.includes(name) ? name.length : 0), 0);
    if (score > bestScore) { best = pattern; bestScore = score; }
  }
  return best;
}

function inferExplicitShapePattern(text) {
  const shapeLine = String(text || "").split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^chart\s+shape\s*:/i.test(line));
  if (!shapeLine) return null;
  const shape = slugify(shapeLine.replace(/^chart\s+shape\s*:/i, ""));
  const shapeToPattern = {
    strait: "straight-north-south",
    straight: "straight-north-south",
    line: "straight-north-south",
    corner: "corner-east-south",
    crossing: "cross",
    cross: "cross",
    plus: "cross",
    junction: "tee-north",
    tee: "tee-north",
    end: "end-north",
    deadend: "end-north",
    "dead end": "end-north",
  };
  return getPattern(shapeToPattern[shape]) || null;
}

function inferImplicit(text) {
  const normalized = slugify(text);
  let best = null;
  let bestScore = -1;
  for (const implicit of catalog.chartImplicits) {
    const parts = [implicit.name, implicit.summary, implicit.familyName, ...implicit.effects.map((effect) => effect.label)].filter(Boolean).map(slugify);
    let score = 0;
    for (const part of parts) {
      if (part && normalized.includes(part)) score += part.length;
      else {
        const tokens = part.split(" ").filter((token) => token.length > 3);
        score += tokens.filter((token) => normalized.includes(token)).length * 3;
      }
    }
    if (score > bestScore) { best = implicit; bestScore = score; }
  }
  return best || catalog.chartImplicits[0];
}

function parseChartText(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Clipboard is empty. Hover a Chart in PoE, press Ctrl+C, then import.");
  const pattern = inferPattern(raw);
  const implicit = inferImplicit(raw);
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const displayName = lines.find((line) => !line.includes("--------")) || implicit.name;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    displayName,
    baseId: catalog.chartBases[0]?.id || "charted-map",
    patternId: pattern.id,
    implicitId: implicit.id,
    connections: pattern.connections,
    rawText: raw,
    importedAt: new Date().toISOString(),
    parserConfidence: {
      pattern: pattern.name,
      implicit: implicit.name,
    },
  };
}

function chartSummary(chart, profileKey = "general") {
  const implicit = getImplicit(chart.implicitId);
  const pattern = getPattern(chart.patternId);
  const rotation = chart.rotation || 0;
  const itemLevel = Number(String(chart.rawText || chart.displayName || "").match(/(?:Item Level|L)[: ]+(\d+)/i)?.[1] || 0) || null;
  return {
    ...chart,
    implicitName: implicit?.name || chart.implicitId,
    implicitFamily: implicit?.familyName || "Unknown",
    category: implicit?.category || "Unknown",
    patternName: pattern?.name || chart.patternId,
    basePatternName: pattern?.name || chart.patternId,
    rotation,
    itemLevel,
    tierOneUniqueArea: tierOneUniqueAreaName(chart),
    connectionText: chartConnections({ ...chart, rotation }).join(", "),
    effects: implicit?.effects || [],
    score: Math.round(scoreChart(chart, profileKey)),
  };
}

const canonicalLayout = [
  "corner-east-south", "tee-south", "corner-south-west",
  "tee-east", "cross", "tee-west",
  "corner-north-east", "tee-north", "corner-west-north",
];

function patternFitScore(chart, index) {
  const canonical = getPattern(canonicalLayout[index]);
  if (!canonical) return 0;
  const connections = chartConnections(chart);
  let score = 0;
  for (const direction of connections) {
    const target = adjacentIndex(index, direction);
    if (target !== null) score += 3;
    else score -= 4;
  }
  for (const direction of canonical.connections) {
    if (connections.includes(direction)) score += 4;
    else score -= 2;
  }
  return score;
}

function rotationVariantsForPosition(chart, index) {
  const basePattern = getPattern(chart.patternId);
  const rotations = [0, 90, 180, 270];
  const seen = new Set();
  return rotations.map((rotation) => ({
    ...chart,
    rotation,
    connections: rotateConnections(basePattern?.connections || chart.connections || [], rotation),
  })).map((variant) => ({ ...variant, connectionText: variant.connections.join(", ") })).filter((variant) => {
    const key = variant.connections.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return variant.connections.some((direction) => adjacentIndex(index, direction) !== null);
  }).sort((left, right) => patternFitScore(right, index) - patternFitScore(left, index));
}

function bestRotationForPosition(chart, index, profileKey) {
  return rotationVariantsForPosition(chart, index)
    .sort((left, right) => (patternFitScore(right, index) * 1000 + scoreChart(right, profileKey, index)) - (patternFitScore(left, index) * 1000 + scoreChart(left, profileKey, index)))[0]
    || chart;
}

function directionBetween(from, to) {
  const delta = to - from;
  return Object.entries(OFFSETS).find(([, offset]) => offset === delta)?.[0] || null;
}

function connectionKey(connections) {
  return [...connections].sort().join("|");
}

function connectionMatchScore(connections, requiredConnections) {
  const required = new Set(requiredConnections);
  const actual = new Set(connections);
  const missing = [...required].filter((direction) => !actual.has(direction)).length;
  if (missing) return -1000000 - missing * 100000;
  const extras = [...actual].filter((direction) => !required.has(direction)).length;
  return extras === 0 ? 1000000 : 250000 - extras * 75000;
}

function hamiltonianPaths() {
  const paths = [];
  function walk(path, seen) {
    if (path.length === 9) {
      const reverseKey = [...path].reverse().join("-");
      const key = path.join("-");
      if (key <= reverseKey) paths.push([...path]);
      return;
    }
    const current = path[path.length - 1];
    for (const direction of DIRECTIONS) {
      const next = adjacentIndex(current, direction);
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      path.push(next);
      walk(path, seen);
      path.pop();
      seen.delete(next);
    }
  }
  for (let start = 0; start < 9; start += 1) walk([start], new Set([start]));
  return paths;
}

const ROUTE_TEMPLATES = hamiltonianPaths();

function requiredConnectionsForPath(path) {
  const required = Array.from({ length: 9 }, () => []);
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i];
    const to = path[i + 1];
    const direction = directionBetween(from, to);
    if (!direction) continue;
    required[from].push(direction);
    required[to].push(OPPOSITE[direction]);
  }
  return required;
}

function routeTemplateBoards(candidates, profileKey, limit = 128) {
  const boards = [];
  for (const path of ROUTE_TEMPLATES) {
    const requiredByTile = requiredConnectionsForPath(path);
    const order = [...path].sort((left, right) => requiredByTile[left].length - requiredByTile[right].length || left - right);
    let beams = [{ board: Array(9).fill(null), used: new Set(), score: 0 }];
    for (const index of order) {
      const required = requiredByTile[index];
      const expansions = [];
      for (const beam of beams) {
        for (const chart of candidates.filter((candidate) => !beam.used.has(candidate.id))) {
          const variants = rotationVariantsForPosition(chart, index)
            .map((variant) => ({ ...variant, matchScore: connectionMatchScore(chartConnections(variant), required) }))
            .filter((variant) => variant.matchScore > 0)
            .sort((a, b) => b.matchScore + scoreChart(b, profileKey, index) - (a.matchScore + scoreChart(a, profileKey, index)))
            .slice(0, 2);
          for (const variant of variants) {
            const nextBoard = [...beam.board];
            nextBoard[index] = variant;
            const nextUsed = new Set(beam.used);
            nextUsed.add(chart.id);
            expansions.push({ board: nextBoard, used: nextUsed, score: beam.score + variant.matchScore + scoreChart(variant, profileKey, index) });
          }
        }
      }
      beams = expansions.sort((a, b) => b.score - a.score).slice(0, 18);
      if (!beams.length) break;
    }
    for (const beam of beams.slice(0, 2)) {
      if (beam.board.every(Boolean)) boards.push(beam.board);
      if (boards.length >= limit) return boards;
    }
  }
  return boards;
}

function exactRunnableBoards(candidates, profileKey, limit = 128) {
  const beamWidth = 256;
  let beams = [{ board: Array(9).fill(null), used: new Set(), score: 0 }];
  for (let index = 0; index < 9; index += 1) {
    const expansions = [];
    for (const beam of beams) {
      for (const chart of candidates) {
        if (beam.used.has(chart.id)) continue;
        const variants = rotationVariantsForPosition(chart, index).filter((variant) => {
          const connections = chartConnections(variant);
          if (index >= 3) {
            const northHasSouth = chartConnections(beam.board[index - 3]).includes("south");
            if (connections.includes("north") !== northHasSouth) return false;
          }
          if (index % 3 !== 0) {
            const westHasEast = chartConnections(beam.board[index - 1]).includes("east");
            if (connections.includes("west") !== westHasEast) return false;
          }
          return true;
        });
        for (const variant of variants) {
          const nextBoard = [...beam.board];
          nextBoard[index] = variant;
          const nextUsed = new Set(beam.used);
          nextUsed.add(chart.id);
          const connections = chartConnections(variant);
          const closedEdges = (connections.includes("north") ? 1 : 0) + (connections.includes("west") ? 1 : 0);
          const centerBridgeBonus = index === 4 ? connections.length * 350000 : 0;
          expansions.push({
            board: nextBoard,
            used: nextUsed,
            score: beam.score + scoreChart(variant, profileKey, index) + closedEdges * 220000 + centerBridgeBonus,
          });
        }
      }
    }
    const seen = new Set();
    beams = expansions.sort((a, b) => b.score - a.score).filter((beam) => {
      const key = beam.board.slice(0, index + 1).map((chart) => `${chart?.id}:${chart?.rotation}`).join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, beamWidth);
    if (!beams.length) break;
  }
  return beams
    .filter((beam) => beam.board.every(Boolean) && evaluateValidity(beam.board).isRunnable)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((beam) => beam.board);
}

function compareEvaluatedLayouts(left, right) {
  const leftValidity = left.evaluation.validity;
  const rightValidity = right.evaluation.validity;
  const leftClass = leftValidity.isValid ? 1 : 0;
  const rightClass = rightValidity.isValid ? 1 : 0;
  if (leftClass !== rightClass) return rightClass - leftClass;
  const tierOneDifference = (right.evaluation.tierOneUniqueAreaCount || 0) - (left.evaluation.tierOneUniqueAreaCount || 0);
  if (tierOneDifference) return tierOneDifference;
  const topTierRewardDifference = (right.evaluation.topTierRewardScore || 0) - (left.evaluation.topTierRewardScore || 0);
  if (topTierRewardDifference) return topTierRewardDifference;
  const centerDifference = (rightValidity.degrees[4] || 0) - (leftValidity.degrees[4] || 0);
  if (centerDifference) return centerDifference;
  if (leftValidity.isLinearPath !== rightValidity.isLinearPath) return rightValidity.isLinearPath ? 1 : -1;
  if (left.evaluation.routeScore !== right.evaluation.routeScore) return right.evaluation.routeScore - left.evaluation.routeScore;
  return right.evaluation.rewardScore - left.evaluation.rewardScore;
}

function optimizeVoyage(charts, profileKey = "general", areaModifiers = [], boardBorderModifiers = []) {
  const normalizedAreaModifiers = normalizeAreaModifiers(areaModifiers);
  const normalizedBoardBorderModifiers = normalizeBoardBorderModifiers(boardBorderModifiers);
  const allCandidates = charts.map((chart) => chartSummary(chart, profileKey)).sort((a, b) => b.score - a.score);
  if (allCandidates.length < 9) {
    return { error: `Need at least 9 Charts; have ${allCandidates.length}.`, results: [] };
  }
  const candidates = allCandidates.slice(0, 18);
  const selected = candidates.slice(0, 12);
  const order = [4, 1, 3, 5, 7, 0, 2, 6, 8];
  const beamWidth = 96;
  let beams = [{ board: Array(9).fill(null), used: new Set(), heuristic: 0 }];

  for (let depth = 0; depth < order.length; depth += 1) {
    const index = order[depth];
    const expansions = [];
    for (const beam of beams) {
      const ranked = selected.filter((chart) => !beam.used.has(chart.id))
        .map((chart) => bestRotationForPosition(chart, index, profileKey))
        .sort((a, b) => (scoreChart(b, profileKey, index) + patternFitScore(b, index) * 1000) - (scoreChart(a, profileKey, index) + patternFitScore(a, index) * 1000))
        .slice(0, 8);
      for (const chart of ranked) {
        const nextBoard = [...beam.board];
        nextBoard[index] = chart;
        const nextUsed = new Set(beam.used);
        nextUsed.add(chart.id);
        const partialRoute = evaluateValidity(nextBoard);
        const local = scoreChart(chart, profileKey, index) + patternFitScore(chart, index) * 1200 + partialRoute.reciprocalEdges.length * 9000 - partialRoute.branchCount * 12000;
        expansions.push({ board: nextBoard, used: nextUsed, heuristic: beam.heuristic + local });
      }
    }
    beams = expansions.sort((a, b) => b.heuristic - a.heuristic).slice(0, beamWidth);
  }

  const routeBoards = routeTemplateBoards(candidates, profileKey, 128);
  const exactBoards = exactRunnableBoards(allCandidates, profileKey, 128);
  const allEvaluated = [
    ...beams.map((beam) => beam.board),
    ...routeBoards,
    ...exactBoards,
  ].map((board) => ({
    board,
    evaluation: evaluateBoard(board, profileKey, normalizedAreaModifiers, normalizedBoardBorderModifiers),
  })).sort(compareEvaluatedLayouts);
  const evaluated = allEvaluated.filter((entry) => entry.evaluation.validity.isRunnable);
  if (!evaluated.length) {
    return {
      error: "No runnable Voyage board exists with the active Charts. Internal Chart lines must connect reciprocally to adjacent tiles; outside-edge exits are allowed. Exclude incompatible Charts or import more shapes.",
      results: [],
      selectedCharts: selected.map((chart) => chartSummary(chart, profileKey)),
      searchedLayouts: allEvaluated.length,
      exactBoards: 0,
    };
  }
  const results = evaluated
    .sort(compareEvaluatedLayouts)
    .filter((result, index, array) => index === array.findIndex((candidate) => candidate.board.map((chart) => `${chart?.id}:${chart?.rotation}`).join("|") === result.board.map((chart) => `${chart?.id}:${chart?.rotation}`).join("|")))
    .slice(0, 4)
    .map((result, rank) => ({ rank: rank + 1, ...result }));

  return { results, selectedCharts: selected.map((chart) => chartSummary(chart, profileKey)), areaModifiers: normalizedAreaModifiers, boardBorderModifiers: normalizedBoardBorderModifiers, searchedLayouts: allEvaluated.length, runnableLayouts: evaluated.length, routeTemplates: routeBoards.length, exactBoards: exactBoards.length, beamWidth };
}

module.exports = {
  catalog,
  PROFILES,
  parseChartText,
  chartSummary,
  scoreChart,
  evaluateBoard,
  evaluateValidity,
  optimizeVoyage,
  borderModifierOptions,
  normalizeBoardBorderModifiers,
  emptyBoardBorderModifierState,
  exposedBorderSides,
  setBoardBorderModifierValue,
  getBorderModifier,
  parseAreaModifierText,
  inferAreaModifier,
  inferImplicit,
  inferPattern,
  inferExplicitShapePattern,
  chartConnections,
  TIER_ONE_UNIQUE_AREAS,
  tierOneUniqueAreaName,
};
