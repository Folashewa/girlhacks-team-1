// Read-only data for the tree page, plus meeting upload (ADP), voice recap (ElevenLabs) and the web iMessage simulator.
// Trees are only reachable with their secret code; there is no "list everything" endpoint.
// Never returns phone numbers or raw message text.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import type { Brain } from "./brain.ts";
import { config } from "./config.ts";
import { elevenlabsEnabled, transcribe, tts } from "./elevenlabs.ts";
import { recap } from "./keeper.ts";
import { ingestMeeting, parseTranscript } from "./meeting.ts";
import { type Chat, nameOf, type Store } from "./store.ts";
import { growthFromMemory, type Tiger } from "./tiger.ts";
import { demoLookup, demoTree, LiveChat } from "./live.ts";

const WEB_DIR = join(import.meta.dirname, "..", "web");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
};
const MAX_UPLOAD = 25 * 1024 * 1024;

export function publicChat(chat: Chat) {
  const total = Object.values(chat.people).reduce((s, p) => s + p.words, 0);
  return {
    code: chat.code,
    title: chat.title ?? null,
    people: Object.values(chat.people).map((p) => ({ alias: p.alias, name: p.name ?? null })),
    items: chat.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      text: i.text,
      status: i.status,
      from: nameOf(chat, i.from),
      owner: i.owner ? nameOf(chat, i.owner) : null,
      due: i.due ?? null,
      source: i.source,
      credited: !!i.credited,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    })),
    stats: {
      open: chat.items.filter((i) => i.status === "open").length,
      done: chat.items.filter((i) => i.status === "done").length,
      ideas: chat.items.filter((i) => i.kind === "idea").length,
      credits: chat.items.filter((i) => i.credited).length,
      people: Object.keys(chat.people).length,
      messages: total ? Object.values(chat.people).reduce((s, p) => s + p.messages, 0) : 0,
    },
    quiet: !!chat.quietUntil && chat.quietUntil > Date.now(),
  };
}

export interface ApiDeps {
  store: Store;
  brain: Brain;
  tiger?: Tiger;
}

