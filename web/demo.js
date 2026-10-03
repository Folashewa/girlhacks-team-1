// Demo stage: plays the recording made by `npm run demo:build` (web/demo/demo.json). Works offline.
//   /demo.html          presenter mode: → next act, ← back, space pause, R restart
//   /demo.html?auto=1   video mode: plays every act in a row
//   /demo.html?act=2    start at an act
//   /demo.html?token=…  lets "Try it live" work through a tunnel (the INGEST_TOKEN from .env)
import { drawTree, esc, hash } from "./tree.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const AUTO = params.has("auto");
const data = await (await fetch("demo/demo.json", { cache: "no-store" })).json();
const hero = data.chats[0];
const finalTree = (c) => c.events.filter((e) => e.t === "tree").at(-1).tree;

const BUBBLE_COLORS = ["#7FF2D0", "#FFB38A", "#C9B4FF", "#8FD3FF", "#F7A8C9", "#B9F28F", "#FFD978", "#A0E7E5"];
const STOP = Symbol("stop");
const S = { act: 0, run: 0, paused: false, speed: 1 };

// ---------------------------------------------------------------- timing (pause, speed, cancel)
async function wait(ms) {
  const token = S.run;
  let t = 0;
  while (t < ms) {
    await new Promise((r) => setTimeout(r, 40));
    if (token !== S.run) throw STOP;
    if (!S.paused) t += 40 * S.speed;
  }
}
function caption(text) {
  $("caption").textContent = text;
}

// ---------------------------------------------------------------- acts
const ACTS = [actTitle, actMess, actKeeper, actGrove, actLive];
function goAct(n) {
  n = Math.max(0, Math.min(ACTS.length - 1, n));
  S.act = n;
  S.run++;
  S.paused = false;
  $("playBtn").textContent = "⏸";
  $("recapAudio").pause();
  for (const b of $("acts").querySelectorAll("button")) b.setAttribute("aria-current", String(Number(b.dataset.act) === n));
  $("act0").hidden = n !== 0;
  $("actChat").hidden = n !== 1 && n !== 2 && n !== 4;
  $("composer").hidden = n !== 4;
  $("liveTools").hidden = n !== 4;
  $("act3").hidden = n !== 3;
  ACTS[n]()
    .then(async () => {
      if (AUTO && n < ACTS.length - 1) {
        await wait(2500);
        goAct(n + 1);
      }
    })
    .catch((e) => {
      if (e !== STOP) console.error(e);
    });
}

async function actTitle() {
  caption("");
  if (AUTO) await wait(4000);
}

// Act 1: the chat as it really goes. Nobody's tracking anything.
async function actMess() {
  resetPhone();
  $("lostSide").hidden = false;
  $("treeSide").hidden = true;
  $("lostList").innerHTML = "";
  $("lostSum").hidden = true;
  caption("A real group project chat. Tasks, meeting times and ideas fly by between memes.");
  let n = 0;
  for (const e of hero.events) {
    if (e.t === "msg" && !e.keeperOnly) {
      await message(e, 650, 900);
      n++;
    } else if (e.t === "lost") {
      await wait(250);
      const target = e.ref ? [...$("msgs").querySelectorAll(".bubble")].reverse().find((b) => b.dataset.text.includes(e.ref)) : lastBubble();
      target?.classList.add("lost");
      const card = document.createElement("div");
      card.className = "lostCard";
      card.innerHTML = `<span>⚠️</span>${esc(e.text)}`;
      $("lostList").append(card);
      await wait(900);
    } else if (e.t === "wait") {
      await divider(e.min);
    }
  }
  const t = finalTree(hero);
  const tasks = t.items.filter((i) => i.kind === "commitment").length;
  $("lostSum").textContent = `${n} messages. ${tasks} tasks, a meeting time and a stolen idea, all buried. And everyone's still lost.`;
  $("lostSum").hidden = false;
  caption("Sound familiar? Now let's add Keeper to the same chat.");
  await wait(3500);
}

