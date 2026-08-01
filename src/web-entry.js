const { createWebVoyageApi } = require("./web-state.js");

let browserStorage = null;
try { browserStorage = window.localStorage; }
catch { browserStorage = null; }

window.voyage = createWebVoyageApi({
  storage: browserStorage,
  clipboard: navigator.clipboard,
});

document.documentElement.dataset.runtime = "web";

require("./control.js");
