let currentState = null;
let activeBorderPick = null;
let inventoryPage = 0;
let lastInventoryImportId = null;

const $ = (id) => document.getElementById(id);

function fmtScore(value) { return Math.round(value || 0).toLocaleString(); }

function formatBuffValue(value, unit = "") {
  const numeric = Number(value || 0);
  const rounded = Number.isInteger(numeric) ? numeric : Math.round(numeric * 10) / 10;
  return `${rounded}${unit || ""}`;
}

function summarizeTileModifiers(modifiers = []) {
  const grouped = new Map();
  modifiers.forEach((modifier) => {
    const key = `${modifier.label}|${modifier.unit || ""}`;
    const entry = grouped.get(key) || { label: modifier.label, unit: modifier.unit || "", value: 0, score: 0, sources: new Set() };
    entry.value += Number(modifier.value || 0);
    entry.score += Number(modifier.score || 0);
    if (modifier.source) entry.sources.add(modifier.source);
    grouped.set(key, entry);
  });
  return [...grouped.values()]
    .map((entry) => ({ ...entry, sources: [...entry.sources] }))
    .sort((left, right) => Math.abs(right.score) - Math.abs(left.score));
}

function renderState(state) {
  currentState = state;
  $("status").textContent = state.status || "Ready";
  $("chartCount").textContent = `${state.charts.length}/${state.inventoryMaxSlots || 120}`;
  const importedSlot = state.lastImport?.inventorySlot;
  if (state.lastImport?.id && state.lastImport.id !== lastInventoryImportId && Number.isInteger(importedSlot)) {
    inventoryPage = Math.floor((importedSlot - 1) / (state.inventoryPageSize || 60));
    lastInventoryImportId = state.lastImport.id;
  } else if (!state.lastImport) {
    lastInventoryImportId = null;
  }
  if (!state.charts.length) inventoryPage = 0;
  inventoryPage = Math.min(Math.max(0, inventoryPage), (state.inventoryPageCount || 2) - 1);
  const sequenceButton = $("toggleSequenceImport");
  if (sequenceButton) {
    sequenceButton.textContent = state.sequenceImportActive ? "Stop Seq Import" : "Start Seq Import";
    sequenceButton.classList.toggle("active", Boolean(state.sequenceImportActive));
  }
  const underwayButton = $("voyageUnderway");
  if (underwayButton) {
    const selectedCount = state.voyageUnderwayCount || 0;
    underwayButton.disabled = selectedCount === 0;
    underwayButton.textContent = selectedCount ? `Voyage Underway (${selectedCount})` : "Voyage Underway";
    underwayButton.title = selectedCount
      ? `Remove the ${selectedCount} Charts highlighted by the best optimized board`
      : "Optimize a runnable Voyage to select Charts";
  }
  const updateButton = $("checkUpdate");
  if (updateButton) {
    const update = state.update;
    updateButton.textContent = update?.installing
      ? "Installing Update..."
      : update?.available
      ? `Install v${update.latestVersion}`
      : update?.error
        ? "Retry Update Check"
        : update?.noRelease
          ? "No Release Yet"
        : update?.checked
          ? "Up to Date"
          : "Check Updates";
    updateButton.classList.toggle("update-ready", Boolean(update?.available));
    updateButton.disabled = Boolean(update?.installing);
    updateButton.title = update?.available
      ? `Download, verify, install, and restart with ${update.assetName || "the latest portable build"}`
      : "Manually check GitHub Releases for a newer portable build";
  }
  renderProfiles(state);
  renderStrategyGuide(state.strategyGuide);
  renderBoard(state.boardBorderModifiers || [], state.borderModifierOptions || []);
  renderInventoryPager(state);
  renderCharts(state.charts);
  renderOptimizer(state.optimizer);
  renderBuffSummary(state.optimizer);
  if (activeBorderPick) renderModPickerOptions();
}