export function startApi(deps: ApiDeps) {
  const { store, brain } = deps; // deps.tiger may connect later, so it's read per request
  const audioCache = new Map<string, Buffer>();
  const misses = new Map<string, { n: number; reset: number }>();
  const live = new LiveChat(store, brain, { tts, onEvent: (e) => deps.tiger?.record(e) });

  /** Slow down anyone guessing codes: 20 wrong codes per minute per IP. */
  const tooManyMisses = (req: IncomingMessage, miss: boolean) => {
    const ip = String(req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?").split(",")[0]!.trim();
    const now = Date.now();
    let m = misses.get(ip);
    if (!m || m.reset < now) misses.set(ip, (m = { n: 0, reset: now + 60_000 }));
    if (miss) m.n++;
    return m.n > 20;
  };

  const server = createServer(async (req, res) => {
    try {
      cors(req, res);
      if (req.method === "OPTIONS") return end(res, 204);
      const url = new URL(req.url ?? "/", "http://x");
      const path = url.pathname;

      if (req.method === "GET" && path === "/api/health") {
        return json(res, { ok: true, tools: toolStatus(brain, deps.tiger) });
      }

      // A code can be a tree code (one chat) or a personal grove code (every chat you're in).
      let m = path.match(/^\/api\/lookup\/([A-Za-z0-9 -]{4,40})$/);
      if (req.method === "GET" && m) {
        if (tooManyMisses(req, false)) return json(res, { error: "too many tries, wait a minute" }, 429);
        const code = decodeURIComponent(m[1]!);
        const chat = store.chatByCode(code);
        if (chat) return json(res, { type: "tree", trees: [publicChat(chat)] });
        const grove = store.groveByCode(code);
        if (grove) return json(res, { type: "grove", trees: grove.map(publicChat) });
        const recorded = demoLookup(code);
        if (recorded) return json(res, recorded);
        tooManyMisses(req, true);
        return json(res, { error: "No tree with that code. Text \"keeper code\" in your group chat to get it." }, 404);
      }

      m = path.match(/^\/api\/trees\/([A-Za-z0-9-]{4,40})(\/growth|\/recap|\/recap\.mp3)?$/);
      if (req.method === "GET" && m) {
        if (tooManyMisses(req, false)) return json(res, { error: "too many tries, wait a minute" }, 429);
        const chat = store.chatByCode(m[1]!);
        const recorded = chat ? undefined : demoTree(m[1]!);
        if (recorded) {
          if (!m[2]) return json(res, recorded.tree);
          if (m[2] === "/growth") return json(res, recorded.growth());
          if (m[2] === "/recap") return json(res, { text: recorded.recap });
          const audio = recorded.mp3 ? await readFile(recorded.mp3).catch(() => undefined) : undefined;
          if (!audio) return json(res, { error: "no recorded voice", text: recorded.recap }, 503);
          res.writeHead(200, { "content-type": "audio/mpeg", "content-length": audio.length });
          return res.end(audio);
        }
        if (!chat) {
          tooManyMisses(req, true);
          return json(res, { error: "not found" }, 404);
        }
        const sub = m[2];
        if (!sub) return json(res, publicChat(chat));
        if (sub === "/growth") {
          const tiger = deps.tiger;
          const growth = tiger ? await tiger.growth(chat.code).catch(() => growthFromMemory(chat)) : growthFromMemory(chat);
          return json(res, growth);
        }
        const text = recap(chat);
        if (sub === "/recap") return json(res, { text });
        if (!elevenlabsEnabled()) return json(res, { error: "ELEVENLABS_API_KEY not set", text }, 503);
        const key = createHash("sha1").update(text).digest("hex");
        let audio = audioCache.get(key);
        if (!audio) {
          audio = await tts(text);
          if (audio) audioCache.set(key, audio);
        }
        if (!audio) return json(res, { error: "tts failed" }, 502);
        res.writeHead(200, { "content-type": "audio/mpeg", "content-length": audio.length });
        return res.end(audio);
      }

      if (req.method === "POST" && path === "/api/meetings") {
        if (!authorized(req)) return json(res, { error: "unauthorized" }, 401);
        const body = await readBody(req);
        const type = String(req.headers["content-type"] ?? "");
        const title = (url.searchParams.get("title") ?? "Meeting").slice(0, 60);
        let turns;
        if (type.startsWith("audio/") || type.startsWith("video/") || type === "application/octet-stream") {
          turns = await transcribe(body, url.searchParams.get("filename") || "meeting.m4a", type);
        } else {
          const raw = type.includes("json") ? String((JSON.parse(body.toString("utf8")) as { transcript?: string }).transcript ?? "") : body.toString("utf8");
          turns = parseTranscript(raw);
        }
        if (!turns.length) return json(res, { error: "empty transcript" }, 400);
        const out = await ingestMeeting(store, brain, config.rules, title, turns, Date.now, (e) => deps.tiger?.record(e));
        return json(res, out, 201);
      }
      // The web iMessage simulator: the real Keeper and model, on this machine only (or with INGEST_TOKEN).
      if (req.method === "POST" && path === "/api/live") {
        if (!onThisMachine(req) && !(process.env.INGEST_TOKEN && authorized(req))) return json(res, { error: "the live chat only runs on the presenting laptop" }, 403);
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}") as { room?: string; who?: string; text?: string };
        const room = String(body.room ?? "live").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "live";
        const who = String(body.who ?? "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 24);
        const text = String(body.text ?? "").trim().slice(0, 500);
        if (!who || !text) return json(res, { error: "who and text are required" }, 400);
        const out = await live.say(room, who, text);
        return json(res, { events: out.events, tree: publicChat(out.chat) });
      }
      if (req.method === "GET" && !path.startsWith("/api/")) return serveStatic(res, path);
      return json(res, { error: "not found" }, 404);
    } catch (err) {
      console.error("[api]", err);
      return json(res, { error: (err as Error).message }, 500);
    }
  });
  server.listen(config.api.port, config.api.host, () => {
    console.log(`[api] tree page on http://${config.api.host === "0.0.0.0" ? "localhost" : config.api.host}:${config.api.port}`);
  });
  return server;
}

/** Which tools are switched on right now (shown on the website). */
export function toolStatus(brain: Brain, tiger?: Tiger) {
  return {
    photon: true,
    brain: brain.name,
    azure: brain.name.startsWith("azure"),
    elevenlabs: elevenlabsEnabled(),
    tiger: tiger ? (tiger.timescale ? "timescaledb" : "postgres") : false,
  };
}

/** A direct request from this laptop, not through a tunnel or proxy. */
function onThisMachine(req: IncomingMessage) {
  const ip = req.socket.remoteAddress ?? "";
  const proxied = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"];
  return !proxied && (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1");
}

function authorized(req: IncomingMessage) {
  const token = process.env.INGEST_TOKEN;
  return !token || req.headers.authorization === `Bearer ${token}`;
}

function cors(req: IncomingMessage, res: ServerResponse) {
  const allowed = config.api.corsOrigins;
  const origin = req.headers.origin;
  if (allowed.includes("*")) res.setHeader("access-control-allow-origin", "*");
  else if (origin && allowed.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
}

async function serveStatic(res: ServerResponse, path: string) {
  const rel = normalize(path === "/" ? "/index.html" : path).replace(/^(\.\.[/\\])+/, "");
  const file = join(WEB_DIR, rel);
  if (!file.startsWith(WEB_DIR)) return end(res, 403);
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    end(res, 404);
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        reject(new Error("upload too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
function end(res: ServerResponse, status: number) {
  res.writeHead(status);
  res.end();
}