// Act 2: the same chat, with Keeper in it. The tree grows as Keeper remembers.
async function actKeeper() {
  resetPhone();
  $("lostSide").hidden = true;
  $("treeSide").hidden = false;
  $("treeHead").textContent = `${hero.title} · tree`;
  const anim = { seen: new Set(), firstPaint: true };
  paintTree({ ...finalTree(hero), items: [] }, anim);
  caption("Same chat. Keeper is in it now, quietly listening.");
  let lastMsg = "";
  let firstTap = true;
  for (const e of hero.events) {
    if (e.t === "msg") {
      await message(e, e.keeperOnly ? 900 : 550, 800);
      lastMsg = e.text;
      if (e.keeperOnly) caption(/recap/i.test(e.text) ? "Ask for a recap: Keeper sends a voice note." : "Anyone can ask Keeper what's still open.");
    } else if (e.t === "react") {
      await wait(250);
      tapback(e.ref);
      if (firstTap) caption("👍 means Keeper remembered something. No extra messages, no spam.");
      firstTap = false;
    } else if (e.t === "keeper") {
      if (/builds on/i.test(e.text)) caption("Jake just restated Dana's idea. Keeper credits Dana, and never calls Jake out.");
      if (/tree code/i.test(e.text)) caption("Every chat gets a secret tree code. Tap the link to open the tree.");
      if (/recap/i.test(lastMsg) && data.voice) await voiceNote(e.text);
      else await keeperSays(e.text, e.replyTo);
    } else if (e.t === "tree") {
      S.tree = e.tree;
      const before = anim.seen.size;
      const done = e.tree.items.some((i) => i.status === "done" && i.kind === "commitment");
      paintTree(e.tree, anim);
      if (anim.seen.size > before) await wait(500);
      if (done && /done/i.test(lastMsg)) caption("Leo's task is done, so it turns gold on the tree.");
    } else if (e.t === "wait") {
      await divider(e.min);
    }
  }
  caption("Every person is a branch. Leaves are tasks, flowers are decisions, glowing seeds are ideas.");
  await wait(4000);
}

// Act 3: one person, three group chats, one grove.
async function actGrove() {
  const trees = data.chats.map(finalTree);
  $("groveLink").hidden = true;
  $("groveLinkRow").classList.remove("on");
  const box = $("groveTrees");
  box.innerHTML = "";
  $("closing").classList.remove("on");
  const total = trees.reduce((s, t) => s + t.items.length, 0);
  $("groveSub").textContent = `${trees.length} group chats · ${total} things remembered · nothing lost`;
  caption("Priya is in three group chats. Her trees grow together into one grove.");
  for (const [i, t] of trees.entries()) {
    const b = document.createElement("div");
    b.className = "groveTree";
    b.style.order = String(i === 0 ? 0 : i === 1 ? -1 : 1);
    b.style.width = `${Math.round(330 * (0.85 + Math.min(t.items.length, 20) / 25))}px`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "130 130 540 520");
    b.append(svg);
    b.insertAdjacentHTML("beforeend", `<b>${esc(data.chats[i].title)}</b><span>${t.stats.open} open · ${t.stats.done} done · ${t.stats.people} people</span>`);
    box.append(b);
    drawTree(svg, t, { compact: true });
    await wait(900);
  }
  await wait(1200);
  $("closing").classList.add("on");
  if (data.grove) {
    $("groveLink").href = `${location.origin}/?code=${encodeURIComponent(data.grove)}`;
    $("groveLink").hidden = false;
    $("groveLinkRow").classList.add("on");
  }
  caption("Keeper: Photon iMessage · Azure OpenAI · ElevenLabs · Tiger Data");
}

// Act 4: the web phone is the iMessage group. Type as anyone; the real Keeper answers.
const LIVE_PEOPLE = ["Priya", "Jake", "Dana", "Maya", "Leo"];
const SUGGEST = [
  ["Jake", "I'll make the poster by Friday"],
  ["Dana", "what if we add a dark mode?"],
  ["Maya", "ok let's present on Tuesday at 3"],
  ["Leo", "we should totally add a dark mode"],
  ["Priya", "keeper what's still open?"],
  ["Jake", "poster is done!"],
  ["Priya", "keeper code"],
  ["Priya", "keeper recap voice"],
];
const live = { who: "Priya", anim: { seen: new Set(), firstPaint: true }, busy: false };
const LIVE_KEY = "keeper-demo-live-code";

