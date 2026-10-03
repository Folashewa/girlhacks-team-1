# Grovekeeper — Implementation Plan

> **How to use this file:** this is the single source of truth for what to build. Work one task at a time, in order. Each task has: goal, files, exact spec, tests to add, and a definition of done (DoD). Do not start a task until the previous task's DoD passes. If something in this file is ambiguous, stop and ask the human instead of guessing.

Hackathon: GirlHacks 2026 (NJIT), theme "Enchanted Grove". Started Sat Oct 3, 10:30am. Submission ~10:30am Sun Oct 4 (confirm exact time on Devpost). Team of 3.

---

## 0. What we are building (read this first)

**Grovekeeper** is an AI member of an iMessage group chat where people plan something together: a hackathon team, a group assignment, a trip, a surprise birthday. It quietly makes sure nothing slips:

- things nobody has taken yet ("someone needs to book the Airbnb")
- things people said they'd do ("I'll do the slides by 6")
- what got decided ("ok we're going Oct 10–12")
- ideas, especially from people who got talked over — credit always stays with whoever said it first

It lives in the chat (built on Photon Spectrum). A companion **tree website** (built on DeepSpace) shows each chat's plan as a glowing, growing tree. That is where the Enchanted Grove theme lives.

**Pitch line:** "Every group chat is a grove. Ideas are seeds, and seeds get trampled. Grovekeeper makes sure every seed is remembered — and remembered as yours."

### Prizes we are targeting (one project, enter all on Devpost)

| Prize | Value | What wins it for us |
|---|---|---|
| Photon — Agents in iMessage | $400 + $300 credits + interview fast-track | The agent: silent by default, credits buried ideas, private back-out flow, real users |
| DeepSpace — Best Use | 100,000 credits ($1,000) | Tree site using real-time sync + permissions in actual behavior (not a logo) |
| Whimsical Wonders (on-theme) | — | The tree + light grove voice |
| Avanade — Best Use of Azure | merch | Only if we use Azure OpenAI as the model |
| Overall, Diversity | — | All of the above |

### The non-negotiable rules (also enforced by tests)

1. **The model proposes, the code decides.** Anything about privacy, credit, rate limits or who owns what is enforced in code (`src/keeper.ts`), never only in the prompt.
2. **A group's view never changes until that group is told,** and only the person it's about decides who gets told.
3. **Chats never mix.** Each group chat has its own memory. Nothing from one chat (or a private 1:1) ever reaches another chat, its model call, its `keeper list`, or its tree page.
4. **No phone numbers leave the agent.** The model sees P1/P2; the tree site sees first names or "Member 2" and hashed ids.
5. **Credit never names the restater.** When Jake repeats Priya's idea, we credit Priya and never mention Jake.
6. **Never shame.** No pointing out who hasn't paid, helped, replied or shown up.
7. **Silent by default.** At most 6 unprompted messages per chat per day, 10 min apart, only 8am–11pm.

---

## 1. Target state

> **Note (Oct 3):** this section describes the full agent we're aiming for. The repo currently holds a **scaffold** only — see `docs/STATUS.md` for what actually exists. Files marked TODO in the code still need building.

### Repo map

```
keeper/
  docs/IMPLEMENTATION.md    this file
  src/
    index.ts                entry: connects Spectrum, executes Actions, timers, shutdown
    connection.ts           iMessage (Photon cloud) + terminal connections
    connect-local.ts        Mac-only fallback: the Mac's own Messages app
    keeper.ts               ALL decision logic (platform-independent; returns Actions)
    prompts.ts              system prompt + snapshot builder (P1/M1 refs, no phone numbers)
    brain.ts                one structured-output model call + defensive parsing
    store.ts                JSON-file memory (data/state.json), atomic writes
    queue.ts                per-chat debounce + serial execution
    commands.ts             "keeper list/done/quiet/resume/call me/forget/me/tree"
    format.ts               deterministic replies for commands
    api.ts                  read-only local JSON API for the tree (GET /api/chats[/:alias])
    config.ts               every setting, read from .env
  scripts/simulate.ts       run a scripted conversation through the real model, no phone
  scenarios/*.txt           hackathon, trip, birthday, edge-cases, nudge
  tests/keeper.test.ts      behavior tests with a fake model
```