function renderProfiles(state) {
  const select = $("profile");
  const existing = select.value;
  select.innerHTML = Object.entries(state.profiles).map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("");
  select.value = state.profile || existing || "general";
}

function renderStrategyGuide(guide) {
  const container = $("strategyGuide");
  if (!container) return;
  if (!guide) {
    container.innerHTML = "";
    return;
  }
  const list = (items, className = "") => items?.length
    ? `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  container.innerHTML = `
    <section class="strategy-card strategy-${escapeHtml(guide.id)} ${guide.ready ? "is-ready" : "needs-work"}">
      <div class="strategy-heading">
        <div><span class="strategy-kicker">Active optimizer strategy</span><h3>${escapeHtml(guide.title)}</h3></div>
        <strong>${guide.ready ? "READY" : "BUILDING"}</strong>
      </div>
      <p class="strategy-status">${escapeHtml(guide.status)}</p>
      ${list(guide.prep, "strategy-prep")}
      <ol>${(guide.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      ${list(guide.alternatives, "strategy-alternatives")}
      ${list(guide.rollNotes, "strategy-roll-notes")}
    </section>
  `;
}

function renderBoard(boardBorderModifiers, options) {
  const planner = $("voyageBoardPlanner");
  if (!planner) return;
  const best = currentState?.optimizer?.results?.[0];
  planner.innerHTML = voyageBoardHtml({
    board: best?.board || [],
    fixedTileModifiers: best?.evaluation?.fixedTileModifiers || [],
    appliedModifiers: best?.evaluation?.appliedModifiers || [],
    areaScores: best?.evaluation?.areaScores || [],
    boardBorderModifiers,
    options,
    strategyLabels: currentState?.strategyGuide?.boardLabels || [],
    interactive: true,
    title: best ? "Current best optimized board" : "Plan board border mods",
  });
}

function renderInventoryPager(state = currentState) {
  if (!state) return;
  const pageSize = state.inventoryPageSize || 60;
  const startSlot = inventoryPage * pageSize + 1;
  const endSlot = startSlot + pageSize - 1;
  const chartsOnPage = state.charts.filter((chart) => chart.inventorySlot >= startSlot && chart.inventorySlot <= endSlot).length;
  const range = $("inventoryPageRange");
  if (range) range.textContent = `Page ${inventoryPage + 1} · slots ${startSlot}-${endSlot} · ${chartsOnPage}/${pageSize} Charts`;
  document.querySelectorAll("[data-inventory-page]").forEach((button) => {
    const page = Number(button.dataset.inventoryPage);
    button.classList.toggle("active", page === inventoryPage);
    button.setAttribute("aria-current", page === inventoryPage ? "page" : "false");
  });
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

function directionList(chart) {
  if (!chart) return [];
  if (Array.isArray(chart.connections)) return chart.connections;
  return String(chart.connectionText || "").split(",").map((direction) => direction.trim()).filter(Boolean);
}

const OPPOSITE = { north: "south", east: "west", south: "north", west: "east" };
const OFFSETS = { north: -3, east: 1, south: 3, west: -1 };

function adjacentIndex(index, direction) {
  const row = Math.floor(index / 3);
  const column = index % 3;
  if (direction === "north" && row === 0) return null;
  if (direction === "south" && row === 2) return null;
  if (direction === "west" && column === 0) return null;
  if (direction === "east" && column === 2) return null;
  return index + OFFSETS[direction];
}

function reciprocalDirections(board, index) {
  const chart = board[index];
  if (!chart) return [];
  return directionList(chart).filter((direction) => {
    const target = adjacentIndex(index, direction);
    return target !== null && board[target] && directionList(board[target]).includes(OPPOSITE[direction]);
  });
}

function connectionSvg(chart, directions = null) {
  const activeDirections = directions || directionList(chart);
  const lines = activeDirections.map((direction) => {
    const end = { north: [50, 6], east: [94, 50], south: [50, 94], west: [6, 50] }[direction];
    return end ? `<line class="route-live" x1="50" y1="50" x2="${end[0]}" y2="${end[1]}" />` : "";
  }).join("");
  return `<svg class="chart-shape-svg" viewBox="0 0 100 100" aria-hidden="true">${lines}<circle cx="50" cy="50" r="4" /></svg>`;
}

function shortModifierName(modifier) {
  if (!modifier) return "Click border";
  return modifier.name
    .replace(/^\d+% /, "")
    .replace("Increased number of ", "")
    .replace("Basic Currency converted to ", "Currency → ")
    .replace("Increased ", "")
    .slice(0, 32);
}

function sideLabel(side) {
  return ({ north: "Top", east: "Right", south: "Bottom", west: "Left" }[side] || side);
}

function voyageBoardHtml({ board = [], fixedTileModifiers = [], appliedModifiers = [], areaScores = [], boardBorderModifiers = [], strategyLabels = [], interactive = false, title = "Voyage board" }) {
  const cells = Array.from({ length: 9 }, (_, index) => {
    const chart = board[index];
    const fixedMods = fixedTileModifiers[index] || [];
    const appliedMods = appliedModifiers[index] || [];
    const tileBuffs = summarizeTileModifiers(appliedMods);
    const tileBorderMods = boardBorderModifiers[index] || {};
    const strategyLabel = strategyLabels[index];

    const borderControls = index === 4
      ? `<div class="board-center-note">no border<br>modifier</div>`
      : exposedBorderSides(index).map((side) => {
        const borderMod = tileBorderMods[side];
        const body = `<span class="slot-side">${sideLabel(side)}</span><span class="slot-name">${escapeHtml(shortModifierName(borderMod))}</span>`;
        return interactive
          ? `<button class="voyage-border-slot side-${side}" data-pick-border-tile="${index}" data-pick-border-side="${side}" title="${escapeHtml(borderMod?.summary || `Choose ${side} border mod`)}">${body}</button>`
          : `<div class="voyage-border-slot side-${side}" title="${escapeHtml(borderMod?.summary || "")}">${body}</div>`;
      }).join("");
    return `
      <div class="voyage-cell cell-${index}">
        ${borderControls}
        <div class="chart-visual ${chart ? "has-chart" : ""}">
          ${strategyLabel ? `<span class="strategy-tile-label kind-${escapeHtml(strategyLabel.kind)}" title="${escapeHtml(strategyLabel.description)}">${escapeHtml(strategyLabel.label)}</span>` : ""}
          ${chart?.inventorySlot ? `<span class="chart-slot-badge">#${chart.inventorySlot}</span>` : ""}
          ${chart?.tierOneUniqueArea ? `<span class="t1-area-badge" title="T1 unique area: ${escapeHtml(chart.tierOneUniqueArea)}">T1</span>` : ""}
          ${chart ? connectionSvg(chart) : `<span class="dot"></span>`}
          <b>${index + 1}</b>
        </div>
        <div class="chart-meta">
          ${chart ? `<strong>${escapeHtml(chart.implicitName || chart.displayName || "Chart")}</strong><span>${escapeHtml(chart.patternName || "")} ${chart.rotation ? `↻ ${chart.rotation}°` : "↻ 0°"}</span>` : `<strong>Tile ${index + 1}</strong><span>${index === 4 ? "center support" : "empty"}</span>`}
          ${fixedMods.length ? `<small>${fixedMods.map((modifier) => escapeHtml(modifier.name)).join(" · ")}</small>` : ""}
          ${appliedMods.length ? `<small class="applied-mods">Applied: ${appliedMods.slice(0, 3).map((modifier) => `${escapeHtml(modifier.source)} ${escapeHtml(modifier.label)}`).join(" · ")}${appliedMods.length > 3 ? "…" : ""}</small>` : ""}
        </div>
        ${chart ? `<div class="tile-buff-popover" role="tooltip">
          <strong>Tile ${index + 1} buff totals</strong>
          <span class="tile-score">Tile score: ${fmtScore(areaScores[index] || 0)}</span>
          ${tileBuffs.length ? `<ul>${tileBuffs.slice(0, 14).map((buff) => `<li><b>${escapeHtml(buff.label)}</b><span>${escapeHtml(formatBuffValue(buff.value, buff.unit))}</span><small>${escapeHtml(buff.sources.join(" + "))}</small></li>`).join("")}</ul>` : `<em>No applied buffs on this tile.</em>`}
        </div>` : ""}
      </div>
    `;
  }).join("");
  return `<div class="voyage-board-title">${escapeHtml(title)}</div><div class="voyage-board-frame"><div class="voyage-grid">${cells}</div></div>`;
}

function renderCharts(charts) {
  const list = $("chartList");
  const bestBoard = currentState?.optimizer?.results?.[0]?.board || [];
  const bestPositions = new Map(bestBoard.flatMap((chart, tileIndex) => chart ? [[chart.id, tileIndex + 1]] : []));
  const chartBySlot = new Map(charts.map((chart) => [chart.inventorySlot, chart]));
  const pageSize = currentState?.inventoryPageSize || 60;
  const firstSlot = inventoryPage * pageSize + 1;
  list.innerHTML = Array.from({ length: pageSize }, (_, index) => {
    const slot = firstSlot + index;
    const chart = chartBySlot.get(slot);
    if (!chart) return `<div class="inventory-slot is-empty"><span>${slot}</span></div>`;
    const bestTile = bestPositions.get(chart.id);
    return `
      <article class="inventory-slot chart ${chart.excluded ? "is-excluded" : ""} ${bestTile ? "is-placed" : ""}" data-chart-id="${chart.id}" title="Slot ${slot}: right-click to ${chart.excluded ? "return this Chart to" : "remove this Chart from"} the optimizer pool">
        <div class="slot-number">#${slot}</div>
        <div class="mini-chart-shape">${connectionSvg(chart)}</div>
        <div class="slot-level">${chart.itemLevel ? `L:${chart.itemLevel}` : "Chart"}</div>
        <div class="inventory-slot-name">${escapeHtml(shortModifierName({ name: chart.implicitName || chart.displayName || "Chart" }))}</div>
        ${bestTile ? `<div class="placed-badge">Board ${bestTile}</div>` : ""}
        ${chart.tierOneUniqueArea ? `<div class="unique-area-badge" title="T1 unique orange area: ${escapeHtml(chart.tierOneUniqueArea)}">T1</div>` : ""}
        ${chart.excluded ? `<div class="excluded-badge">Excluded</div>` : ""}
      </article>
    `;
  }).join("");
}

function renderBuffSummary(result) {
  const container = $("buffSummary");
  if (!container) return;
  const best = result?.results?.[0];
  if (!best) {
    container.innerHTML = `<p class="muted">Optimize a board to see combined buffs.</p>`;
    return;
  }
  const evaluation = best.evaluation;
  container.innerHTML = `
    <div class="center-bridge-summary">
      <b>Tile 5 connections</b>
      <span>${evaluation.centerConnections || evaluation.validity?.degrees?.[4] || 0}/4</span>
    </div>
    <div class="center-bridge-summary top-tier-summary">
      <b>Golden / currency priority</b>
      <span>${fmtScore(evaluation.topTierRewardScore)}</span>
    </div>
    ${evaluation.tierOneUniqueAreas?.length ? `<div class="t1-summary"><b>T1 unique areas selected</b>${evaluation.tierOneUniqueAreas.map((area) => `<span>${area.inventorySlot ? `#${area.inventorySlot} · ` : ""}${escapeHtml(area.name)}</span>`).join("")}</div>` : ""}
    <div class="buff-total-list">
      ${(evaluation.totals || []).slice(0, 16).map((total) => {
        const value = total.descriptive ? `${total.descriptive}×` : formatBuffValue(total.value, total.unit);
        return `<div><span>${escapeHtml(total.label)}</span><b>${escapeHtml(value)}</b></div>`;
      }).join("") || `<p class="muted">No aggregate buffs found.</p>`}
    </div>
    <p class="muted buff-hover-hint">Hover any board tile for that tile's applied-buff totals.</p>
  `;
}

function optimizerResultBody(entry) {
  return `
    <p class="muted">${entry.evaluation.validity.isLinearPath ? "✅ Linear full route" : entry.evaluation.validity.isValid ? "✅ Connected" : "⚠️ Invalid graph"} · Connections ${entry.evaluation.validity.reciprocalEdges.length} · Tile 5 ${entry.evaluation.centerConnections || 0}/4 · T1 areas ${entry.evaluation.tierOneUniqueAreaCount || 0} · Golden/currency ${fmtScore(entry.evaluation.topTierRewardScore)}</p>
    ${voyageBoardHtml({ board: entry.board, fixedTileModifiers: entry.evaluation.fixedTileModifiers || [], appliedModifiers: entry.evaluation.appliedModifiers || [], areaScores: entry.evaluation.areaScores || [], boardBorderModifiers: entry.evaluation.boardBorderModifiers || [], strategyLabels: currentState?.strategyGuide?.boardLabels || [], interactive: false, title: `Optimized layout #${entry.rank}` })}
    <div class="totals">
      ${entry.evaluation.totals.slice(0, 10).map((total) => `<div>${escapeHtml(total.label)}: <b>${total.descriptive ? total.descriptive + "x" : Math.round(total.value) + (total.unit || "")}</b></div>`).join("")}
    </div>
    ${entry.evaluation.notes.length ? `<p class="warn">${entry.evaluation.notes.map(escapeHtml).join("<br>")}</p>` : ""}
  `;
}

function renderOptimizer(result) {
  const container = $("optimizerResults");
  if (!result) {
    container.innerHTML = `<p class="muted">Import 9+ active Charts, set board border mods, then optimize.</p>`;
    return;
  }
  if (result.error) {
    container.innerHTML = `<p class="warn">${escapeHtml(result.error)}</p>`;
    return;
  }
  container.innerHTML = result.results.map((entry) => {
    const heading = `#${entry.rank} · Reward ${fmtScore(entry.evaluation.rewardScore)} · Route ${fmtScore(entry.evaluation.routeScore)}`;
    if (entry.rank === 1) return `<section class="result primary-result"><h3>${heading}</h3>${optimizerResultBody(entry)}</section>`;
    return `<details class="result alternative-result"><summary><b>${heading}</b><span>Golden/currency ${fmtScore(entry.evaluation.topTierRewardScore)} · Tile 5 ${entry.evaluation.centerConnections || 0}/4 · T1 ${entry.evaluation.tierOneUniqueAreaCount || 0} · click to expand</span></summary><div class="alternative-result-body">${optimizerResultBody(entry)}</div></details>`;
  }).join("");
}