async function actLive() {
  resetPhone({ title: "Live demo chat 💬", people: LIVE_PEOPLE });
  $("lostSide").hidden = true;
  $("treeSide").hidden = false;
  $("treeHead").textContent = "Live demo chat · tree";
  $("senders").innerHTML = LIVE_PEOPLE.map((p) => `<button type="button" role="radio" style="color:${colorFor(p)}" data-who="${esc(p)}">${esc(p)}</button>`).join("");
  pickSender(live.who);
  $("suggest").innerHTML = SUGGEST.map(([w, t], i) => `<button type="button" data-i="${i}">${esc(w)}: ${esc(t)}</button>`).join("");
  caption("Your turn: type as anyone in the group. This is the real Keeper and the real AI, live.");
  live.anim = { seen: new Set(), firstPaint: true };
  let tree = null;
  try {
    const code = localStorage.getItem(LIVE_KEY);
    if (code) tree = await (await fetch(`/api/trees/${code}`)).json();
  } catch {}
  paintLive(tree?.items ? tree : null);
  $("msgs").insertAdjacentHTML("beforeend", `<div class="bubble system">Keeper was added to the group</div>`);
  $("liveInput").focus();
}
function pickSender(who) {
  live.who = who;
  for (const b of $("senders").querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.who === who));
}
function paintLive(tree) {
  S.tree = tree;
  paintTree(tree ?? { code: "", title: null, items: [], stats: { open: 0, done: 0, ideas: 0, credits: 0 } }, live.anim);
  $("openTree").hidden = !tree;
  if (tree) {
    $("openTree").href = `${location.origin}/?code=${encodeURIComponent(tree.code)}`;
    try {
      localStorage.setItem(LIVE_KEY, tree.code);
    } catch {}
  }
}
async function sendLive(text) {
  text = text.trim();
  if (!text || live.busy) return;
  live.busy = true;
  const who = live.who;
  if (lastWho !== `me:${who}`) $("msgs").insertAdjacentHTML("beforeend", `<div class="who me" style="color:${colorFor(who)}">${esc(who)}</div>`);
  lastWho = `me:${who}`;
  const b = document.createElement("div");
  b.className = "bubble me";
  b.dataset.text = text;
  b.textContent = text;
  $("msgs").append(b);
  scrollDown();
  $("liveInput").value = "";
  const isCommand = /^keeper\b/i.test(text);
  if (isCommand) $("typing").hidden = false;
  try {
    const res = await fetch("/api/live", { method: "POST", headers: { "content-type": "application/json", ...(params.get("token") ? { authorization: `Bearer ${params.get("token")}` } : {}) }, body: JSON.stringify({ room: "live", who, text }) });
    const out = await res.json();
    $("typing").hidden = true;
    if (!res.ok) throw new Error(out.error || `error ${res.status}`);
    for (const e of out.events) {
      if (e.t === "react") {
        const m = [...$("msgs").querySelectorAll(".bubble.me")].reverse().find((x) => x.dataset.text === e.ref);
        if (m && !m.querySelector(".tap")) m.insertAdjacentHTML("beforeend", `<span class="tap" aria-label="Keeper liked this">👍</span>`);
      } else if (e.t === "keeper") {
        $("typing").hidden = false;
        await new Promise((r) => setTimeout(r, 600));
        $("typing").hidden = true;
        keeperBubble(e.text, e.replyTo, out.tree);
      } else if (e.t === "voice") {
        liveVoice(e.audio);
      }
    }
    if (/forget everything/i.test(text)) {
      live.anim = { seen: new Set(), firstPaint: true };
      try {
        localStorage.removeItem(LIVE_KEY);
      } catch {}
      paintLive(null);
    } else paintLive(out.tree);
  } catch (err) {
    $("typing").hidden = true;
    $("msgs").insertAdjacentHTML("beforeend", `<div class="bubble system">${esc(err.message)}</div>`);
    scrollDown();
  } finally {
    live.busy = false;
  }
}
function liveVoice(base64) {
  if (lastWho !== "Keeper") $("msgs").insertAdjacentHTML("beforeend", `<div class="who" style="color:var(--gold)">🌱 Keeper</div>`);
  lastWho = "Keeper";
  const b = document.createElement("div");
  b.className = "bubble keeper voice";
  const bars = Array.from({ length: 22 }, (_, i) => `<i style="height:${4 + Math.round(hash(`bar${i}`) * 14)}px;animation-delay:${(i % 5) * 0.1}s"></i>`).join("");
  b.innerHTML = `<span>▶︎</span><span class="bars">${bars}</span><span>Voice recap</span>`;
  $("msgs").append(b);
  scrollDown();
  const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
  audio.onplay = () => b.classList.add("playing");
  audio.onended = audio.onpause = () => b.classList.remove("playing");
  b.addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
  audio.play().catch(() => {});
}
$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  sendLive($("liveInput").value);
});
$("senders").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) pickSender(b.dataset.who);
});
$("suggest").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const [who, text] = SUGGEST[Number(b.dataset.i)];
  pickSender(who);
  sendLive(text);
});
$("resetLive").addEventListener("click", () => {
  pickSender("Priya");
  sendLive("keeper forget everything");
});

