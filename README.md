# PoE Allflame Voyage Helper

Read-only Windows desktop helper for Path of Exile 1 Curse of the Allflame Voyages.

- **Desktop downloads:** https://github.com/MBRmurphy/allflame-voyage-helper/releases/latest
- **Client-only web app:** https://mbrmurphy.github.io/allflame-voyage-helper/
- **Source and issues:** https://github.com/MBRmurphy/allflame-voyage-helper

## What works now

- Click any outside edge slot directly on the board to change that tile side's fixed border mod.
- Searchable border-mod picker: type keywords like `rarity`, `deck`, `lantern`, `pack`, `currency`, `rare`, or `strongbox` to quickly filter mods.
- Corner tiles expose two border slots, edge tiles expose one, and tile 5 has no border modifier.
- Local Chart inventory with clipboard/manual text import.
- 60-slot visual Chart inventory matching PoE's left-to-right, row-by-row order. Imported Charts are numbered #1-#60 so optimizer placements can point back to the exact copied Chart.
- Sequential Chart import mode: press `Ctrl+Shift+V` or **Start Seq Import**, then hover/copy each Chart with `Ctrl+C`; press it again to stop.
- Right-click or **Exclude** a Chart to remove it from the optimizer pool without deleting it.
- Clear All resets Charts, optimizer exclusions, board border mods, and optimizer state.
- 3x3 Voyage optimizer with reciprocal-connection validity and visualized final Chart position/rotation.
- Best Voyage board labels each placed Chart with its inventory number and highlights inventory slots with the destination board tile.
- Tile 5 is preferentially used as a three- or four-way bridge when the active Chart shapes can produce a valid reciprocal board.
- A side summary lists aggregate buffs for the best board; hover any placed tile to see that tile's combined buff totals and contributing Charts.
- Eleven orange unique areas receive T1 path priority: Diving Shoals, Pelagic Abyss, Sea Pillars, Sunken Totems, Clam Infested Shelf, Kishara's Rest, Lost Ruins, Hazardous Depths, Brine King's Domain, Anchorfield, and Infested Bathyspheres.
- The best optimized path stays expanded while alternative paths are collapsed summaries that can be opened on demand.
- Bounded beam optimizer avoids freezing the app on large Chart inventories.
- Rotation-aware placement: Chart shapes can be rotated while planning.
- Philosophy-informed scoring: rarity, quantity, pack size, stacked-deck/currency conversions, strongboxes, and Golden Lanterns are prioritized; low-value/danger clutter is de-emphasized outside dedicated profiles.
- General Profit treats Additional Divine Orb, Golden Lanterns, More Currency, and currency-to-Stacked-Deck conversion as top-tier rewards, with Divine outcomes receiving the highest base weight.
- Closing the control window quits the app completely, including overlay/timers/global hotkeys.
- Optional **Check Updates** button queries the latest public GitHub Release only when clicked; installing remains user initiated and nothing is checked or downloaded silently.

## Safety

The app is read-only: it does not click, type, move items, read memory, inspect packets, or automate gameplay.

## Run

```bash
npm install
npm start
```

## Build portable exe

```bash
npm run dist
```

## Desktop updates

The desktop app does not contact GitHub in the background. Click **Check Updates** to compare the running version with the latest published GitHub Release. If a newer semantic version exists, the button changes to **Install vX.Y.Z**. Clicking it downloads the immutable portable EXE and `SHA256SUMS.txt` release assets over HTTPS, verifies the SHA-256 checksum, closes the helper, replaces the old portable EXE, and restarts the updated app.

Replacement is performed by a detached local PowerShell helper only after Electron exits. It verifies the checksum again, preserves the previous EXE until the new file is in place, and restores/restarts the old copy if replacement fails. Automatic installation requires the packaged Windows portable app to be in a writable folder; development mode and protected install locations fail closed without changing the executable.

Repository commits are not automatically treated as desktop updates. To publish one:

```bash
npm run check
npm version patch
git push origin main --follow-tags
```

The `v*` tag runs `.github/workflows/release.yml`, builds the Windows portable EXE and static web ZIP on GitHub, generates SHA-256 checksums, and publishes them as an immutable GitHub Release. Use `npm version minor` or `npm version major` when appropriate.

## Build the private client-only web app

```bash
npm ci
npm run check
npm run web:build
```

Deploy the contents of `web-dist/` to any static host. Imported Charts and configuration are kept in browser `localStorage`; the application has no account, telemetry, database, API, or server upload. Its production Content Security Policy also blocks outbound app connections with `connect-src 'none'`. Use **Clear Local Data** to remove the saved browser state. See `WEB-DEPLOYMENT.md` for Cloudflare Pages, Netlify, GitHub Pages, preview, update, and clipboard details.

## Board border modifiers and chart pool

Use the parchment **Voyage Board** to manually select fixed border mods for every outside edge side. Click a border slot directly on the board to open the searchable modifier picker. Corner tiles expose two slots, edge tiles expose one, and tile 5 is the center/middle tile with no border mod. Border modifiers worded for adjacent Areas/Charts apply only across a physically touching reciprocal Chart line; if no such line exists, that modifier is inactive and the result notes explain why. Self/Area border effects remain on their configured tile.

## Sequential Chart import

For a batch of Charts, press `Ctrl+Shift+V` or **Start Seq Import**. The helper watches the clipboard and imports each new copied Chart once. In PoE, hover a Chart, press `Ctrl+C`, move to the next Chart, press `Ctrl+C`, and repeat. Press `Ctrl+Shift+V` or **Stop Seq Import** when done. Duplicate clipboard text is skipped so the same Chart does not get imported repeatedly.

After **Find Best Voyage**, the main board and optimizer result cards render the exact 3x3 Chart placement. Each tile shows the placed Chart reward, piece shape, and rotation angle, with black connection strokes matching the rotated Chart path.

If you do not want a Chart considered for the next optimizer run, right-click its card or press **Exclude**. It stays in inventory and can be returned with right-click or **Use**.

The inventory is capped at 60 copied Charts. Slot #1 is the first copied Chart at the top-left, then slots fill left-to-right and continue on the next row. After optimizing, the inventory highlights Charts used in the best layout with their board tile number.

## Route priority

The optimizer treats travel connectivity as the first goal: all 9 tiles must be reachable and every internal Chart line must be reciprocal. Lines may legally leave the outside edge of the board. Among runnable layouts, it maximizes selected T1 unique areas, then Golden Lantern/Divine/currency priority, tile 5 connectivity, route quality, and remaining reward score. No Chart shape is changed or has lines removed.
