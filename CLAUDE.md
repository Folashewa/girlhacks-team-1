# Working rules for Claude Code

- Read `docs/IMPLEMENTATION.md` (the plan) and `docs/STATUS.md` (what's actually built) before starting.
- Work one task at a time, in the plan's order. If something is ambiguous, ask instead of guessing.
- Run `npm test` and `npm run typecheck` after every change; both must pass.
- The model proposes, the code decides: privacy, credit, rate limits and ownership are enforced in `src/keeper.ts`, never only in the prompt. Add a test for every such rule.
- Never send phone numbers or raw person ids to the model or the tree site.
- Chats never mix: nothing from one chat (or a DM) reaches another chat's memory, model call, list or tree.
- Never commit `.env` or `data/state.json`.

# Context so far (Oct 3, 2026)

- Team: 3 people (roles A/B/C in docs/IMPLEMENTATION.md section 3). Folashewa is **C: tree site (DeepSpace)** and owns this repo.
- Photon credentials go in `.env` as `SPECTRUM_PROJECT_ID` / `SPECTRUM_PROJECT_SECRET` (names from Photon's docs).
- **Group chat test result:** the Pro-plan shared-pool number receives 1:1 DMs but group chat messages never arrive (log shows `bot=shared`). Photon's docs list group creation/membership/events as "dedicated lines only". Next step: ask the Photon table for a dedicated line; else build `npm run local` (`@spectrum-ts/imessage-local`, Full Disk Access) on a teammate's Mac.
- Only one bot process per Photon number. A separate test bot lives in `~/keeper-grouptest`; stop it before running `npm run dev` here, or both will reply.
- This repo is a scaffold: see docs/STATUS.md for what's built vs. TODO. The original planning doc: https://claude.ai/code/artifact/eeea11f9-44cd-44c1-9abb-b1b7094c0f45
- Spectrum SDK notes: `imessage(app).space.create(userId)` opens a DM; `space.type` is `"dm" | "group"`; `message.react(emoji)`, `message.reply(text)` (threaded), `space.responding(fn)` shows typing; reply/edit content wraps the text in `content.content`.
