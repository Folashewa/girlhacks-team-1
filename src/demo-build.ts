// Record the demo: replay scenarios/demo/*.txt through the real Keeper (and the real model, if a key is set)
// and save every message, tapback, reply and tree snapshot to web/demo/demo.json for the demo stage (web/demo.html).
// Recording once makes the demo work offline, with no phone line, and the same every time.
//   npm run demo:build
// Scenario format: see scenarios/demo/1-capstone.txt.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { publicChat } from "./api.ts";
import { makeBrain } from "./brain.ts";
import { config } from "./config.ts";
import { elevenlabsEnabled, tts } from "./elevenlabs.ts";
import { Keeper, recap } from "./keeper.ts";
import { Store } from "./store.ts";

const DIR = "scenarios/demo";
const OUT = "web/demo";

type Event =
  | { t: "msg"; who: string; text: string; keeperOnly?: boolean }
  | { t: "lost"; text: string; ref?: string }
  | { t: "wait"; min: number }
  | { t: "react"; ref: string }
  | { t: "keeper"; text: string; replyTo?: string }
  | { t: "tree"; tree: ReturnType<typeof publicChat> };

const store = new Store(); // in memory: the demo never touches data/state.json
const brain = makeBrain();
let clock = Date.parse("2026-10-03T14:00:00Z");
let events: Event[] = [];
const keeper = new Keeper({
  store,
  brain,
  // No waiting for bursts, no reminders, and no rate limit on credit messages, so every moment shows up on cue.
  rules: { ...config.rules, burstMs: 0, resurfaceAfterMs: 1e12, unpromptedCooldownMs: 0, unpromptedDailyMax: 99 },
  now: () => clock,
  publicUrl: config.publicUrl,
  outbox: {
    react: async (_s, ref) => void events.push({ t: "react", ref: String(ref) }),
    send: async (_s, text, replyTo) => void events.push({ t: "keeper", text, ...(replyTo ? { replyTo: String(replyTo) } : {}) }),
  },
  log: () => {},
});

console.log(`brain: ${brain.name}`);
const chats = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".txt")).sort()) {
  const spaceKey = `demo:${file}`;
  events = [];
  let title = file;
  const snapshot = async () => {
    await keeper.flushAll();
    events.push({ t: "tree", tree: publicChat(store.chat(spaceKey)) });
  };
  for (const raw of readFileSync(join(DIR, file), "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    const t = line.match(/^#\s*title:\s*(.+)$/);
    if (t) store.chat(spaceKey).title = title = t[1]!;
    if (!line || line.startsWith("#")) continue;
    if (line === "---") {
      await snapshot();
      continue;
    }
    const wait = line.match(/^@wait\s+(\d+)/);
    if (wait) {
      await snapshot();
      clock += Number(wait[1]) * 60_000;
      events.push({ t: "wait", min: Number(wait[1]) });
      continue;
    }
    const lost = line.match(/^@lost\s+(?:"([^"]+)"\s+)?(.+)$/);
    if (lost) {
      events.push({ t: "lost", text: lost[2]!, ...(lost[1] ? { ref: lost[1] } : {}) });
      continue;
    }
    const m = line.match(/^(\+?)([^:]{1,24}):\s*(.+)$/);
    if (!m) continue;
    const [, plus, who, text] = m as unknown as [string, string, string, string];
    events.push({ t: "msg", who, text, ...(plus ? { keeperOnly: true } : {}) });
    clock += 20_000;
    await keeper.receive({ spaceKey, senderKey: `demo:${who}`, senderName: who, text, isGroup: true, ref: text });
  }
  store.chat(spaceKey).title = title;
  await snapshot();
  const chat = store.chat(spaceKey);
  chats.push({ file, title, code: chat.code, events, recap: recap(chat) });
  console.log(`\n${title}: ${chat.items.length} items, ${events.filter((e) => e.t === "keeper").length} Keeper messages`);
  for (const e of events) if (e.t === "keeper") console.log(`  Keeper: ${e.text.replace(/\n/g, " / ")}`);
}

mkdirSync(OUT, { recursive: true });
let voice = false;
if (elevenlabsEnabled()) {
  const audio = await tts(chats[0]!.recap).catch(() => undefined);
  if (audio) {
    writeFileSync(join(OUT, "recap.mp3"), audio);
    voice = true;
  }
}
// Priya is in every demo chat, so her personal grove code opens all the recorded trees on the tree page.
const grove = store.groveCode("demo:Priya");
writeFileSync(join(OUT, "demo.json"), JSON.stringify({ brain: brain.name, voice, grove, chats }, null, 1));
console.log(`\ntree codes: ${chats.map((c) => `${c.title} ${c.code}`).join(" · ")} · Priya's grove ${grove}`);
console.log(`wrote ${OUT}/demo.json${voice ? ` and ${OUT}/recap.mp3` : " (no voice: ELEVENLABS_API_KEY not set)"}`);