// ---------------------------------------------------------------- phone
const colors = new Map();
function colorFor(name) {
  if (!colors.has(name)) colors.set(name, BUBBLE_COLORS[colors.size % BUBBLE_COLORS.length]);
  return colors.get(name);
}
function resetPhone({ title = hero.title, people = [...new Set(hero.events.filter((e) => e.t === "msg").map((e) => e.who))] } = {}) {
  $("msgs").innerHTML = "";
  $("typing").hidden = true;
  lastWho = "";
  S.tree = null;
  $("chatTitle").textContent = title;
  $("chatSub").textContent = `${people.length} people`;
  $("avatars").innerHTML = people.map((p) => `<i style="background:${colorFor(p)}">${esc(p[0])}</i>`).join("");
}
function scrollDown() {
  $("msgs").scrollTop = $("msgs").scrollHeight;
}
let lastWho = "";
async function message(e, typingMs, afterMs) {
  $("typing").hidden = false;
  await wait(typingMs);
  $("typing").hidden = true;
  if (e.who !== lastWho || !$("msgs").lastElementChild?.classList.contains("bubble")) {
    $("msgs").insertAdjacentHTML("beforeend", `<div class="who" style="color:${colorFor(e.who)}">${esc(e.who)}</div>`);
  }
  lastWho = e.who;
  const b = document.createElement("div");
  b.className = "bubble";
  b.dataset.text = e.text;
  b.textContent = e.text;
  $("msgs").append(b);
  scrollDown();
  await wait(afterMs);
}
function lastBubble() {
  const all = $("msgs").querySelectorAll(".bubble:not(.keeper)");
  return all[all.length - 1];
}
function tapback(ref) {
  const match = [...$("msgs").querySelectorAll(".bubble:not(.keeper)")].reverse().find((b) => b.dataset.text === ref);
  if (!match || match.querySelector(".tap")) return;
  match.insertAdjacentHTML("beforeend", `<span class="tap" aria-label="Keeper liked this">👍</span>`);
}
async function keeperSays(text, replyTo) {
  $("typing").hidden = false;
  await wait(900);
  $("typing").hidden = true;
  keeperBubble(text, replyTo, S.tree);
  await wait(Math.min(5000, 1800 + text.length * 18));
}