### How a message flows

```
iMessage → Spectrum (index.ts) → Keeper.ingest()       commands + private replies handled instantly, no model
                                     │
                           ChatQueue.debounce ~6s per chat
                                     ▼
                              Keeper.analyze()  → Brain (1 model call per burst)
                                     │             returns proposed updates + one intervention
                     code validates: confidence ≥ 0.75, quiet mode, rate limits,
                     active hours, ownership, privacy, credit-never-names-restater
                                     ▼
                     Action[]: react / reply / send / dm  → executed by index.ts
                                     │
                         data/state.json → api.ts (tree data)
```

### Data model (src/store.ts)

- `Item.kind`: `"request" | "commitment" | "decision" | "idea" | "question"`
  - `request` = something nobody has taken yet; `ownerId` set when someone claims it
- `Item.status`: `"open" | "done" | "dropped"`
- `Item.originId` = who said it first (credit follows this), `ownerId` = who is doing it
- `Item.restatedBy[]` = others who repeated an idea later
- `Item.release` = private back-out in progress (`awaiting` → `told-origin` | `owner`)
- `SpaceState` = one chat: `alias` (g1, d2…), `isGroup`, `log`, `items`, `quietUntil`, `unprompted[]`, `talk` (private)

### Features (target)

- Silent tapback when something is recorded; never on a request (👍 would read as "I'll do it")
- Claims ("I'll book it"), double-claim keeps the first, nobody signed up on someone else's say-so
- One reminder for unclaimed requests / ignored ideas once the chat moves on
- Credit for restated ideas, blocked if the text names the restater
- Threaded answers when addressed ("keeper what's still open?")
- Private back-out flow: 1 post / 2 tell requester / 3 handle it; one private follow-up
- Private reminders before due (`NUDGES=on`), "done" in DM closes
- Quiet mode, active hours, forget everything, names via "keeper call me Priya"
- Edited messages, threaded replies, restart recovery, first-DM self-introduction
- Three run modes: `npm run dev` (iMessage), `npm run terminal`, `npm run local` (Mac)

---

## 2. Setup (everyone, 15 min)