function openModPicker(tileIndex, side) {
  activeBorderPick = { tileIndex, side };
  $("modPickerTitle").textContent = `Tile ${tileIndex + 1} ${sideLabel(side)} Border Mod`;
  $("modPickerHint").textContent = "Search and click a mod. Choose Clear to leave this edge empty.";
  $("modSearch").value = "";
  $("modPicker").classList.remove("hidden");
  renderModPickerOptions();
  $("modSearch").focus();
}

function closeModPicker() {
  activeBorderPick = null;
  $("modPicker").classList.add("hidden");
}

function renderModPickerOptions() {
  const list = $("modOptions");
  if (!activeBorderPick || !currentState) return;
  const query = $("modSearch").value.toLowerCase().trim();
  const options = currentState.borderModifierOptions || [];
  const filtered = options.filter((option) => {
    const haystack = `${option.name} ${option.summary} ${option.familyName} ${option.tierLabel}`.toLowerCase();
    return !query || query.split(/\s+/).every((term) => haystack.includes(term));
  }).slice(0, 80);
  list.innerHTML = `
    <button class="mod-option clear" data-mod-id=""><b>Clear this border side</b><span>No fixed border modifier</span></button>
    ${filtered.map((option) => `
      <button class="mod-option" data-mod-id="${escapeHtml(option.id)}">
        <b>${escapeHtml(option.name)} ${option.tierLabel ? `<em>${escapeHtml(option.tierLabel)}</em>` : ""}</b>
        <span>${escapeHtml(option.summary || option.familyName || "")}</span>
        <small>score ${fmtScore(option.score)}</small>
      </button>
    `).join("")}
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

async function refresh() { renderState(await window.voyage.getState()); }

window.voyage.onState(renderState);

document.addEventListener("click", async (event) => {
  const removeId = event.target?.dataset?.remove;
  const excludeId = event.target?.dataset?.exclude;
  const pickTile = event.target.closest?.("[data-pick-border-tile]");
  const modOption = event.target.closest?.("[data-mod-id]");
  const inventoryPageButton = event.target.closest?.("[data-inventory-page]");
  try {
    if (inventoryPageButton) {
      inventoryPage = Number(inventoryPageButton.dataset.inventoryPage);
      renderInventoryPager();
      renderCharts(currentState?.charts || []);
      return;
    }
    if (pickTile) {
      openModPicker(Number(pickTile.dataset.pickBorderTile), pickTile.dataset.pickBorderSide);
      return;
    }
    if (modOption && activeBorderPick) {
      await window.voyage.setBoardBorderModifier(activeBorderPick.tileIndex, activeBorderPick.side, modOption.dataset.modId);
      closeModPicker();
      return;
    }
    if (event.target.id === "closeModPicker" || event.target.id === "modPicker") closeModPicker();
    if (event.target.id === "importClipboard") await window.voyage.importClipboard();
    if (event.target.id === "toggleSequenceImport") await window.voyage.toggleSequenceImport();
    if (event.target.id === "importText") await window.voyage.importText($("manualText").value);
    if (event.target.id === "clearCharts") await window.voyage.clearCharts();
    if (event.target.id === "clearAll") await window.voyage.clearAll();
    if (event.target.id === "voyageUnderway") {
      const selectedCount = currentState?.voyageUnderwayCount || 0;
      if (selectedCount && window.confirm(`Set this Voyage underway and remove its ${selectedCount} highlighted Charts from inventory?`)) {
        await window.voyage.voyageUnderway();
      }
    }
    if (event.target.id === "checkUpdate") {
      event.target.disabled = true;
      try {
        if (currentState?.update?.available && currentState.update.downloadUrl) await window.voyage.downloadAndInstallUpdate();
        else await window.voyage.checkForUpdates();
      } finally {
        event.target.disabled = Boolean(currentState?.update?.installing);
      }
    }
    if (event.target.id === "optimize") {
      event.target.disabled = true;
      $("status").textContent = "Optimizing voyage...";
      try {
        const result = await window.voyage.optimize();
        renderOptimizer(result);
        renderBuffSummary(result);
      } finally {
        event.target.disabled = false;
      }
    }
    if (removeId) await window.voyage.removeChart(removeId);
    if (excludeId) await window.voyage.toggleChartExcluded(excludeId);
  } catch (error) {
    $("status").textContent = error.message;
  }
});

document.addEventListener("contextmenu", async (event) => {
  const chart = event.target.closest?.("[data-chart-id]");
  if (!chart) return;
  event.preventDefault();
  try { await window.voyage.toggleChartExcluded(chart.dataset.chartId); }
  catch (error) { $("status").textContent = error.message; }
});

$("modSearch").addEventListener("input", renderModPickerOptions);
$("modSearch").addEventListener("keydown", async (event) => {
  if (event.key === "Escape") closeModPicker();
});

$("profile").addEventListener("change", async (event) => {
  await window.voyage.setProfile(event.target.value);
});

refresh();
