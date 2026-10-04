# Grove 🌱 (Keeper)

Grove Keeper is a quiet member of your iMessage group chat. It remembers **who committed to what**, **what was decided**, and **whose idea it was**. When someone's idea gets talked over and restated later, Keeper credits the person who said it first.

Every group chat grows its own **tree**. Type the chat's code on our website to see it. If you're in several groups, your trees grow together into an **Enchanted Grove**.

```
 iMessage group ──► Photon Spectrum ──► Keeper bot (Node/TypeScript) ──► Azure OpenAI (one call per burst)
                                            │   ├─► ElevenLabs (voice recaps, meeting transcription)
                                            │   └─► Tiger Data (growth history, time-series)
                                            ▼
                                    data/state.json ──► /api/lookup/<code> ──► Keeper Grove website (web/)
                                                                               on Azure App Service at grovekeeper.club
```

## Tools

We kept the tool list short. Each tool does one real job.

| Tool | What it does in Keeper |
| --- | --- |
| **Photon Spectrum** | Keeper lives in a real iMessage group: tapbacks, threaded replies, voice notes |
| **Azure OpenAI** | One structured model call per burst finds commitments, decisions and restated ideas |
| **ElevenLabs** | `keeper recap voice`, the 🔊 Recap button, and meeting transcription that tells speakers apart |
| **Tiger Data** | Every sprout/bloom is a time-series event in a hypertable. Continuous aggregation creates each tree's "growth rings" |
| **Meetings → next steps** | Paste or record a meeting; get owners, decisions and ideas, credited per speaker |
| **Enchanted Grove Tree** | The glowing tree acts as a singular place to see everything occurring |
| **Azure App Service** | Runs Keeper's website and API around the clock |
| **grovekeeper.club** | Our domain, where people type their tree code |

## Quick start (no keys needed)

Requires **Node 22** (20.12+ works).

```bash
npm install
npm test               # 25 behaviour tests
npm run typecheck     
npm run terminal       # chat with Keeper in your terminal
npm run sim -- scenarios/credit.txt --save    # replay a conversation, save it, print its tree code
npm run sim -- scenarios/club.txt --save      # a second chat with Priya in it -> her grove has 2 trees
npm run tree           # open http://127.0.0.1:8787 and type a printed code (try Priya's GROVE- code)
```

Without an AI key, Keeper uses a simple rule-based "mock brain". Add a key for the real thing.

## Going live

1. `cp .env.example .env` and fill in the keys (see [docs/SETUP.md](docs/SETUP.md)).
2. `npm run dev`, then text your Photon number `keeper help` 1:1. It should reply.
3. Add the number to a group chat and send `keeper help` there. **Test this first.**
4. In the group: `keeper code` → open the link → watch the tree grow.

If the shared Photon number can't join a group, try in order: ask the Photon table for a dedicated line, `npm run local` on a teammate's Mac, or demo the group with `npm run terminal`.

## Commands (in the chat)

| Say | What happens |
| --- | --- |
| *(nothing)* | Keeper stays silent. 👍 tapback when it records something |
| `keeper help` | What Grove does |
| `keeper code` | This chat's tree code + link |
| `keeper name Women in CS board` | Name the tree |
| `keeper grove` (1:1 only) | Your personal grove code: every tree you're part of |
| `keeper list` / `keeper what's still open?` | Open commitments, decisions, ideas |
| `keeper done 3` / `keeper drop 3` | Mark item #3 done / dropped |
| `keeper recap` / `keeper recap voice` | Summary, as text or an ElevenLabs voice note |
| `keeper call me Priya` | Use your name instead of P1 |
| `keeper quiet 30m` / `keeper unquiet` | Pause unprompted messages |
| `keeper me` (1:1 only) | Your own talk-time stats; never posted in the group |
| `keeper forget everything` | Wipe this chat's memory |
| `keeper <any question>` | Answered from memory by the model, as a threaded reply |

## Tree codes and privacy

