const callout = document.getElementById("callout");
const boardHint = document.getElementById("boardHint");
let cursor = { x: 40, y: 40 };
let clearTimer = null;

function place() {
  const x = Math.min(window.innerWidth - 450, cursor.x + 22);
  const y = Math.min(window.innerHeight - 170, cursor.y + 22);
  callout.style.left = `${Math.max(10, x)}px`;
  callout.style.top = `${Math.max(10, y)}px`;
}

window.voyage.onCursor((point) => {
  cursor = point;
  place();
});

window.voyage.onOverlayMessage((payload) => {
  if (!payload || payload.kind === "clear" || !payload.message) {
    callout.className = "callout hidden";
    return;
  }
  callout.textContent = payload.message;
  callout.className = `callout ${payload.kind || "info"}`;
  place();
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => { callout.className = "callout hidden"; }, 6500);
});

window.voyage.onState((state) => {
  const best = state.optimizer?.results?.[0];
  if (!best) {
    boardHint.className = "board-hint hidden";
    return;
  }
  boardHint.className = "board-hint";
  boardHint.innerHTML = best.board.map((chart, index) => `<div>${index + 1}<br>${chart?.implicitName || ""}<br>${chart?.patternName || ""}</div>`).join("");
});