1. Install **Node.js 22.15+** (DeepSpace requires it; the agent needs ≥ 20.6). Check: `node -v`.
2. Open the repo folder in VS Code (File → Open Folder).
3. Terminal (Ctrl+`):
   ```bash
   npm install
   cp .env.example .env        # Windows PowerShell: copy .env.example .env
   ```
4. Fill `.env`: `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET` (Photon dashboard → Settings), and ONE model provider (Azure OpenAI or OpenAI). For Azure: deployment of `gpt-4o-mini` or `gpt-4.1-mini`, API version `2024-10-21`.
5. Verify:
   ```bash
   npm test            # all pass
   npm run typecheck   # no output
   ```

**DoD:** both commands pass on every teammate's machine.

---

## 3. Ownership

| Person | Owns | Files |
|---|---|---|
| **A — Agent** | Tasks 1, 2, 4, 6 | `src/index.ts`, `src/keeper.ts`, `src/commands.ts`, `src/sync.ts` |
| **B — Brain & tests** | Tasks 3, 7, 9 | `src/prompts.ts`, `scenarios/`, `tests/`, `scripts/` |
| **C — Tree site (DeepSpace)** | Tasks 5, 8 | the separate `grove-site/` DeepSpace app |

Only one person edits a given file at a time. Commit small and often (`git commit` after each task's DoD).

---

## 4. Tasks, in order

### Task 1 — Prove group chats work (A, 15 min, FIRST)

**Why:** Photon's Pro plan (the promo code) uses a shared number pool. Docs say it can't *create* groups; messages inside an existing group should still arrive. Unconfirmed — everything depends on it.

1. `npm run dev`
2. Text the Photon number 1:1: `keeper help` → must reply with the help text.
3. Make an iMessage group: that number + 2 teammates. Send `keeper help` in the group → must reply.
4. Confirm all teammates see the same number for the bot.

**If step 3 fails, in this order:** (a) ask the Photon table for a dedicated line for the weekend; (b) run `npm run local` on a teammate's Mac signed into Messages with a spare Apple ID (`npm install @spectrum-ts/imessage-local`, give the terminal Full Disk Access) — still Spectrum, still qualifies; (c) demo the group in `npm run terminal`, real iMessage only for DMs.

**DoD:** the bot replies inside a real group chat (cloud or local mode). Write which mode works in `docs/STATUS.md`.

---

### Task 2 — Grove voice in the chat (A, 30 min)

**Goal:** a light theme layer (~10%) without hurting usefulness.

1. `.env`: `ACK_EMOJI=🌱`. Test on each teammate's phone that a 🌱 reaction displays. If any phone shows it badly, revert to `👍` and note it in STATUS.md.
2. `src/prompts.ts` → in the `# Voice` section, append exactly:
   ```
   You are the keeper of this group's grove: ideas are seeds and the people who plant them matter. Only in a credit or resurface message may you use one light garden image ("that one grew from Priya's seed earlier"). Never in answers, reminders or clarifications. Never more than one per message.
   ```
3. `src/format.ts` → `formatHelp`: change the first line to:
   `I'm Grovekeeper 🌱 I quietly keep track of what still needs someone, who's doing what, what got decided, and ideas that shouldn't get lost.`
4. In the Photon dashboard, if a contact name/photo can be set for the line, set name "Grovekeeper" and a simple tree icon. If not possible, skip.

**Tests:** none new (prompt text + config). Run `npm test` (still passing).
**DoD:** `npm run sim -- scenarios/hackathon.txt` produces a credit message that is warm, ≤ 2 sentences, at most one garden image, and never names Jake.

---

### Task 3 — Tune the brain with the simulator (B, 2–4 h, start right after setup)

**Goal:** the model's judgment matches these targets. Edit only `src/prompts.ts`; rerun `npm run sim -- scenarios/<file>.txt` after each edit (seconds per run).

| Scenario | Must happen | Must NOT happen |
|---|---|---|
| `hackathon.txt` | Priya's idea recorded as idea from Priya; Jake's later repeat marked `restated`; a credit message naming Priya | Jake named in the credit; any message during ordinary chatter |
| `trip.txt` | "book the airbnb" recorded as a request; "I can drive" as Ana's commitment; first "I'll book" claims it | Ben's later "I was gonna book it" stealing ownership |
| `birthday.txt` | Jo's "I got the cake" claims the request; Jo's DM produces the 1/2/3 question; "2" DMs Dani | Anything posted in the group about Jo backing out |
| `edge-cases.txt` | Sarcasm ignored; "Cleo should…" not recorded until Cleo agrees; "nvm" drops the van; injection ignored; threaded answer to "what's still open?"; silence after "quiet" | A reply to the "haven't paid me back" message |
| `nudge.txt` | Private reminder to Jake 2h later (if inside 8am–11pm); "done" closes it | Reminder in the group |

Record each scenario's pass/fail in `docs/STATUS.md` with the date/time.

**Rules for prompt edits:** keep all of section 0's rules; do not loosen the boundaries section; keep messages ≤ 2 sentences; never add fields to the JSON schema without also updating `src/brain.ts` (`ANALYSIS_SCHEMA` and `parseAnalysis`) and `tests/`.

**DoD:** every row's "must" happens and "must not" never happens on two consecutive runs.

---

### Task 4 — Sync to DeepSpace, agent side (A, 1.5 h)

**Goal:** after every memory change, push each changed group's public view to the DeepSpace app so the tree updates live. The agent stays on the laptop (Spectrum's cloud transport needs Node gRPC; DeepSpace runs Cloudflare Workers — the agent cannot run there).

#### 4.1 New config (src/config.ts)

