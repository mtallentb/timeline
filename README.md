# Timeline

A daily shareable year-guessing game. Same 5 events for everyone on a given calendar day (America/Chicago).

## Play locally

```bash
# from the repository root
python -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765) in a browser.

Or open `index.html` via any static file server. Prefer HTTP over `file://` so `events.json` loads via `fetch`.

**Offline:** After the first load (with network), the page and JSON are cached by the browser for that origin; for true offline shipping later, add a service worker. The game logic itself needs no network once assets are loaded.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Shell page |
| `app.js` | Puzzle seed, scoring, UI, share, streak |
| `styles.css` | Dark mobile-friendly UI |
| `events.json` | Curated events (clue + truth year) |
| `MVP.md` | Product note |
| `README.md` | This file |

## How it works

1. **Daily seed** — Date key is today's date in `America/Chicago` (`YYYY-MM-DD`). A deterministic hash of `timeline:{dateKey}` shuffles the event pool and picks 5 events (preferring unique years).
2. **Each round** — You see a short clue with **no year**. Drag the slider (1900–2026) and lock in a guess.
3. **Reveal** — True year, Δ years, points, and emoji tier. Then next round.
4. **End** — Total out of 1000, streak in `localStorage`, spoiler-safe share card.

## Scoring

Per round (max **200** points):

```
points = max(0, round(200 * (1 - abs(guess - truth) / 126)))
```

where `126 = 2026 − 1900` (slider range). Perfect guess on all 5 rounds = **1000**.

### Emoji tiers (share card)

| Tier | Condition |
|------|-----------|
| 🟢 | \|Δ\| ≤ 2 years |
| 🟡 | \|Δ\| ≤ 10 years |
| 🔴 | otherwise |

### Share format (no answers / years)

```
Timeline MM/DD  🟢🟢🟡🔴🟢  740/1000
🔥 Streak: 3
https://timeline.game
```

One-tap **Copy share card** copies that text to the clipboard.

## Streak

Stored in `localStorage` under key `timeline_v1`. Increments when you finish consecutive Chicago calendar days; resets if you skip a day.

## Extending the event pool

Add objects to `events.json`:

```json
{ "id": 61, "clue": "Short headline without a year", "year": 1999 }
```

Keep clues free of years so the puzzle stays fair.
