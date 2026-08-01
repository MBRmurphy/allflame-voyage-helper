const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "web-dist");

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const [source, destination] of [
  ["src/web.html", "index.html"],
  ["src/control.css", "control.css"],
  ["src/manifest.webmanifest", "manifest.webmanifest"],
  ["build/scuba-diver-helmet.png", "scuba-diver-helmet.png"],
]) {
  fs.copyFileSync(path.join(root, source), path.join(output, destination));
}

esbuild.buildSync({
  entryPoints: [path.join(root, "src/web-entry.js")],
  outfile: path.join(output, "web-app.js"),
  bundle: true,
  minify: true,
  sourcemap: false,
  legalComments: "none",
  platform: "browser",
  format: "iife",
  target: ["chrome100", "firefox100", "safari15"],
  logLevel: "info",
});

fs.writeFileSync(path.join(output, ".nojekyll"), "");
fs.writeFileSync(path.join(output, "_headers"), `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
`);

const totalBytes = fs.readdirSync(output, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .reduce((total, entry) => total + fs.statSync(path.join(output, entry.name)).size, 0);
console.log(`Static web app built at ${output} (${totalBytes} bytes)`);