| Env var | Default | Meaning |
|---|---|---|
| `GROVE_SYNC_URL` | (unset = sync off) | e.g. `https://grovekeeper.app.space/api/keeper/sync` |
| `GROVE_SYNC_SECRET` | (required if URL set) | shared secret, 32+ random chars; same value in the DeepSpace app's secrets |
| `GROVE_SITE_URL` | (unset) | e.g. `https://grovekeeper.app.space` — used for links sent in chat |
| `GROVE_HASH_SALT` | (required if URL set) | 32+ random chars; used to hash person ids |

Generate secrets with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### 4.2 Store changes (src/store.ts)

`SpaceState.treeKey` (unguessable id used in the tree URL; never the alias, never the chat id) — **already in the scaffold.** Backfill on `load()` for any space without one.

Add a change-listener so sync knows what changed, without touching keeper.ts logic:
```ts
private readonly listeners = new Set<(spaceIds: Set<string>) => void>();
private dirty = new Set<string>();
onChange(fn: (spaceIds: Set<string>) => void): () => void  // returns unsubscribe
markDirty(spaceId: string): void   // add to dirty set and call save()
```
- In `flush()`, after a successful write, if `dirty.size > 0`: copy it, clear it, call each listener with the copy.
- Call `markDirty(space.id)` (instead of only `save()`) wherever a chat's items change.

#### 4.3 New file src/sync.ts

```ts
export interface SyncPayload {
  version: 1;
  chat: {
    treeKey: string;            // from SpaceState.treeKey
    alias: string;              // "g1" — display only
    title: string | null;       // optional, from space.getDisplayName() if cached; else null
    updatedAt: number;
  };
  people: {
    personKey: string;          // HMAC-SHA256(GROVE_HASH_SALT, personId), hex, first 24 chars
    name: string;               // store.nameOf(id) ?? `Member ${n}` (n by first appearance)
    colorIndex: number;         // 0..7, by first appearance in the chat
  }[];
  items: {
    id: string;                 // "I3"
    kind: "request" | "commitment" | "decision" | "idea" | "question";
    text: string;
    status: "open" | "done";    // dropped items are NOT sent
    from: string;               // personKey of originId
    owner: string | null;       // personKey of ownerId
    due: string | null;
    dueAt: number | null;
    discussed: boolean;         // item.engaged
    credited: boolean;          // restatedBy.length > 0
    createdAt: number;
    updatedAt: number;
  }[];
}
```

Privacy rules in the payload builder (enforced in code, with tests):
- Only `isGroup` spaces are synced. DMs never.
- No `log`, no message text, no `talk` stats, no `restatedBy` identities, no `release` info.
- An item whose `release?.stage` is `"awaiting"` or `"told-origin"` is sent **exactly as the group last saw it** (owner unchanged).
- `personKey` is a salted HMAC; raw ids (phone numbers) never leave the process.

Behavior:
- `startSync(store, config)`: if `GROVE_SYNC_URL` unset → log once "sync off" and return.
- Subscribe with `store.onChange`. For each changed group space: build payload, `PUT` it to `GROVE_SYNC_URL` with `authorization: Bearer ${secret}`.
- Idempotent: the payload is the full current state of one chat; the server replaces what it had.
- Coalesce: never two pushes at once per chat; if one is in flight, push once more after it finishes.
- Failures: retry after 2s, 5s, 15s; then give up until the next change. Log one line per failure. **Never throw into the agent.**
- Timeout each request at 8s (`AbortSignal.timeout(8000)`).
- On startup, push every group once.

Wire it in `src/index.ts` after the store loads: `startSync(store, config)`.

#### 4.4 Tree links in chat

`keeper tree` replies with `${GROVE_SITE_URL}/g/${space.treeKey}` (group chats only; in a DM reply "Ask me in your group chat for its tree.").

#### 4.5 Tests (tests/sync.test.ts, new)

