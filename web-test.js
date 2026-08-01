const assert = require("node:assert/strict");
const { STORAGE_KEY, createWebVoyageApi } = require("./src/web-state.js");

const values = new Map();
const storage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const firstChart = `Item Class: Stackable Currency\nRarity: Rare\nCharted Map\n--------\nChart Shape: Crossing\n--------\n5% Increased Pack size Voyage-wide`;
const secondChart = `Item Class: Stackable Currency\nRarity: Rare\nCharted Map Two\n--------\nChart Shape: Junction\n--------\nAdjacent Charts contain 1 additional Strongbox`;

(async () => {
  const api = createWebVoyageApi({ storage, clipboard: { readText: async () => secondChart } });
  assert.equal(api.getState().runtime, "web");
  assert.equal(api.getState().privacyMode, "browser-local");
  api.importText(firstChart);
  assert.equal(api.getState().charts.length, 1);
  assert.ok(values.get(STORAGE_KEY).includes("Chart Shape: Crossing"));
  await api.importClipboard();
  assert.equal(api.getState().charts.length, 2);
  const borderId = api.getState().borderModifierOptions[0].id;
  api.setBoardBorderModifier(0, "north", borderId);
  assert.equal(api.getState().boardBorderModifiers[0].north.id, borderId);

  const reloaded = createWebVoyageApi({ storage });
  assert.equal(reloaded.getState().charts.length, 2);
  assert.equal(reloaded.getState().boardBorderModifiers[0].north.id, borderId);
  reloaded.clearAll();
  assert.equal(reloaded.getState().charts.length, 0);
  assert.equal(values.has(STORAGE_KEY), false);

  const memoryOnly = createWebVoyageApi();
  assert.equal(memoryOnly.getState().privacyMode, "memory-only");
  assert.equal(typeof global.fetch, "function");
  assert.equal(Object.prototype.hasOwnProperty.call(memoryOnly, "upload"), false);
  console.log("Web adapter tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
