const { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const core = require("./shared/voyage-core.js");
const updateCore = require("./shared/update-core.js");

const UPDATE_REPOSITORY = "MBRmurphy/allflame-voyage-helper";
const UPDATE_RELEASE_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_HELPER_PATH = path.join(__dirname, "install-update.ps1");
const MAX_UPDATE_BYTES = 250 * 1024 * 1024;

let overlayWindow;
let controlWindow;
let overlayVisible = false;
let hoverTimer;
let sequenceImportTimer;
let lastSequenceClipboard = "";
let isQuitting = false;
let state = {
  charts: [],
  excludedChartIds: [],
  areaModifiers: Array.from({ length: 9 }, () => []),
  boardBorderModifiers: core.emptyBoardBorderModifierState(),
  selectedAreaTile: 0,
  profile: "general",
  lastImport: null,
  optimizer: null,
  update: null,
  sequenceImportActive: false,
  status: "Ready",
};

app.setName("PoE Allflame Voyage Helper");
app.setPath("userData", path.join(app.getPath("appData"), "poe-allflame-voyage-helper"));
app.setPath("sessionData", path.join(os.tmpdir(), "poe-allflame-voyage-helper-cache"));
app.commandLine.appendSwitch("disable-http-cache");

function appFile(name) { return path.join(__dirname, name); }
function storeFile() { return path.join(app.getPath("userData"), "charts.json"); }

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(storeFile(), "utf8"));
    state = { ...state, ...saved, status: "Loaded saved Chart inventory" };
    if (!Array.isArray(state.areaModifiers) || state.areaModifiers.length !== 9) state.areaModifiers = Array.from({ length: 9 }, () => []);
    if (!Array.isArray(state.boardBorderModifiers) || state.boardBorderModifiers.length !== 9) state.boardBorderModifiers = core.emptyBoardBorderModifierState();
    state.boardBorderModifiers = core.setBoardBorderModifierValue(state.boardBorderModifiers, 0, "north", core.normalizeBoardBorderModifiers(state.boardBorderModifiers)[0]?.north?.id || state.boardBorderModifiers[0]?.north || null);
    if (!Array.isArray(state.excludedChartIds)) state.excludedChartIds = [];
    let reparsedCount = 0;
    state.charts = (state.charts || []).map((chart) => {
      if (!chart.rawText || !/^chart\s+shape\s*:/im.test(chart.rawText)) return chart;
      try {
        const reparsed = core.parseChartText(chart.rawText);
        if (reparsed.patternId !== chart.patternId) reparsedCount += 1;
        return {
          ...chart,
          patternId: reparsed.patternId,
          connections: reparsed.connections,
          implicitId: reparsed.implicitId,
          parserConfidence: reparsed.parserConfidence,
        };
      } catch { return chart; }
    });
    state.charts = core.normalizeInventorySlots(state.charts);
    if (reparsedCount) {
      state.optimizer = null;
      state.status = `Corrected ${reparsedCount} saved Chart shape(s) from Chart Shape lines`;
      saveState();
    }
  } catch { state.status = "Ready"; }
}

function saveState() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(storeFile(), JSON.stringify({
    charts: state.charts,
    excludedChartIds: state.excludedChartIds,
    areaModifiers: state.areaModifiers,
    boardBorderModifiers: state.boardBorderModifiers,
    selectedAreaTile: state.selectedAreaTile,
    profile: state.profile,
  }, null, 2));
}

function publicState() {
  const slotById = new Map(state.charts.map((chart) => [chart.id, chart.inventorySlot]));
  const voyageUnderwayChartIds = core.availableVoyageUnderwayChartIds(state.optimizer, state.charts);
  const bestEvaluation = state.optimizer?.results?.[0]?.evaluation || null;
  return {
    ...state,
    areaModifiers: Array.from({ length: 9 }, (_, index) => state.areaModifiers[index] || []),
    boardBorderModifiers: core.normalizeBoardBorderModifiers(state.boardBorderModifiers),
    borderModifierOptions: core.borderModifierOptions(),
    profiles: Object.fromEntries(Object.entries(core.PROFILES).map(([key, profile]) => [key, profile.label])),
    charts: state.charts.map((chart) => ({
      ...core.chartSummary(chart, state.profile),
      inventorySlot: chart.inventorySlot,
      excluded: state.excludedChartIds.includes(chart.id),
    })),
    chartSlots: Object.fromEntries(slotById),
    inventoryPageSize: core.INVENTORY_PAGE_SIZE,
    inventoryPageCount: core.INVENTORY_PAGE_COUNT,
    inventoryMaxSlots: core.INVENTORY_MAX_SLOTS,
    voyageUnderwayCount: voyageUnderwayChartIds.length,
    strategyGuide: core.strategyGuide(state.profile, bestEvaluation, state.boardBorderModifiers),
  };
}

