const core = require("./shared/voyage-core.js");

const STORAGE_KEY = "poe-allflame-voyage-helper:web:v1";

function defaultState() {
  return {
    charts: [],
    excludedChartIds: [],
    areaModifiers: Array.from({ length: 9 }, () => []),
    boardBorderModifiers: core.emptyBoardBorderModifierState(),
    selectedAreaTile: 0,
    profile: "general",
    lastImport: null,
    optimizer: null,
    sequenceImportActive: false,
    status: "Ready — data stays in this browser",
  };
}

function createWebVoyageApi({ storage = null, clipboard = null } = {}) {
  const listeners = new Set();
  let state = defaultState();
  let storageEnabled = Boolean(storage);

  function load() {
    if (!storageEnabled) return;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state = { ...state, ...saved, optimizer: null, sequenceImportActive: false };
      state.areaModifiers = Array.from({ length: 9 }, (_, index) => Array.isArray(state.areaModifiers?.[index]) ? state.areaModifiers[index] : []);
      state.boardBorderModifiers = core.normalizeBoardBorderModifiers(state.boardBorderModifiers);
      state.excludedChartIds = Array.isArray(state.excludedChartIds) ? state.excludedChartIds : [];
      state.charts = Array.isArray(state.charts) ? state.charts.map((chart) => {
        if (!chart?.rawText || !/^chart\s+shape\s*:/im.test(chart.rawText)) return chart;
        try {
          const parsed = core.parseChartText(chart.rawText);
          return { ...chart, patternId: parsed.patternId, connections: parsed.connections, implicitId: parsed.implicitId, parserConfidence: parsed.parserConfidence };
        } catch { return chart; }
      }) : [];
      state.status = "Loaded data stored locally in this browser";
    } catch {
      storageEnabled = false;
      state = defaultState();
      state.status = "Browser storage unavailable — using this tab only";
    }
  }

  function persist() {
    if (!storageEnabled) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        charts: state.charts,
        excludedChartIds: state.excludedChartIds,
        areaModifiers: state.areaModifiers,
        boardBorderModifiers: state.boardBorderModifiers,
        selectedAreaTile: state.selectedAreaTile,
        profile: state.profile,
      }));
    } catch {
      storageEnabled = false;
      state.status = "Browser storage is full or blocked — changes now last only for this tab";
    }
  }

  function publicState() {
    const slotById = new Map(state.charts.map((chart, index) => [chart.id, index + 1]));
    return {
      ...state,
      runtime: "web",
      privacyMode: storageEnabled ? "browser-local" : "memory-only",
      areaModifiers: Array.from({ length: 9 }, (_, index) => state.areaModifiers[index] || []),
      boardBorderModifiers: core.normalizeBoardBorderModifiers(state.boardBorderModifiers),
      borderModifierOptions: core.borderModifierOptions(),
      profiles: Object.fromEntries(Object.entries(core.PROFILES).map(([key, profile]) => [key, profile.label])),
      charts: state.charts.map((chart, index) => ({
        ...core.chartSummary(chart, state.profile),
        inventorySlot: index + 1,
        excluded: state.excludedChartIds.includes(chart.id),
      })),
      chartSlots: Object.fromEntries(slotById),
    };
  }

  function emit() {
    const payload = publicState();
    listeners.forEach((listener) => listener(payload));
    return payload;
  }

  function importText(text, source = "text box") {
    const rawText = String(text || "").trim();
    if (!rawText) throw new Error("Paste copied Chart text first.");
    if (state.charts.some((chart) => chart.rawText === rawText)) {
      state.status = "Skipped duplicate Chart already in inventory";
      emit();
      return state.lastImport;
    }
    if (state.charts.length >= 60) throw new Error("Chart inventory is full (60/60). Clear or remove Charts before importing more.");
    const chart = core.parseChartText(rawText);
    state.charts.push(chart);
    state.lastImport = core.chartSummary(chart, state.profile);
    state.optimizer = null;
    state.status = `Imported ${state.lastImport.implicitName} (${state.lastImport.patternName}) from ${source}`;
    persist();
    emit();
    return state.lastImport;
  }

  function removeChart(id) {
    state.charts = state.charts.filter((chart) => chart.id !== id);
    state.excludedChartIds = state.excludedChartIds.filter((chartId) => chartId !== id);
    state.optimizer = null;
    state.status = "Removed Chart from browser inventory";
    persist();
    return emit();
  }

  function toggleChartExcluded(id) {
    const excluded = new Set(state.excludedChartIds);
    excluded.has(id) ? excluded.delete(id) : excluded.add(id);
    state.excludedChartIds = [...excluded];
    state.optimizer = null;
    state.status = excluded.has(id) ? "Excluded Chart from optimization" : "Returned Chart to optimization";
    persist();
    return emit();
  }

  function clearCharts() {
    state.charts = [];
    state.excludedChartIds = [];
    state.optimizer = null;
    state.lastImport = null;
    state.status = "Cleared browser-local Chart inventory";
    persist();
    return emit();
  }

  function clearAll() {
    state = defaultState();
    state.status = "Cleared all browser-local Voyage data";
    if (storageEnabled) {
      try { storage.removeItem(STORAGE_KEY); }
      catch { storageEnabled = false; }
    }
    return emit();
  }

  function setBoardBorderModifier(tileIndex, side, modifierId) {
    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex > 8) throw new Error("Tile must be 1-9.");
    if (tileIndex === 4) throw new Error("Middle tile has no board border modifier.");
    if (modifierId === undefined) { modifierId = side; side = core.exposedBorderSides(tileIndex)[0]; }
    if (!core.exposedBorderSides(tileIndex).includes(side)) throw new Error("That tile side is not on the Voyage board border.");
    const modifier = modifierId ? core.getBorderModifier(modifierId) : null;
    if (modifierId && !modifier) throw new Error("Unknown board border modifier.");
    state.boardBorderModifiers = core.setBoardBorderModifierValue(state.boardBorderModifiers, tileIndex, side, modifier?.id || null);
    state.optimizer = null;
    state.status = modifier ? `Selected ${side} border mod for tile ${tileIndex + 1}: ${modifier.name}` : `Cleared ${side} border mod for tile ${tileIndex + 1}`;
    persist();
    return emit();
  }

  function setProfile(profile) {
    if (core.PROFILES[profile]) state.profile = profile;
    state.optimizer = null;
    state.status = `Scoring profile: ${core.PROFILES[state.profile].label}`;
    persist();
    return emit();
  }

  function optimize() {
    const activeCharts = state.charts
      .map((chart, index) => ({ ...chart, inventorySlot: index + 1 }))
      .filter((chart) => !state.excludedChartIds.includes(chart.id));
    state.optimizer = core.optimizeVoyage(activeCharts, state.profile, state.areaModifiers, state.boardBorderModifiers);
    state.status = state.optimizer.error || `Optimized ${activeCharts.length} active Charts (${state.excludedChartIds.length} excluded)`;
    emit();
    return state.optimizer;
  }

  async function importClipboard() {
    if (!clipboard?.readText) throw new Error("Clipboard access is unavailable. Paste the Chart text into the text box instead.");
    const text = await clipboard.readText();
    return importText(text, "browser clipboard");
  }

  load();

  return {
    getState: () => publicState(),
    importText,
    importClipboard,
    toggleSequenceImport: () => {
      state.sequenceImportActive = false;
      state.status = "Browsers cannot continuously monitor the clipboard. Use Import Clipboard or paste copied Chart text.";
      return emit();
    },
    removeChart,
    toggleChartExcluded,
    clearCharts,
    clearAll,
    setBoardBorderModifier,
    setProfile,
    optimize,
    toggleOverlay: () => false,
    onState: (callback) => { listeners.add(callback); return () => listeners.delete(callback); },
    onOverlayMessage: () => () => {},
    onCursor: () => () => {},
  };
}

module.exports = { STORAGE_KEY, createWebVoyageApi };
