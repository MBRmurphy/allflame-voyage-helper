const assert = require("node:assert/strict");
const core = require("./src/shared/voyage-core.js");

const sample = `Item Class: Stackable Currency\nRarity: Rare\nNorth-east corner Chart\n--------\n5% Increased Pack size Voyage-wide\n--------\nCharted Map`;
const chart = core.parseChartText(sample);
assert.equal(chart.patternId, "corner-north-east");
assert.ok(chart.implicitId.includes("pack-size"));
const shapeCases = {
  Strait: "straight-north-south",
  Corner: "corner-east-south",
  Crossing: "cross",
  End: "end-north",
  Junction: "tee-north",
};
for (const [shape, expectedPatternId] of Object.entries(shapeCases)) {
  const parsed = core.parseChartText(`Item Class: Stackable Currency\nRarity: Rare\nCharted Map\n--------\nChart Shape: ${shape}\n--------\n5% Increased Pack size Voyage-wide`);
  assert.equal(parsed.patternId, expectedPatternId, `Chart Shape ${shape} should parse as ${expectedPatternId}`);
}
const charts = core.catalog.chartPatterns.slice(0, 9).map((pattern, index) => ({
  id: `test-${index}`,
  displayName: `Test ${index}`,
  baseId: "charted-map",
  patternId: pattern.id,
  implicitId: core.catalog.chartImplicits.find((implicit) => implicit.familyId === "adjacent-strongboxes")?.id || core.catalog.chartImplicits[index].id,
  connections: pattern.connections,
  inventorySlot: index + 1,
  rawText: "",
}));
const summary = core.chartSummary(charts[0], "general");
assert.ok(summary.score > 0);
const tierOneAreaSamples = [
  "Diving Shoals",
  "Pelagic Abyss",
  "Sea Pillars",
  "Sunken Totems",
  "Clam Infested-shelf",
  "Kishara's rest",
  "lost ruins",
  "Hazardous Depths",
  "Brine King’s Domain",
  "Anchorfield",
  "infested bathyspheres",
];
tierOneAreaSamples.forEach((name) => assert.ok(core.tierOneUniqueAreaName({ rawText: `Rarity: Unique\n${name}` }), `${name} should be detected as T1`));
assert.equal(core.TIER_ONE_UNIQUE_AREAS.length, 11, "All eleven T1 unique areas should be registered exactly once");
const normalChartScore = core.scoreChart(charts[0], "general");
const tierOneChartScore = core.scoreChart({ ...charts[0], rawText: "Rarity: Unique\nDiving Shoals" }, "general");
assert.ok(tierOneChartScore > normalChartScore + 400000, "T1 unique areas should receive a dominant optimizer bonus");
const areaMods = Array.from({ length: 9 }, () => []);
areaMods[4] = core.parseAreaModifierText("32% Increased Pack size\n3 Diviner's Strongboxes", 4);
assert.ok(areaMods[4].length >= 2);
const borderMods = Array.from({ length: 9 }, () => null);
borderMods[0] = { north: "more-rarity3", west: "pack-size3" };
borderMods[4] = { north: "pack-size3" };
const normalizedBorders = core.normalizeBoardBorderModifiers(borderMods);
assert.deepEqual(normalizedBorders[4], {});
assert.ok(normalizedBorders[0].north.name.includes("Rarity"));
assert.equal(core.exposedBorderSides(0).length, 2);
assert.ok(core.borderModifierOptions().length > 20);
const opt = core.optimizeVoyage(charts, "general", areaMods, borderMods);
assert.ok(opt.results.length > 0);
assert.equal(opt.results[0].board.length, 9);
assert.ok(opt.results[0].evaluation.areaModifiers[4].length >= 2);
assert.deepEqual(opt.results[0].evaluation.boardBorderModifiers[4], {});
assert.ok(opt.results[0].evaluation.fixedTileModifiers[0].length >= 2);
assert.ok(opt.results[0].board.every((placed) => Number.isInteger(placed.inventorySlot)));
assert.ok(opt.results[0].evaluation.appliedModifiers.some((mods) => mods.some((modifier) => /^Chart #\d+/.test(modifier.source))));
assert.ok(Number.isFinite(opt.results[0].evaluation.routeScore));
assert.ok(Array.isArray(opt.results[0].evaluation.validity.degrees));
assert.equal(opt.results[0].evaluation.validity.isValid, true);
assert.equal(opt.results[0].evaluation.centerConnections, 4, "Tile 5 should prefer a four-way bridge when a valid Crossing is available");
assert.equal(opt.results[0].board[4].patternId, "cross");
assert.ok(opt.results[0].board.some((placed) => placed.rotation !== undefined));
assert.ok(opt.searchedLayouts <= 400);
assert.ok(opt.results.every((result) => result.evaluation.validity.isRunnable));
assert.ok(opt.results.every((result) => result.evaluation.validity.invalidConnectors.length === 0));
assert.ok(core.PROFILES.general.weights["Diviner's Strongboxes"] > core.PROFILES.general.weights["Increased Dead Man's Sulphur found"]);
assert.deepEqual(core.chartConnections({ patternId: "end-north", connections: ["south"], rotation: 180 }), ["south"]);
assert.deepEqual(core.chartConnections({ patternId: "cross", connections: ["north", "east", "south", "west"], rotation: 90 }).sort(), ["east", "north", "south", "west"]);

const crossPattern = core.catalog.chartPatterns.find((entry) => entry.id === "cross");
const connectedStrongboxImplicit = core.catalog.chartImplicits.find((implicit) => implicit.familyId === "adjacent-strongboxes");
const centerAdjacencyBoard = Array.from({ length: 9 }, (_, index) => ({
  id: `center-adjacency-${index}`,
  inventorySlot: index + 1,
  displayName: `Center adjacency ${index + 1}`,
  patternId: "cross",
  connections: crossPattern.connections,
  implicitId: connectedStrongboxImplicit.id,
  rotation: 0,
}));
const centerAdjacencyEvaluation = core.evaluateBoard(centerAdjacencyBoard, "general");
assert.equal(centerAdjacencyEvaluation.validity.degrees[4], 4, "Tile 5 must have all four reciprocal neighboring connections");
const centerOutgoingTargets = centerAdjacencyEvaluation.appliedModifiers.flatMap((modifiers, targetIndex) => modifiers.some((modifier) => modifier.sourceTile === 4 && modifier.label === "Strongboxes") ? [targetIndex] : []).sort((a, b) => a - b);
assert.deepEqual(centerOutgoingTargets, [1, 3, 5, 7], "Tile 5 connected weighting must apply to tiles 2, 4, 6, and 8");
const centerIncomingSources = centerAdjacencyEvaluation.appliedModifiers[4].filter((modifier) => modifier.label === "Strongboxes").map((modifier) => modifier.sourceTile).sort((a, b) => a - b);
assert.deepEqual(centerIncomingSources, [1, 3, 5, 7], "Tile 5 must receive connected weighting from all four touching adjacent tiles");
assert.ok(centerAdjacencyEvaluation.areaScores[4] > 0);
const touchingBorderBoard = Array(9).fill(null);
touchingBorderBoard[0] = { id: "border-source", patternId: "end-north", rotation: 90 };
touchingBorderBoard[1] = { id: "border-target", patternId: "end-north", rotation: 270 };
const touchingBorderMods = Array.from({ length: 9 }, () => ({}));
touchingBorderMods[0] = { north: "golden-lanterns" };
const touchingBorderEvaluation = core.evaluateBoard(touchingBorderBoard, "general", [], touchingBorderMods);
assert.equal(touchingBorderEvaluation.appliedModifiers[0].some((modifier) => modifier.label === "Golden Lanterns"), false, "An adjacent border mod should not apply to its source tile");
assert.equal(touchingBorderEvaluation.appliedModifiers[1].some((modifier) => modifier.label === "Golden Lanterns" && modifier.scope === "connected-border"), true, "An adjacent border mod should cross a reciprocal touching line");
assert.equal(touchingBorderEvaluation.effectiveFixedTileModifiers[1].some((modifier) => modifier.id === "golden-lanterns"), true);
assert.ok(touchingBorderEvaluation.topTierRewardScore > 0);
const disconnectedBorderBoard = Array(9).fill(null);
disconnectedBorderBoard[0] = { id: "border-disconnected", patternId: "end-north", rotation: 0 };
const disconnectedBorderEvaluation = core.evaluateBoard(disconnectedBorderBoard, "general", [], touchingBorderMods);
assert.equal(disconnectedBorderEvaluation.appliedModifiers.flat().some((modifier) => modifier.label === "Golden Lanterns"), false, "Adjacent border mods need a reciprocal touching line");
assert.ok(disconnectedBorderEvaluation.notes.some((note) => note.includes("Inactive border mod")));
const divineBorderMods = Array.from({ length: 9 }, () => ({}));
divineBorderMods[0] = { north: "rare-monster-divine" };
const divineBorderEvaluation = core.evaluateBoard(disconnectedBorderBoard, "general", [], divineBorderMods);
assert.equal(divineBorderEvaluation.appliedModifiers[0].some((modifier) => modifier.label === "Additional Divine Orb"), true, "Self/Area border mods should stay on their border tile without requiring an internal line");
assert.ok(divineBorderEvaluation.topTierRewardScore > touchingBorderEvaluation.topTierRewardScore, "A Divine outcome should outrank one Golden Lantern application");
assert.ok(core.PROFILES.general.weights["Additional Divine Orb"] > core.PROFILES.general.weights["Golden Lanterns"]);
assert.ok(core.PROFILES.general.weights["Golden Lanterns"] > core.PROFILES.general.weights["Item Quantity"]);
const topBorderOptions = core.borderModifierOptions().slice(0, 6).map((option) => option.name);
assert.ok(topBorderOptions.some((name) => name.includes("Divine Orb")));
assert.ok(topBorderOptions.some((name) => name.includes("Golden Lanterns")));
const tierOneCrossPool = Array.from({ length: 10 }, (_, index) => ({
  ...charts[0],
  id: `tier-one-pool-${index}`,
  patternId: "cross",
  connections: crossPattern.connections,
  inventorySlot: index + 1,
  rawText: index === 9 ? "Rarity: Unique\nDiving Shoals\nChart Shape: Crossing" : "Chart Shape: Crossing",
}));
const tierOneOpt = core.optimizeVoyage(tierOneCrossPool, "general");
assert.ok(tierOneOpt.results[0].board.some((placed) => placed.id === "tier-one-pool-9"), "A runnable T1 unique area must be selected over an equivalent normal Chart");
assert.equal(tierOneOpt.results[0].evaluation.tierOneUniqueAreaCount, 1);
const outsideExitBoard = Array.from({ length: 9 }, (_, index) => ({
  id: `outside-${index}`,
  patternId: "cross",
  connections: crossPattern.connections,
  rotation: 0,
}));
const outsideExitValidity = core.evaluateValidity(outsideExitBoard);
assert.equal(outsideExitValidity.isRunnable, true, "Outside-edge Chart lines must be allowed");
assert.equal(outsideExitValidity.invalidConnectors.length, 0);
const outsideExitOpt = core.optimizeVoyage(outsideExitBoard.map((chart, index) => ({
  ...chart,
  displayName: `Outside ${index}`,
  baseId: "charted-map",
  implicitId: core.catalog.chartImplicits[index % core.catalog.chartImplicits.length].id,
  inventorySlot: index + 1,
  rawText: "",
})), "general");
assert.ok(outsideExitOpt.results.length > 0, "Optimizer must not omit boards solely because lines exit the outer border");
assert.ok(outsideExitOpt.results[0].evaluation.validity.isRunnable);
const internalMismatchBoard = outsideExitBoard.map((chart) => ({ ...chart }));
internalMismatchBoard[4] = { id: "mismatch-center", patternId: "end-north", connections: ["north"], rotation: 0 };
assert.equal(core.evaluateValidity(internalMismatchBoard).isRunnable, false, "Internal adjacent lines must remain reciprocal");

const routeCharts = [
  "end-north", "end-east",
  "straight-north-south", "straight-east-west", "straight-north-south",
  "corner-east-south", "corner-south-west", "corner-west-north", "corner-north-east",
  "tee-north", "cross",
].map((patternId, index) => {
  const pattern = core.catalog.chartPatterns.find((entry) => entry.id === patternId);
  return {
    id: `route-${index}`,
    displayName: `Route ${index}`,
    baseId: "charted-map",
    patternId,
    implicitId: core.catalog.chartImplicits.find((implicit) => implicit.familyId === "adjacent-strongboxes")?.id || core.catalog.chartImplicits[index].id,
    connections: pattern.connections,
    inventorySlot: index + 1,
    rawText: "",
  };
});
const routeOpt = core.optimizeVoyage(routeCharts, "general", areaMods, borderMods);
assert.equal(routeOpt.results[0].evaluation.validity.isLinearPath, true);
assert.equal(routeOpt.results[0].evaluation.validity.reciprocalEdges.length, 8);
const reciprocalSet = new Set(routeOpt.results[0].evaluation.validity.reciprocalEdges.flatMap(([a, b]) => [`${a}-${b}`, `${b}-${a}`]));
routeOpt.results[0].board.forEach((placed, index, board) => {
  const live = core.chartConnections(placed).filter((direction) => {
    const target = direction === "north" ? index - 3 : direction === "south" ? index + 3 : direction === "east" ? index + 1 : index - 1;
    return target >= 0 && target < 9 && board[target] && reciprocalSet.has(`${index}-${target}`);
  });
  assert.ok(live.length >= 1, `Board tile ${index + 1} must display at least one runnable reciprocal connector`);
});
for (const [left, right] of routeOpt.results[0].evaluation.validity.reciprocalEdges) {
  assert.ok(core.evaluateValidity(routeOpt.results[0].board).degrees[left] > 0);
  assert.ok(core.evaluateValidity(routeOpt.results[0].board).degrees[right] > 0);
}

const manyCharts = Array.from({ length: 24 }, (_, index) => ({
  ...charts[index % charts.length],
  id: `many-${index}`,
  implicitId: core.catalog.chartImplicits[index % core.catalog.chartImplicits.length].id,
}));
const start = Date.now();
const manyOpt = core.optimizeVoyage(manyCharts, "general", areaMods, borderMods);
const elapsedMs = Date.now() - start;
assert.ok(manyOpt.results.length > 0);
assert.ok(elapsedMs < 15000, `Bounded optimizer took ${elapsedMs} ms`);
console.log("All tests passed");
