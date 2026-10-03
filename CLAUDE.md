# Working rules for Claude Code

- Read `docs/IMPLEMENTATION.md` (the plan) and `docs/STATUS.md` (what's actually built) before starting.
- Work one task at a time, in the plan's order. If something is ambiguous, ask instead of guessing.
- Run `npm test` and `npm run typecheck` after every change; both must pass.
- The model proposes, the code decides: privacy, credit, rate limits and ownership are enforced in `src/keeper.ts`, never only in the prompt. Add a test for every such rule.
- Never send phone numbers or raw person ids to the model or the tree site.
- Chats never mix: nothing from one chat (or a DM) reaches another chat's memory, model call, list or tree.
- Never commit `.env` or `data/state.json`.