1. payload for a group includes items and names; DM spaces produce no payload
2. payload never contains: any `senderId`, any log text, the chat id, `talk`, `restatedBy`
3. dropped items are excluded
4. an item with `release.stage = "awaiting"` still shows the original owner
5. `personKey` is stable for the same id+salt and differs across salts
6. coalescing: two rapid changes → at most 2 fetches (mock `fetch` via an injected function)

**DoD:** `npm test` passes, `npm run typecheck` clean, and with `GROVE_SYNC_URL` pointed at a local test server (a 10-line `node:http` server that logs the request body and returns 204), the payload arrives after a chat message in `npm run terminal`.

---

### Task 5 — The tree site on DeepSpace (C, 4–6 h, starts in parallel at Task 1)

**Setup (from the DeepSpace kit):** claim credits at the event credit link first; agree ONE app owner; teammates join as collaborators.
```bash
npm create deepspace@latest grovekeeper -- --no-register
cd grovekeeper
npx deepspace auth login
npx deepspace app init
npx deepspace dev start
```
**Before writing code, read the DeepSpace SDK docs (https://docs.deep.space).** Use the SDK's own primitives for collections, real-time sync, auth and permissions — do not hand-roll websockets.

#### 5.1 Backend (DeepSpace worker)

- Secret `GROVE_SYNC_SECRET` (same value as the agent's).
- Route `PUT /api/keeper/sync`:
  - Reject with 401 unless `Authorization: Bearer <secret>` matches (constant-time compare).
  - Validate body against `SyncPayload` (section 4.3). Reject 400 on anything unexpected; cap body at 256 KB.
  - Upsert into collections, keyed by `chat.treeKey`: `chats` (one row), `people` (replace set), `items` (replace set). Items not in the payload are deleted.
  - Respond 204.
- Read access for the page: real-time subscription to one chat by `treeKey` (the key itself is the capability; see 5.3).

#### 5.2 Page routes

- `/` — landing: night-forest hero (see 5.4), one line pitch, "Add Grovekeeper to your group chat: text <number>". A **demo button** opens `/g/demo`.
- `/g/:treeKey` — the live tree for one chat. Subscribes in real time; new items animate in.
- `/g/demo` — same page fed by the local fixture below (never hits the network). The demo must work even if sync or Wi-Fi fails.

#### 5.3 Permissions (DeepSpace judging: "sensible permissions")

- **MVP (do this):** a chat's tree is readable by anyone with its `treeKey` (128-bit, unguessable, only ever sent inside that chat). Write access: only the sync route. No listing endpoint of all chats — ever.
- **Stretch (only after Task 6):** "private view". `keeper me` in a 1:1 replies with a one-time link `${site}/me?t=<token>`; the agent includes `{ linkTokens: [{ token, personKey, expiresAt }] }` in a separate authenticated sync call; the page requires DeepSpace login, redeems the token once to bind the login to that `personKey`, then shows that person's own items across their chats. Nobody else can see it. Implement only with the SDK's permission rules, and test with two logged-in users as the kit says.

#### 5.4 Visual spec (the theme — this is what judges see)

Palette (CSS variables):
```
--night: #07060D      background
--panel: rgba(20,16,36,0.72)
--gold: #F2C86B       trunk, branches, accents (glow)
--gold-soft: #F7E4B0  headings
--mist: #8E6CF0       undecided questions (blurred)
--ink: #ECE6F7        body text
--muted: #A99CC7      secondary text
person colors (colorIndex 0..7): #7FF2D0 #FFB38A #C9B4FF #8FD3FF #F7A8C9 #B9F28F #FFD978 #A0E7E5
```
Fonts (Google Fonts): `Cinzel` (titles, letter-spacing .18em, uppercase), `Cormorant Garamond` italic (storytelling labels), `DM Sans` (all UI text).

Background: near-black with a soft purple radial glow behind the tree, sparse twinkling stars (≤ 40, CSS animation, paused under `prefers-reduced-motion`).

**The tree mapping (exact):**

| Data | Drawn as |
|---|---|
| The chat | Trunk rising from roots; title above in Cinzel |
| Person | One branch per person, color = person color; branches ordered by first appearance, alternating left/right |
| `idea` (open, not discussed) | Small seed glowing in the planter's color, at the base of their branch, faint pulse |
| `idea` discussed or credited | Sprout grows from the **original planter's** seed (credit made visible); `credited` adds a tiny gold ring |
| `request`, no owner | Faint flickering bud near the canopy top, gold outline |
| `request` / `commitment` with owner | Leaf on the owner's branch in their color |
| any item `done` | The leaf blooms into a blossom (petals) |
| `decision` | A gold ring inside the trunk (newest at top) with its text on hover |
| `question` (open) | Purple mist drifting at the canopy edge; text appears on hover |

Layout must be **deterministic**: position = f(person order, item id hash). Same data → same picture after reload. Use SVG (one `<svg>`, viewBox 1000×700), React components per element type. No canvas, no Three.js (time).

Interaction:
- Hover/focus any element → tooltip: item text, "from Priya", "taken by Jake", due.
- Click → side panel with the same, plus a list view toggle ("See as list") for accessibility.
- Every element is keyboard-focusable with an `aria-label` ("Idea from Priya: prep sauces the night before").
- New item: grows from scale 0 → 1 over 600ms with a brief glow; skip animation under `prefers-reduced-motion`.
- Header: chat title (or "Your grove"), counts: "4 taken · 2 need someone · 3 ideas · 1 decided".
- Empty state: a single seed and "Your grove is waiting for its first seed. Say 'keeper help' in the chat."

Responsive: phone width works (judges will open it on phones); tree scales, side panel becomes a bottom sheet.

#### 5.5 Demo fixture (put in the site at `src/fixtures/demo.json`)

```json
{
  "version": 1,
  "chat": { "treeKey": "demo", "alias": "g1", "title": "GirlHacks team", "updatedAt": 1759500000000 },
  "people": [
    { "personKey": "p1", "name": "Priya", "colorIndex": 0 },
    { "personKey": "p2", "name": "Jake", "colorIndex": 1 },
    { "personKey": "p3", "name": "Maya", "colorIndex": 2 }
  ],
  "items": [
    { "id": "I1", "kind": "idea", "text": "Make it live in the group chat instead of an app", "status": "open", "from": "p1", "owner": null, "due": null, "dueAt": null, "discussed": true, "credited": true, "createdAt": 1759500000000, "updatedAt": 1759501200000 },
    { "id": "I2", "kind": "commitment", "text": "Figma mockups", "status": "done", "from": "p3", "owner": "p3", "due": "by 6", "dueAt": null, "discussed": false, "credited": false, "createdAt": 1759500060000, "updatedAt": 1759510000000 },
    { "id": "I3", "kind": "commitment", "text": "Set up the repo", "status": "open", "from": "p2", "owner": "p2", "due": null, "dueAt": null, "discussed": false, "credited": false, "createdAt": 1759500120000, "updatedAt": 1759500120000 },
    { "id": "I4", "kind": "request", "text": "Submit the Devpost", "status": "open", "from": "p1", "owner": null, "due": "before 10:30am", "dueAt": null, "discussed": false, "credited": false, "createdAt": 1759500300000, "updatedAt": 1759500300000 },
    { "id": "I5", "kind": "decision", "text": "Pivot to a group chat agent", "status": "open", "from": "p1", "owner": null, "due": null, "dueAt": null, "discussed": false, "credited": false, "createdAt": 1759501300000, "updatedAt": 1759501300000 },
    { "id": "I6", "kind": "question", "text": "Who presents the demo?", "status": "open", "from": "p3", "owner": null, "due": null, "dueAt": null, "discussed": false, "credited": false, "createdAt": 1759501400000, "updatedAt": 1759501400000 }
  ]
}
```
`/g/demo` reveals these one by one (every 2.5s) on load, then a "Replay" button.

**DoD (Task 5):** deployed with `npx deepspace deploy`; `/g/demo` works on a phone; with the agent's sync on, texting "I'll do the slides" in the real group makes a leaf appear on `/g/<treeKey>` within ~10 seconds; a wrong/missing bearer secret gets 401; there is no way to list all chats.

---

### Task 6 — "Your grove is complete" (A, 45 min)

**Goal:** the magic ending. Deterministic, triggered by the group, never automatic.

1. `src/commands.ts`: add `{ type: "wrapup" }` for `keeper wrap up` / `keeper we're done` (group only; in a DM → not a command).
2. `runCommand` case `"wrapup"`:
   - Count items: done, ideas credited, people who planted ideas.
   - Reply in the group (one message):
     `🌳 your grove is complete: ${done} things done, ${ideas} ideas planted by ${planters} people. ${siteUrl}/g/${treeKey}`
     If `siteUrl` is unset, omit the link.
   - Do not change any item's status. Do not mention who did the most or least (rule 6).
3. Optional (only if trivial in Spectrum): send that message with an iMessage effect (`effect` is exported from `@spectrum-ts/imessage`). Use it only on iMessage and fall back to plain text on any error.
4. Site: when the page loads and every item is `done` or it's the demo after replay, show a slow golden "bloom" animation once.

**Tests:** wrapup in a group returns one reply containing the counts and never a person's name; wrapup in a DM is not treated as a command.
**DoD:** tests pass; `npm run terminal` → "Priya: keeper wrap up" shows the message.

---

### Task 7 — Usage stats for the pitch (B, 30 min)

`scripts/stats.ts` → `npm run stats` (add to package.json: `"stats": "tsx scripts/stats.ts"`).

Reads `data/state.json` (path from `DATA_FILE` or default) and prints, **aggregated across group chats only**:
```
Group chats: N
Messages seen: N (people's messages, excluding the agent's)
Things tracked: N  (requests N · commitments N · decisions N · ideas N · questions N)
Claimed requests: N   Completed: N
Ideas credited after being restated: N
Unprompted messages sent: N
Private back-outs handled without posting: N   (release.stage = told-origin or owner)
```
No names, no text, no ids in the output.

**DoD:** runs on the real `data/state.json` and on an empty/missing file (prints zeros, no crash).

---

### Task 8 — Real users (everyone, by 9pm Saturday)

1. Put Grovekeeper in your own team chat now; keep `npm run dev` running all weekend on one laptop (plugged in, sleep disabled).
2. Ask 2–3 other GirlHacks teams: "Want an agent in your team chat that keeps track of who's doing what and makes sure nobody's idea gets lost?" Add the number to their chat; say `keeper help`.
3. Tell them: `keeper quiet` and `keeper forget everything` exist; nothing is shared outside their chat.
4. Sunday morning: `npm run stats`; hand-check 30 recorded items against the chats (with permission) and write the % correct in STATUS.md.

---

### Task 9 — Demo, Devpost, rehearsal (B leads, everyone, Sun 7–10am)

**Demo env for the presentation:** `RESURFACE_AFTER_MIN=1`, `UNPROMPTED_COOLDOWN_MIN=1`, `NUDGES=on`.

**2-minute script:**
1. Hook (15s): "Every group plan lives in a group chat, and group chats bury everything: who's booking the Airbnb, who said they'd do the slides, the quiet teammate's idea. Grovekeeper lives in the chat and makes sure nothing slips."
2. Live (60s): two teammates text the real group (follow `scenarios/hackathon.txt` + `trip.txt`); the tree page on the projector grows live. Show: 🌱 on a commitment; the one reminder for "someone needs to submit the Devpost"; the credit to Priya without naming Jake.
3. Judge's phone (20s): they text "keeper what's still open?" → threaded answer.
4. Trust (15s): DM "I can't get the cake anymore" → the 1/2/3 choice; group sees nothing. "A surprise-party chat can never leak into the chat the birthday person is in."
5. Close (10s): stats line + `keeper wrap up` → "your grove is complete" + tree link.

**Rehearse 3 times.** Have a backup screen recording of the full demo in case Wi-Fi fails.

**Devpost write-up:** Inspiration · What it does · How we built it (Photon Spectrum, Azure OpenAI/OpenAI structured outputs, TypeScript, DeepSpace, a test suite with a fake model) · Challenges (shared-pool numbers and groups; privacy across chats; moving rules from prompt into code) · Accomplishments (usage numbers, accuracy %, tests) · What's next (shift swaps, money splitting, iMessage polls, voice memos, calendars). Disclose AI tools used.

Opt into: Photon, DeepSpace, Whimsical Wonders, Diversity, and Avanade if Azure was used.

---

## 5. Stretch goals (only if Tasks 1–9 are done)

| Stretch | Spec | Risk |
|---|---|---|
| Voice memos | In `extractText`, handle `content.type === "voice"`: read it → ElevenLabs speech-to-text → treat as text from the same sender. iMessage voice notes arrive as `audio/x-caf`; may need ffmpeg → m4a. | Medium |
| Polls | When the same `question` is raised in 3 separate bursts, offer a poll; on yes, send an iMessage poll via Spectrum's `poll` content. | Medium |
| Private view on site | Section 5.3 stretch | Medium |
| Swaps | New op `swap` linking two claims | High — skip |

---

## 6. Environment variables (complete list)

| Var | Required | Default | Notes |
|---|---|---|---|
| `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET` | iMessage mode | — | Photon dashboard |
| `TRANSPORT` | no | `imessage` | or `terminal`, `local` |
| `LLM_PROVIDER` | yes | `openai` | `azure` or `openai` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | if openai | model `gpt-4.1-mini` | |
| `AZURE_OPENAI_ENDPOINT`, `_API_KEY`, `_DEPLOYMENT`, `_API_VERSION` | if azure | version `2024-10-21` | |
| `AGENT_NAME` | no | `Keeper` | the wake word people type |
| `ACK_EMOJI` | no | `👍` | set `🌱` (Task 2) |
| `DEBOUNCE_MS` / `ADDRESSED_DEBOUNCE_MS` | no | 6000 / 1500 | |
| `UNPROMPTED_COOLDOWN_MIN` / `MAX_UNPROMPTED_PER_DAY` | no | 10 / 6 | demo: 1 / 6 |
| `RESURFACE_AFTER_MIN` | no | 15 | demo: 1 |
| `MIN_CONFIDENCE` | no | 0.75 | |
| `NUDGES`, `NUDGE_WINDOW_HOURS` | no | off, 12 | demo: on |
| `ACTIVE_HOURS` | no | `8-23` | |
| `DATA_FILE` | no | `data/state.json` | |
| `API_PORT`, `API_HOST` | no | 8787, 127.0.0.1 | local tree API; 0 disables |
| `GROVE_SYNC_URL`, `GROVE_SYNC_SECRET`, `GROVE_HASH_SALT`, `GROVE_SITE_URL` | for DeepSpace | — | Task 4 |

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing SPECTRUM_PROJECT_ID …` | fill `.env` |
| Bot sees DMs but not the group | Pro plan shared pool; see Task 1 fallbacks |
| Azure `response_format` error | API version ≥ `2024-10-21` and a structured-output model (gpt-4o-mini, gpt-4.1 family) |
| Model rejects `temperature` | delete that line in `src/brain.ts` |
| Nothing happens for ~6s | debounce, by design |
| Tree doesn't update | check agent log for "sync" lines; check worker logs for 401/400; verify both secrets match |
| Need to see what it remembers | open `data/state.json` |
| A teammate's iPhone shows 🌱 oddly | set `ACK_EMOJI=👍` |

---

## 8. Definition of done for the whole project

- [ ] Agent works in a real group chat (any mode) and has run ≥ 12 hours
- [ ] All scenario targets in Task 3 pass
- [ ] `npm test` and `npm run typecheck` clean
- [ ] Tree site deployed; `/g/demo` works on a phone; live sync works
- [ ] ≥ 3 real group chats used it; stats + accuracy % recorded
- [ ] Demo rehearsed 3×, backup recording made
- [ ] Devpost submitted with all tracks selected and AI-tool disclosure