/** A Keeper message. Links to a tree or grove become a tappable preview card, like an iMessage rich link. */
function keeperBubble(text, replyTo, tree) {
  if (lastWho !== "Keeper") $("msgs").insertAdjacentHTML("beforeend", `<div class="who" style="color:var(--gold)">🌱 Keeper</div>`);
  lastWho = "Keeper";
  const b = document.createElement("div");
  b.className = "bubble keeper";
  const link = text.match(/https?:\/\/\S+/);
  const body = link ? text.replace(link[0], "").trim() : text;
  b.innerHTML = `${replyTo ? `<span class="quote">${esc(replyTo)}</span>` : ""}${esc(body)}`;
  if (link) {
    // Open the tree on this same site, whatever address it's being shown from (laptop, tunnel, domain).
    const code = new URL(link[0]).searchParams.get("code");
    const href = code ? `${location.origin}/?code=${encodeURIComponent(code)}` : link[0];
    const a = document.createElement("a");
    a.className = "linkCard";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    const img = document.createElement("div");
    img.className = "lcImg";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "130 130 540 520");
    img.append(svg);
    const title = tree?.code === code ? tree.title || "Your tree" : code?.startsWith("GROVE") ? "Your grove" : "Your tree";
    a.append(img);
    a.insertAdjacentHTML("beforeend", `<div class="lcMeta"><b>${esc(title)} · Keeper Grove</b><span>${esc(location.host)} · tap to open</span></div>`);
    b.classList.add("hasLink");
    b.append(a);
    if (tree?.code === code) drawTree(svg, tree, { compact: true });
  }
  $("msgs").append(b);
  scrollDown();
  return b;
}
async function voiceNote(text) {
  $("typing").hidden = false;
  await wait(900);
  $("typing").hidden = true;
  lastWho = "Keeper";
  $("msgs").insertAdjacentHTML("beforeend", `<div class="who" style="color:var(--gold)">🌱 Keeper</div>`);
  const b = document.createElement("div");
  b.className = "bubble keeper voice";
  const bars = Array.from({ length: 22 }, (_, i) => `<i style="height:${4 + Math.round(hash(`bar${i}`) * 14)}px;animation-delay:${(i % 5) * 0.1}s"></i>`).join("");
  b.innerHTML = `<span>▶︎</span><span class="bars">${bars}</span><span>Voice recap</span>`;
  b.title = text;
  $("msgs").append(b);
  scrollDown();
  const audio = $("recapAudio");
  const play = () => {
    audio.currentTime = 0;
    audio.play().then(() => b.classList.add("playing")).catch(() => {});
  };
  audio.onended = audio.onpause = () => b.classList.remove("playing");
  b.addEventListener("click", () => (audio.paused ? play() : audio.pause()));
  play();
  await wait(1200);
  // also show the words, for the room and for captions
  const t = document.createElement("div");
  t.className = "bubble keeper";
  t.textContent = text;
  $("msgs").append(t);
  scrollDown();
  const ms = Number.isFinite(audio.duration) ? audio.duration * 1000 : 15000;
  await wait(Math.min(ms, 30000));
}
async function divider(min) {
  const label = min >= 60 ? `${Math.floor(min / 60)} hr${min % 60 ? ` ${min % 60} min` : ""} later` : `${min} min later`;
  $("msgs").insertAdjacentHTML("beforeend", `<div class="divider">${label}</div>`);
  lastWho = "";
  scrollDown();
  await wait(1100);
}

// ---------------------------------------------------------------- tree side
function paintTree(tree, anim) {
  drawTree($("tree"), tree, { compact: false, anim, tip: $("tooltip") });
  const s = tree.stats;
  $("stats").innerHTML = [
    [s.open, "open"],
    [s.done, "done"],
    [s.ideas, "ideas"],
    [s.credits, "credited"],
  ]
    .map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
    .join("");
  const list = (kind, title) => {
    const xs = tree.items.filter((i) => i.kind === kind && i.status !== "dropped");
    if (!xs.length) return "";
    return `<h3>${title}</h3><ul>${xs
      .map((i) => {
        const meta = kind === "commitment" ? `${i.owner || i.from}${i.due ? ` · ${i.due}` : ""}` : i.from;
        return `<li class="${i.status}">${esc(i.text)}${i.credited ? '<span class="badge">credited</span>' : ""}<span class="meta">${esc(meta)}</span></li>`;
      })
      .join("")}</ul>`;
  };
  $("lists").innerHTML =
    list("commitment", "🍃 Who's doing what") + list("decision", "🌸 Decided") + list("idea", "✨ Ideas") ||
    '<p class="muted">Nothing yet. Keeper is listening quietly.</p>';
}

// ---------------------------------------------------------------- controls
$("acts").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) goAct(Number(b.dataset.act));
});
function togglePause() {
  S.paused = !S.paused;
  $("playBtn").textContent = S.paused ? "▶︎" : "⏸";
  const a = $("recapAudio");
  if (S.paused) a.pause();
}
$("playBtn").addEventListener("click", togglePause);
$("restartBtn").addEventListener("click", () => goAct(S.act));
$("speed").addEventListener("change", (e) => (S.speed = Number(e.target.value)));
addEventListener("keydown", (e) => {
  if (e.target.closest?.("select, input, textarea")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown") goAct(S.act + 1);
  else if (e.key === "ArrowLeft" || e.key === "PageUp") goAct(S.act - 1);
  else if (e.key === " ") {
    e.preventDefault();
    togglePause();
  } else if (e.key.toLowerCase() === "r") goAct(S.act);
  else return;
});

// ---------------------------------------------------------------- stars
for (let i = 0; i < 36; i++) {
  const h = hash(`star${i}`), k = hash(`twinkle${i}`);
  const s = document.createElement("span");
  s.className = "star";
  s.style.left = `${h * 100}%`;
  s.style.top = `${k * 70}%`;
  s.style.animationDelay = `${(h * 40) % 4}s`;
  $("stars").append(s);
}

goAct(Number(params.get("act")) || 0);
