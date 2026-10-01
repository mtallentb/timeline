# Timeline — MVP product note

**One-liner:** Wordle-for-years — five daily clues, guess the year, share a spoiler-safe emoji card.

## Why it works

- Same puzzle for everyone (shared Chicago date seed) → social proof and FOMO.
- Instant comprehension: slider + headline, no tutorial.
- Share card has no answers → safe to post in Slack / X / group chats.
- Streak + /1000 score → retention loop without accounts.

## Ship today

Static files under `/workspace/timeline/`. Host on any CDN or object store (Cloudflare Pages, Netlify, GitHub Pages, S3+CloudFront, Railway static). Zero build step.

## Domain options (pick later)

| Domain | Notes |
|--------|--------|
| `playtimeline.com` | Clear CTA, likely available-ish |
| `timeline.game` | Premium TLD, brand-forward (placeholder in share text) |
| `gettimeline.app` | App-y; good if PWA comes next |
| `dailytimeline.com` | SEO-friendly “daily” keyword |

Subpath on an existing Matt property (`matt.example/timeline`) is fine for a soft launch.

## Monetization (later)

1. **Launch clean** — no ads week 1–2; watch share rate and D1/D7 return.
2. **Light display ads** — footer banner only on the end screen (after share intent). Avoid mid-round ads.
3. **Optional tip jar / “Buy me a coffee”** — fits indie daily-game culture.
4. **Sponsored event packs** — branded “Science Friday” or product-history days without polluting the core daily seed.

## Hosting days later

- Add a tiny service worker for true offline.
- Move event pool to a CMS or Notion → JSON build, or keep editing `events.json`.
- Optional: archive past days at `/archive/YYYY-MM-DD` (same hash, public).
- Analytics: Plausible or Cloudflare Web Analytics (privacy-friendly).
- If traffic spikes: edge-cache `events.json` + HTML; still no server logic required.

## Success metrics (first 30 days)

- Shares copied / completes
- Streak distribution (1 / 3 / 7+)
- Median score (calibration of event hardness)
- Mobile vs desktop play ratio

## Non-goals for MVP

Accounts, multiplayer live, user-submitted events, push notifications, paid streaks.
