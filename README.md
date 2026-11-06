# Lanterns & Lies: prototype

A phone-first social deduction game set in Emberhollow, a river port where one lantern burns for each player. This repo is the working prototype.

- `shared/` holds the rules engine and its tests (`npm test`).
- `supabase/functions/game/` is the game server. It owns the rules and the clock.
- `src/` is the Svelte web app.

Build with `npm run build`. The `gh-pages` branch holds the published site.