- Each chat gets a random code like `MOSS-K7Q2XA` (about a billion combinations per word). Anyone in the chat can ask for it.
- A grove code (`GROVE-...`) shows every group tree one person is in, so Keeper only sends it in a 1:1 DM.
- The API has **no "list everything" endpoint**. You need a code to see a tree, and wrong guesses are rate-limited (20/minute).
- The site remembers codes you've opened on that device. Two or more saved trees become "All my trees".
- Trees never include phone numbers or message text, and the model never sees phone numbers.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Bot on iMessage via Photon (auto-restarts on code changes) |
| `npm start` | Same, without auto-restart (use this to leave it running all weekend) |
| `npm run local` | Bot on a self-hosted iMessage line (teammate's Mac) |
| `npm run terminal` | Bot in your terminal, no phone needed |
| `npm run tree` | Only the API + website (prints every tree code, locally) |
| `npm run sim -- <file> [--save]` | Replay a scenario from `scenarios/` |
| `npm run meeting -- <file> "Title"` | Turn a meeting transcript (.txt) or recording (.m4a/.mp3/.wav) into a tree |
| `npm test` / `npm run typecheck` | Run after every change |

## Where to change what

| File | What lives there | Owner |
| --- | --- | --- |
| `src/prompts.ts` | Personality, rules, what the model sees | B |
| `src/keeper.ts` | Hard rules: confidence, quiet mode, rate limits, credit never names the restater, commands | A |
| `src/index.ts` | Spectrum wiring, sending, the run modes | A |
| `src/brain.ts` | One structured model call (Azure OpenAI / OpenAI / mock), defensive parsing | B |
| `src/elevenlabs.ts` | Voice recaps and meeting transcription with speaker labels | B/C |
| `src/tiger.ts` | Tiger Data: hypertable, continuous aggregate, growth rings | C |
| `src/meeting.ts` | Meeting transcripts → items | C |
| `src/api.ts` + `web/` | Code lookup, tree + grove website | C |
| `src/store.ts` | Memory format (`data/state.json`), tree and grove codes | A |
| `scenarios/*.txt`, `tests/` | Demo conversations and behaviour tests | B and C |

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/lookup/<code>` | `{ type: "tree" \| "grove", trees: [...] }` |
| `GET /api/trees/<code>` | `{ code, title, people, items: [{ id, kind, text, status, from, owner, due, source, credited }], stats }` |
| `GET /api/trees/<code>/growth` | `{ source: "tiger" \| "memory", points: [{ t, planted, bloomed, credited }] }` |
| `GET /api/trees/<code>/recap` / `recap.mp3` | Spoken summary (text / ElevenLabs MP3) |
| `POST /api/meetings?title=...` | Body: transcript text, or an audio file. Returns `{ code, title, added }` |
| `GET /api/health` | Which tools are live |

## How to Run On Your Device

Codes for 
| **GROVE-B67FWN** | **Priya's Enchanted Grove**: all three trees together. Best one to show off. |
| **LILY-LSCPQH** | CS 4800 Capstone 🎓, the group project from the demo |
| **SAGE-W95D6A** | Women in CS Board 💜 |
| **ROWAN-N9AJL5** | Apt 4B 🏠 |

Suggestion: start with **LILY-LSCPQH** (shown in demo), then **GROVE-B67FWN** to show the grove. You can type codes in any case, with or without the dash.

The demo links:
https://youtu.be/KEDjruleb6I?si=Gh5jh_zJ5L7e4p5y 
- **Demo, presenter mode:** https://grovekeeper.club/demo.html 
  Use → / ← to switch acts, space to pause and R to restart.
- **Auto-play, for screen-recording the video:** https://grovekeeper.club/demo.html?auto=1 
- **Website, where you enter a tree code:** https://grovekeeper.club 

If your device still can't reach grovekeeper.club, the same demo is at https://keepergrove.azurewebsites.net/demo.html. 

Link to Presentation: https://docs.google.com/presentation/d/1kb47jy-YO_jRFXcjLYUYEsnMBgG2gnGdcsyJAWDm-nY/edit?usp=sharing
