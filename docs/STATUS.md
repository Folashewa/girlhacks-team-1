# Status

## Task 1 — group chat test (Sat Oct 3, 2:40pm)

- Cloud (Photon Pro, shared-pool number): **1:1 DMs work; group chat messages never arrive.** Tested with a fresh blue iMessage group; the bot logged nothing for it.
- Next: ask the Photon table for a dedicated line; else `npm run local` on a teammate's Mac (not built yet).

## Built so far (scaffold)

- [x] iMessage + terminal transports, debounce, action execution
- [x] JSON store with per-chat state
- [x] Commands: help, list, quiet, resume, call me, forget everything
- [ ] `done` command
- [ ] Brain + prompts (model analysis) — Task 3
- [ ] Credit / resurface / rate limits / active hours in keeper.ts
- [ ] Private back-out flow, nudges, first-DM intro
- [ ] Local iMessage transport (`connect-local.ts`)
- [ ] Local tree API (`api.ts`), sync to DeepSpace (`sync.ts`) — Task 4
- [ ] Simulator (`scripts/simulate.ts`) and scenarios — Task 3
- [ ] Tree site (DeepSpace, `grove-site/`) — Task 5