function broadcast() {
  const payload = publicState();
  if (controlWindow && !controlWindow.isDestroyed()) controlWindow.webContents.send("state", payload);
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("state", payload);
}

function showOverlayMessage(message, kind = "info") {
  // Overlay callouts are intentionally disabled; keep imports/optimizer read-only in the control window.
}

function createOverlay() {
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.bounds;
  overlayWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: { preload: appFile("preload.js"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(appFile("overlay.html"));
  overlayWindow.once("ready-to-show", () => overlayWindow.showInactive());
  overlayWindow.on("closed", () => { overlayWindow = null; });
}

function createControl() {
  controlWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 820,
    minHeight: 620,
    title: "PoE Allflame Voyage Helper",
    backgroundColor: "#08111d",
    webPreferences: { preload: appFile("preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  controlWindow.setMenuBarVisibility(false);
  controlWindow.loadFile(appFile("control.html"));
  controlWindow.once("ready-to-show", () => { controlWindow.show(); broadcast(); });
  controlWindow.on("close", () => {
    if (!isQuitting) app.quit();
  });
  controlWindow.on("closed", () => { controlWindow = null; });
}

function importText(text, source = "manual") {
  const rawText = String(text || "").trim();
  if (state.charts.some((chart) => chart.rawText && chart.rawText === rawText)) {
    state.status = "Skipped duplicate Chart already in inventory";
    broadcast();
    showOverlayMessage(state.status, "info");
    return state.lastImport;
  }
  if (state.charts.length >= core.INVENTORY_MAX_SLOTS) {
    throw new Error(`Chart inventory is full (${core.INVENTORY_MAX_SLOTS}/${core.INVENTORY_MAX_SLOTS}). Clear or remove Charts before importing more.`);
  }
  const chart = core.parseChartText(rawText);
  chart.inventorySlot = core.firstAvailableInventorySlot(state.charts);
  state.charts.push(chart);
  state.lastImport = core.chartSummary(chart, state.profile);
  state.optimizer = null;
  state.status = `Imported ${state.lastImport.implicitName} (${state.lastImport.patternName}) from ${source}`;
  saveState();
  broadcast();
  showOverlayMessage(`${state.lastImport.score} · ${state.lastImport.implicitName}\n${state.lastImport.patternName}`, state.lastImport.score > 2500 ? "good" : "info");
  return state.lastImport;
}

function importClipboardSafely(source) {
  try { return importText(clipboard.readText(), source); }
  catch (error) { state.status = error.message; broadcast(); showOverlayMessage(error.message, "warn"); return null; }
}

function optimize() {
  const activeCharts = state.charts
    .map((chart) => ({ ...chart }))
    .filter((chart) => !state.excludedChartIds.includes(chart.id));
  state.optimizer = core.optimizeVoyage(activeCharts, state.profile, state.areaModifiers, state.boardBorderModifiers);
  state.status = state.optimizer.error || `Optimized ${activeCharts.length} active Charts (${state.excludedChartIds.length} excluded)`;
  broadcast();
  if (state.optimizer.results?.[0]) showOverlayMessage(`Best Voyage score ${Math.round(state.optimizer.results[0].evaluation.validScore)} (${core.PROFILES[state.profile].label})`, "good");
  return state.optimizer;
}

function voyageUnderway() {
  const removal = core.removeVoyageCharts(state.charts, state.excludedChartIds, state.optimizer);
  state.charts = removal.charts;
  state.excludedChartIds = removal.excludedChartIds;
  state.optimizer = null;
  state.lastImport = null;
  state.status = `Voyage underway — removed ${removal.removedCount} selected Charts (${state.charts.length} remaining)`;
  saveState();
  broadcast();
  return publicState();
}

async function checkForUpdates() {
  state.status = "Checking GitHub Releases for updates...";
  broadcast();
  try {
    const response = await net.fetch(UPDATE_RELEASE_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `PoE-Allflame-Voyage-Helper/${app.getVersion()}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (response.status === 404) {
      state.update = { checked: true, currentVersion: app.getVersion(), available: false, noRelease: true };
      state.status = "No published GitHub release is available yet";
      broadcast();
      return state.update;
    }
    if (!response.ok) throw new Error(`GitHub update check failed (HTTP ${response.status})`);
    state.update = updateCore.releaseUpdateInfo(await response.json(), app.getVersion());
    state.status = state.update.available
      ? `Update v${state.update.latestVersion} is available — click Install Update`
      : `You are up to date (v${app.getVersion()})`;
    broadcast();
    return state.update;
  } catch (error) {
    state.update = { checked: true, currentVersion: app.getVersion(), available: false, error: error.message };
    state.status = `Could not check for updates: ${error.message}`;
    broadcast();
    return state.update;
  }
}

function trustedReleaseAssetUrl(url) {
  return /^https:\/\/github\.com\/MBRmurphy\/allflame-voyage-helper\/releases\/download\//i.test(String(url || ""));
}

async function fetchReleaseAsset(url, maxBytes, label) {
  if (!trustedReleaseAssetUrl(url)) throw new Error(`No trusted GitHub ${label} is available.`);
  const response = await net.fetch(url, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": `PoE-Allflame-Voyage-Helper/${app.getVersion()}`,
    },
  });
  if (!response.ok) throw new Error(`${label} download failed (HTTP ${response.status})`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error(`${label} is larger than the allowed download size.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > maxBytes) throw new Error(`${label} has an invalid download size.`);
  return buffer;
}

function portableExecutableTarget() {
  const target = process.env.PORTABLE_EXECUTABLE_FILE;
  if (!app.isPackaged || process.platform !== "win32" || !target) {
    throw new Error("Automatic installation is available only in the packaged Windows portable app.");
  }
  const resolved = path.resolve(target);
  if (path.extname(resolved).toLowerCase() !== ".exe" || !fs.existsSync(resolved)) {
    throw new Error("The running portable executable could not be located safely.");
  }
  return resolved;
}

function assertTargetDirectoryWritable(target) {
  const probe = path.join(path.dirname(target), `.voyage-update-write-test-${process.pid}`);
  try {
    fs.writeFileSync(probe, "write test", { flag: "wx" });
    fs.unlinkSync(probe);
  } catch (error) {
    try { fs.unlinkSync(probe); } catch {}
    throw new Error(`The app cannot update this location. Move it to a writable folder and try again. (${error.message})`);
  }
}

async function downloadAndInstallUpdate() {
  let stagingDirectory = null;
  try {
    if (state.update?.installing) throw new Error("An update installation is already in progress.");
    if (!state.update?.available) throw new Error("Check for an available update first.");
    if (state.update.assetName !== "PoE-Allflame-Voyage-Helper.exe" || !state.update.downloadUrl || !state.update.checksumUrl) {
      throw new Error("This release does not include a portable EXE and SHA256SUMS.txt.");
    }
    const target = portableExecutableTarget();
    assertTargetDirectoryWritable(target);
    state.update.installing = true;
    state.status = `Downloading and verifying v${state.update.latestVersion}...`;
    broadcast();

    const checksumBuffer = await fetchReleaseAsset(state.update.checksumUrl, 1024 * 1024, "checksum file");
    const expectedSha256 = updateCore.checksumForAsset(checksumBuffer.toString("utf8"), state.update.assetName);
    if (!expectedSha256) throw new Error(`SHA256SUMS.txt does not contain ${state.update.assetName}.`);
    const executableBuffer = await fetchReleaseAsset(state.update.downloadUrl, MAX_UPDATE_BYTES, "portable executable");
    const actualSha256 = crypto.createHash("sha256").update(executableBuffer).digest("hex");
    if (actualSha256 !== expectedSha256) throw new Error("The downloaded update failed SHA-256 verification.");

    stagingDirectory = fs.mkdtempSync(path.join(app.getPath("temp"), "voyage-helper-update-"));
    const stagedExecutable = path.join(stagingDirectory, "verified-update.exe");
    const stagedHelper = path.join(stagingDirectory, "install-update.ps1");
    fs.writeFileSync(stagedExecutable, executableBuffer, { flag: "wx" });
    fs.writeFileSync(stagedHelper, fs.readFileSync(UPDATE_HELPER_PATH, "utf8"), { flag: "wx" });

    const helper = spawn("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", stagedHelper,
      "-ProcessId", String(process.pid),
      "-Source", stagedExecutable,
      "-Target", target,
      "-ExpectedSha256", expectedSha256,
    ], { detached: true, windowsHide: true, stdio: "ignore" });
    await new Promise((resolve, reject) => {
      helper.once("spawn", resolve);
      helper.once("error", reject);
    });
    helper.unref();

    state.status = `Verified v${state.update.latestVersion}. Closing to install and restart...`;
    broadcast();
    setTimeout(() => app.quit(), 250);
    return { started: true };
  } catch (error) {
    if (stagingDirectory) {
      try { fs.rmSync(stagingDirectory, { recursive: true, force: true }); } catch {}
    }
    if (state.update) state.update.installing = false;
    state.status = `Update installation failed: ${error.message}`;
    broadcast();
    throw error;
  }
}

function importAreaModifier(tileIndex, text) {
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex > 8) throw new Error("Tile must be 1-9.");
  const modifiers = core.parseAreaModifierText(text, tileIndex);
  state.areaModifiers[tileIndex] = modifiers;
  state.optimizer = null;
  state.status = modifiers.length
    ? `Imported ${modifiers.length} starting Area Modifier(s) for tile ${tileIndex + 1}`
    : `Cleared starting Area Modifiers for tile ${tileIndex + 1}`;
  saveState();
  broadcast();
  showOverlayMessage(state.status, modifiers.length ? "good" : "info");
  return publicState();
}

function setBoardBorderModifier(tileIndex, side, modifierId) {
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex > 8) throw new Error("Tile must be 1-9.");
  if (tileIndex === 4) throw new Error("Middle tile has no board border modifier.");
  if (modifierId === undefined) { modifierId = side; side = core.exposedBorderSides(tileIndex)[0]; }
  if (!core.exposedBorderSides(tileIndex).includes(side)) throw new Error("That tile side is not on the Voyage board border.");
  const modifier = modifierId ? core.getBorderModifier(modifierId) : null;
  if (modifierId && !modifier) throw new Error("Unknown board border modifier.");
  state.boardBorderModifiers = core.setBoardBorderModifierValue(state.boardBorderModifiers, tileIndex, side, modifier ? modifier.id : null);
  state.optimizer = null;
  state.status = modifier ? `Selected ${side} border mod for tile ${tileIndex + 1}: ${modifier.name}` : `Cleared ${side} border mod for tile ${tileIndex + 1}`;
  saveState();
  broadcast();
  return publicState();
}

function clearAll() {
  setSequenceImport(false);
  state.charts = [];
  state.excludedChartIds = [];
  state.areaModifiers = Array.from({ length: 9 }, () => []);
  state.boardBorderModifiers = core.emptyBoardBorderModifierState();
  state.optimizer = null;
  state.lastImport = null;
  state.status = "Cleared Charts, board border mods, and starting Area Modifiers";
  saveState();
  broadcast();
  showOverlayMessage("Voyage helper cleared", "info");
  return publicState();
}

function setSequenceImport(active) {
  if (active === state.sequenceImportActive) return publicState();
  state.sequenceImportActive = active;
  if (sequenceImportTimer) clearInterval(sequenceImportTimer);
  sequenceImportTimer = null;
  if (active) {
    lastSequenceClipboard = clipboard.readText();
    state.status = "Sequential Chart import ON — hover Chart, press Ctrl+C for each. Press Ctrl+Shift+V to stop.";
    showOverlayMessage("Sequential Chart import ON\nHover each Chart and press Ctrl+C", "good");
    sequenceImportTimer = setInterval(() => {
      const text = clipboard.readText();
      if (!text || text === lastSequenceClipboard) return;
      lastSequenceClipboard = text;
      try { importText(text, "sequential clipboard"); }
      catch (error) { state.status = `Sequential import skipped clipboard: ${error.message}`; broadcast(); }
    }, 350);
  } else {
    state.status = "Sequential Chart import OFF";
    showOverlayMessage("Sequential Chart import OFF", "info");
  }
  broadcast();
  return publicState();
}

function toggleSequenceImport() {
  return setSequenceImport(!state.sequenceImportActive);
}

function registerShortcuts() {
  globalShortcut.register("Control+Shift+C", () => {
    importClipboardSafely("clipboard hotkey");
  });
  globalShortcut.register("Control+Shift+V", () => toggleSequenceImport());
  globalShortcut.register("Control+Shift+O", () => {
    overlayVisible = false;
    if (overlayWindow) overlayWindow.hide();
    state.status = "Overlay is disabled";
    broadcast();
  });
  globalShortcut.register("Control+Shift+X", () => showOverlayMessage("", "clear"));
}

ipcMain.handle("get-state", () => publicState());
ipcMain.handle("import-text", (_, text) => importText(text, "text box"));
ipcMain.handle("import-clipboard", () => importText(clipboard.readText(), "clipboard button"));
ipcMain.handle("toggle-sequence-import", () => toggleSequenceImport());
ipcMain.handle("remove-chart", (_, id) => { state.charts = state.charts.filter((chart) => chart.id !== id); state.excludedChartIds = state.excludedChartIds.filter((chartId) => chartId !== id); state.optimizer = null; state.status = "Removed Chart from inventory"; saveState(); broadcast(); return publicState(); });
ipcMain.handle("toggle-chart-excluded", (_, id) => { const excluded = new Set(state.excludedChartIds); excluded.has(id) ? excluded.delete(id) : excluded.add(id); state.excludedChartIds = Array.from(excluded); state.optimizer = null; saveState(); broadcast(); return publicState(); });
ipcMain.handle("clear-charts", () => { state.charts = []; state.excludedChartIds = []; state.optimizer = null; saveState(); broadcast(); return publicState(); });
ipcMain.handle("clear-all", () => clearAll());
ipcMain.handle("import-area-modifier", (_, tileIndex, text) => importAreaModifier(tileIndex, text));
ipcMain.handle("clear-area-modifiers", () => { state.areaModifiers = Array.from({ length: 9 }, () => []); state.optimizer = null; saveState(); broadcast(); return publicState(); });
ipcMain.handle("set-board-border-modifier", (_, tileIndex, side, modifierId) => setBoardBorderModifier(tileIndex, side, modifierId));
ipcMain.handle("set-selected-area-tile", (_, tileIndex) => { if (Number.isInteger(tileIndex) && tileIndex >= 0 && tileIndex <= 8) state.selectedAreaTile = tileIndex; saveState(); broadcast(); return publicState(); });
ipcMain.handle("set-profile", (_, profile) => { if (core.PROFILES[profile]) state.profile = profile; saveState(); state.optimizer = null; broadcast(); return publicState(); });
ipcMain.handle("optimize", () => optimize());
ipcMain.handle("voyage-underway", () => voyageUnderway());
ipcMain.handle("toggle-overlay", () => false);
ipcMain.handle("check-for-updates", () => checkForUpdates());
ipcMain.handle("download-and-install-update", () => downloadAndInstallUpdate());

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.whenReady().then(() => {
    loadState();
    createControl();
    registerShortcuts();
    hoverTimer = setInterval(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("cursor", screen.getCursorScreenPoint());
    }, 150);
  });
  app.on("before-quit", () => { isQuitting = true; });
  app.on("will-quit", () => {
    isQuitting = true;
    globalShortcut.unregisterAll();
    if (hoverTimer) clearInterval(hoverTimer);
    if (sequenceImportTimer) clearInterval(sequenceImportTimer);
    hoverTimer = null;
    sequenceImportTimer = null;
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
    if (controlWindow && !controlWindow.isDestroyed()) controlWindow.destroy();
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
