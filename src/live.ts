// The web iMessage simulator (web/demo.html, "Try it live") and the recorded demo trees.
// LiveChat runs the real Keeper, with the real model, on messages typed into the web phone instead of iMessage.
// demoLookup() lets the tree page open the trees recorded by `npm run demo:build` (web/demo/demo.json).
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Brain } from "./brain.ts";
import { config } from "./config.ts";
import { Keeper, type KeeperEvent } from "./keeper.ts";
import type { Chat, Store } from "./store.ts";
import { growthFromMemory } from "./tiger.ts";

export type LiveEvent =
  | { t: "react"; ref: string }
  | { t: "keeper"; text: string; replyTo?: string }
  | { t: "voice"; audio: string; replyTo?: string }; // base64 mp3

export class LiveChat {
  private keeper: Keeper;
  private out: LiveEvent[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private store: Store,
    brain: Brain,
    opts: { tts?: (text: string) => Promise<Buffer | undefined>; onEvent?: (e: KeeperEvent) => void } = {},
  ) {
    this.keeper = new Keeper({
      store,
      brain,
      // Answer right away instead of waiting for a burst, so the phone feels live on stage.
      rules: { ...config.rules, burstMs: 0, unpromptedCooldownMs: 0 },
      publicUrl: config.publicUrl,
      tts: opts.tts,
      onEvent: opts.onEvent,
      outbox: {
        react: async (_s, ref) => void this.out.push({ t: "react", ref: String(ref) }),
        send: async (_s, text, replyTo) => void this.out.push({ t: "keeper", text, ...(replyTo ? { replyTo: String(replyTo) } : {}) }),
        sendVoice: async (_s, audio, replyTo) =>
          void this.out.push({ t: "voice", audio: audio.toString("base64"), ...(replyTo ? { replyTo: String(replyTo) } : {}) }),
      },
      log: (m) => console.log(`[live] ${m}`),
    });
  }

  /** One message from the web phone. Messages are handled one at a time. */
  say(room: string, who: string, text: string): Promise<{ events: LiveEvent[]; chat: Chat }> {
    const run = this.queue.then(async () => {
      this.out = [];
      const spaceKey = `live:${room}`;
      await this.keeper.receive({ spaceKey, senderKey: `live:${who}`, senderName: who, text, isGroup: true, ref: text });
      await this.keeper.flushAll();
      const chat = this.store.chat(spaceKey);
      chat.title ??= "Live demo chat";
      this.store.save();
      return { events: this.out, chat };
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

// ---------------------------------------------------------------- recorded demo trees
type PublicTree = { code: string; title: string | null; items: Chat["items"] } & Record<string, unknown>;
interface DemoFile {
  grove?: string;
  voice?: boolean;
  chats: { title: string; code?: string; recap: string; events: { t: string; tree?: PublicTree }[] }[];
}

const DEMO_FILE = join(import.meta.dirname, "..", "web", "demo", "demo.json");
let cache: { mtime: number; trees: Map<string, { tree: PublicTree; recap: string; hero: boolean }>; grove?: string } | undefined;

function demo() {
  try {
    const mtime = statSync(DEMO_FILE).mtimeMs;
    if (cache?.mtime === mtime) return cache;
    const d = JSON.parse(readFileSync(DEMO_FILE, "utf8")) as DemoFile;
    const trees = new Map();
    d.chats.forEach((c, i) => {
      const tree = c.events.filter((e) => e.t === "tree").at(-1)?.tree;
      if (tree) trees.set(tree.code, { tree, recap: c.recap, hero: i === 0 && !!d.voice });
    });
    return (cache = { mtime, trees, grove: d.grove });
  } catch {
    return undefined;
  }
}

/** A recorded demo tree or grove, for codes that aren't in the live store. */
export function demoLookup(code: string): { type: "tree" | "grove"; trees: PublicTree[] } | undefined {
  const d = demo();
  if (!d) return undefined;
  const t = d.trees.get(code);
  if (t) return { type: "tree", trees: [t.tree] };
  if (d.grove && code === d.grove) return { type: "grove", trees: [...d.trees.values()].map((x) => x.tree) };
  return undefined;
}

export function demoTree(code: string) {
  const t = demo()?.trees.get(code);
  if (!t) return undefined;
  return {
    tree: t.tree,
    recap: t.recap,
    growth: () => growthFromMemory(t.tree as unknown as Chat),
    mp3: t.hero ? join(import.meta.dirname, "..", "web", "demo", "recap.mp3") : undefined,
  };
}
