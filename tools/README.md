# tools — headless playtesting (not loaded by the game)

- `srv.cjs <root> <extra> <port>`: static server for `<root>`. `/__file` is served from `<extra>`.
- `cdp.mjs <url> <script.js> [script2.js]`: opens the game in headless Chrome, waits for it to boot, runs the script inside the page and prints the result and every page error. If you pass a second script, the page reloads (keeping the save) and that script runs next.
- `playthrough.js`: seeds `Math.random`, auto-plays every level in `LEVELS` (teleports through rooms, kills everything, enters the portal), then runs RUBBLE PIT, practice, training and the codex. It reports per-level signatures, so two builds can be diffed.

```
node tools/srv.cjs . . 8091
node tools/cdp.mjs http://127.0.0.1:8091/ tools/playthrough.js
```

The game's globals (`G`, `P`, `frame`, `startLevel`, ...) are reachable directly from the page, because the `js/*.js` parts are plain scripts.
- `coop.mjs <url>`: launches two headless Chromes, joins them into one MASON'S LODGE over real PeerJS and plays co-op: room sync, enemy ids, partner damage, down/revive, wipe, pause hold, results, NEXT, a boss, quitting, the race from the same lodge and a disconnect. Prints PASS/FAIL per step plus page errors. Needs internet (PeerJS cloud). Game time runs slower than real time with two software renderers, so waits are condition-based.

```
node tools/coop.mjs http://127.0.0.1:8091/
```
