const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("voyage", {
  getState: () => ipcRenderer.invoke("get-state"),
  importText: (text) => ipcRenderer.invoke("import-text", text),
  importClipboard: () => ipcRenderer.invoke("import-clipboard"),
  toggleSequenceImport: () => ipcRenderer.invoke("toggle-sequence-import"),
  removeChart: (id) => ipcRenderer.invoke("remove-chart", id),
  toggleChartExcluded: (id) => ipcRenderer.invoke("toggle-chart-excluded", id),
  clearCharts: () => ipcRenderer.invoke("clear-charts"),
  clearAll: () => ipcRenderer.invoke("clear-all"),
  setBoardBorderModifier: (tileIndex, side, modifierId) => ipcRenderer.invoke("set-board-border-modifier", tileIndex, side, modifierId),
  setProfile: (profile) => ipcRenderer.invoke("set-profile", profile),
  optimize: () => ipcRenderer.invoke("optimize"),
  toggleOverlay: () => ipcRenderer.invoke("toggle-overlay"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  openUpdateDownload: () => ipcRenderer.invoke("open-update-download"),
  onState: (callback) => ipcRenderer.on("state", (_event, value) => callback(value)),
  onOverlayMessage: (callback) => ipcRenderer.on("overlay-message", (_event, value) => callback(value)),
  onCursor: (callback) => ipcRenderer.on("cursor", (_event, value) => callback(value)),
});
