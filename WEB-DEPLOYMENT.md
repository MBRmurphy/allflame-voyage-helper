# Web deployment

The web edition is a static, client-only application. It has no application server, account system, telemetry, analytics, database, API endpoint, or upload path.

## Privacy model

- Imported Chart text, exclusions, border selections, and scoring profile are stored only in the browser's `localStorage` under `poe-allflame-voyage-helper:web:v1`.
- **Clear Local Data** removes that browser-local record.
- If browser storage is blocked, the app falls back to memory-only state that disappears when the tab closes.
- The production Content Security Policy sets `connect-src 'none'`, preventing the app from making fetch/XHR/WebSocket connections.
- The web bundle contains no `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` calls.
- A static hosting provider can still keep normal HTTP access logs such as IP address, requested file, and timestamp. Chart text and individual configuration are never included in those requests.

## Build

```bash
npm ci
npm run check
npm run web:build
```

Deploy the contents of `web-dist/`. The generated directory is self-contained and does not require Node.js on the hosting server.

## Preview locally

```bash
npm run web:build
npm run web:preview
```

Open `http://127.0.0.1:4173`.

## Static hosting

### Cloudflare Pages or Netlify

- Build command: `npm ci && npm run web:build`
- Output/publish directory: `web-dist`
- No environment variables, functions, databases, or server routes are required.

The included `_headers` file adds CSP and privacy/security headers on hosts that support that format.

### GitHub Pages

Build with `npm run web:build` and publish the contents of `web-dist` through a Pages workflow or a `gh-pages` branch. The included `.nojekyll` file prevents Jekyll processing. GitHub Pages ignores `_headers`, but the same CSP is embedded in `index.html`.

## Publishing updates

1. Change the shared optimizer, catalog, or UI source.
2. Run `npm run check && npm run web:build`.
3. Push/deploy the new `web-dist` output.
4. Refresh the browser page after deployment.

The app intentionally has no service worker, so it does not pin users to an old offline cache. A hosting CDN may still briefly cache static files; purge that host cache if an urgent update is not visible.

Browser-local data survives normal static updates because the storage key remains stable. Change or migrate `STORAGE_KEY` in `src/web-state.js` only when intentionally changing the saved-data format.

## Browser clipboard limitation

A normal browser cannot continuously monitor the system clipboard or register an operating-system-wide hotkey. Users copy a Chart in PoE with `Ctrl+C`, then click **Import Copied Chart**, or paste the copied text into the text box. Direct clipboard reading requires HTTPS in production and a user click.
