# Seed (Grovekeeper)

An AI member of an iMessage group chat (built on [Photon Spectrum](https://photon.codes/spectrum)) that quietly keeps track of what still needs someone, who's doing what, what got decided, and ideas that shouldn't get lost — with credit always going to whoever said it first. GirlHacks 2026, theme "Enchanted Grove".

## Run it

Requires Node 22.15+.

```bash
npm install
cp .env.example .env      # fill in SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET
npm test                  # behavior tests
npm run typecheck
npm run terminal          # chat with it locally: "Priya: keeper help"
npm run dev               # live on iMessage
```

## Layout

```
src/
  index.ts        entry: transport + debounce + action execution
  connection.ts   iMessage (Photon cloud) and terminal transports
  keeper.ts       all decision logic; returns Actions
  commands.ts     "keeper help/list/done/quiet/resume/call me/forget everything"
  format.ts       deterministic replies for commands
  store.ts        JSON-file memory (data/state.json), one state per chat
  brain.ts        model call (TODO, Task 3)
  prompts.ts      system prompt + snapshot builder (TODO, Task 3)
  config.ts       settings from .env
tests/            behavior tests (node:test, no API key needed)
scenarios/        scripted conversations for tuning (Task 3)
docs/             IMPLEMENTATION.md (the plan) and STATUS.md (what's actually done)
```

The plan and task order live in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md); current progress in [docs/STATUS.md](docs/STATUS.md).

Link to Presentation:
