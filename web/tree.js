// Tree drawing shared by the website (app.js) and the demo stage (demo.js).
// anim: { seen: Set, firstPaint: boolean } makes newly planted items grow in. tip: tooltip element.
export const NS = "http://www.w3.org/2000/svg";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
}
export function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

// One color per person on the tree, from the Enchanted Grove palette.
export const PERSON_COLORS = ["#7FF2D0", "#FFB38A", "#C9B4FF", "#8FD3FF", "#F7A8C9", "#B9F28F", "#FFD978", "#A0E7E5"];

export function drawTree(svg, chat, { compact, anim, tip } = {}) {
  svg.innerHTML = "";
  const uid = compact ? chat.code : "main";
  const defs = el("defs", {}, svg);
  defs.innerHTML = `
    <radialGradient id="gSeed-${uid}"><stop offset="0" stop-color="#fff8e1"/><stop offset=".5" stop-color="#f2c86b"/><stop offset="1" stop-color="#f2c86b" stop-opacity="0"/></radialGradient>
    <radialGradient id="gDone-${uid}"><stop offset="0" stop-color="#fff8e1"/><stop offset=".55" stop-color="#f7e4b0"/><stop offset="1" stop-color="#f7e4b0" stop-opacity="0"/></radialGradient>
    <radialGradient id="gGround-${uid}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f2c86b" stop-opacity=".18"/><stop offset="1" stop-color="#f2c86b" stop-opacity="0"/></radialGradient>
    <radialGradient id="gCanopy-${uid}"><stop offset="0" stop-color="#f2c86b" stop-opacity=".13"/><stop offset=".55" stop-color="#8e6cf0" stop-opacity=".1"/><stop offset="1" stop-color="#8e6cf0" stop-opacity="0"/></radialGradient>
    <linearGradient id="gBark-${uid}" x1="0" x2="1"><stop offset="0" stop-color="#3b2a14"/><stop offset=".5" stop-color="#7a5a26"/><stop offset="1" stop-color="#2a1d0e"/></linearGradient>
    <filter id="soft-${uid}"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="glow-${uid}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1200" height="1100"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  const ref = (n) => `url(#${n}-${uid})`;

  const cx = 400, groundY = 610, trunkTop = 380;
  const items = chat.items;
  el("ellipse", { cx, cy: groundY, rx: 300, ry: 40, fill: ref("gGround") }, svg);
  for (const dx of [-70, -30, 35, 75]) {
    el("path", { d: `M${cx} ${groundY - 10} Q${cx + dx * 0.6} ${groundY} ${cx + dx} ${groundY + 12}`, stroke: ref("gBark"), "stroke-width": 6, fill: "none", "stroke-linecap": "round", opacity: 0.9 }, svg);
  }
  const top = trunkTop - Math.min(items.length, 30) * 2;
  const doneRatio = items.length ? chat.stats.done / items.length : 0;
  el("ellipse", { cx, cy: top - 40, rx: 300, ry: 200, fill: ref("gCanopy"), opacity: 0.6 + doneRatio * 0.4 }, svg);
  el("path", { d: `M${cx - 26} ${groundY} C${cx - 18} ${groundY - 120} ${cx - 14} ${top + 60} ${cx - 8} ${top} L${cx + 8} ${top} C${cx + 14} ${top + 60} ${cx + 18} ${groundY - 120} ${cx + 26} ${groundY} Z`, fill: ref("gBark"), stroke: "#f2c86b", "stroke-opacity": 0.55, "stroke-width": 1.5, filter: ref("glow") }, svg);

  if (!items.length) {
    // a sprout: nothing planted yet
    el("path", { d: `M${cx} ${top} q-30 -40 -60 -30 q30 0 60 30 q30 -40 60 -30 q-30 0 -60 30`, fill: "#7ff2d0", opacity: 0.85, filter: ref("glow") }, svg);
  }

  const byPerson = new Map();
  for (const it of items) {
    const who = it.kind === "commitment" ? it.owner || it.from : it.from;
    if (!byPerson.has(who)) byPerson.set(who, []);
    byPerson.get(who).push(it);
  }
  const people = [...byPerson.keys()].sort();
  const n = people.length;
  people.forEach((who, i) => {
    const mine = byPerson.get(who);
    const color = PERSON_COLORS[i % PERSON_COLORS.length];
    const ang = ((n === 1 ? 0 : -62 + (124 * i) / (n - 1)) * Math.PI) / 180;
    const sx = cx, sy = top + 30 + (i % 2) * 40;
    const L = 150 + Math.min(mine.length, 10) * 10;
    const ex = sx + Math.sin(ang) * L, ey = sy - Math.cos(ang) * L * 0.85;
    const qx = sx + Math.sin(ang) * L * 0.4, qy = sy - Math.cos(ang) * L * 0.6 - 20;
    el("path", { d: `M${sx} ${sy} Q${qx} ${qy} ${ex} ${ey}`, stroke: color, "stroke-opacity": 0.75, "stroke-width": 6, fill: "none", "stroke-linecap": "round", filter: ref("glow") }, svg);
    if (!compact) el("text", { x: ex, y: ey - 22, "text-anchor": "middle", class: "branchLabel", fill: color }, svg).textContent = who;
    mine.forEach((it, j) => {
      const t = 0.3 + (0.68 * (j + 1)) / (mine.length + 1);
      const px = (1 - t) ** 2 * sx + 2 * (1 - t) * t * qx + t * t * ex;
      const py = (1 - t) ** 2 * sy + 2 * (1 - t) * t * qy + t * t * ey;
      const sideSign = j % 2 ? 1 : -1;
      const off = 14 + hash(it.id) * 10;
      const x = px + Math.cos(ang) * off * sideSign;
      const y = py + Math.sin(ang) * off * sideSign;
      el("line", { x1: px, y1: py, x2: x, y2: y, stroke: color, "stroke-opacity": 0.5, "stroke-width": 2 }, svg);
      node(svg, it, x, y, ang + sideSign * 0.8, ref, compact, anim, tip);
    });
  });
  if (!compact && anim) anim.firstPaint = false;
}

function node(svg, it, x, y, rot, ref, compact, anim, tip) {
  const g = el("g", { class: compact ? "" : "node", transform: `translate(${x} ${y})` }, svg);
  const isNew = !compact && anim && !anim.seen.has(it.id) && !anim.firstPaint;
  if (!compact && anim) anim.seen.add(it.id);
  const inner = el("g", { class: isNew ? "node new" : "" }, g);
  const done = it.status === "done";
  if (it.status === "dropped") g.setAttribute("opacity", ".25");
  const deg = (rot * 180) / Math.PI;

  if (it.kind === "commitment") {
    if (done) el("circle", { r: 14, fill: ref("gDone"), class: "glow" }, inner);
    el("ellipse", { rx: 11, ry: 5.5, fill: done ? "#f7e4b0" : "#7ff2d0", filter: ref("glow"), transform: `rotate(${deg})` }, inner);
    el("line", { x1: -9, y1: 0, x2: 9, y2: 0, stroke: "#07060d", "stroke-opacity": 0.35, "stroke-width": 1, transform: `rotate(${deg})` }, inner);
  } else if (it.kind === "decision") {
    if (done) el("circle", { r: 16, fill: ref("gDone"), class: "glow" }, inner);
    for (let k = 0; k < 5; k++) {
      const a = (k * 2 * Math.PI) / 5;
      el("circle", { cx: Math.cos(a) * 6, cy: Math.sin(a) * 6, r: 5, fill: "#f7a8c9", "fill-opacity": 0.92 }, inner);
    }
    el("circle", { r: 3.5, fill: "#f7e4b0" }, inner);
  } else {
    el("circle", { r: it.credited ? 18 : 14, fill: done ? ref("gDone") : ref("gSeed"), class: "glow" }, inner);
    el("circle", { r: 4, fill: "#fff8e1" }, inner);
    if (it.credited) el("circle", { r: 10, fill: "none", stroke: "#f2c86b", "stroke-width": 1.6 }, inner);
  }
  if (compact || !tip) return;

  g.setAttribute("tabindex", "0");
  const showTip = () => {
    const kind = { commitment: "🍃 Commitment", decision: "🌸 Decision", idea: "✨ Idea" }[it.kind];
    const who = it.kind === "commitment" ? `Owner: ${it.owner || it.from}` : `First said by ${it.from}`;
    tip.innerHTML = `<b>${esc(it.text)}</b>${kind} · ${it.status}<br>${esc(who)}${it.due ? `<br>Due: ${esc(it.due)}` : ""}${it.credited ? "<br>✨ credited back to them" : ""}${it.source === "meeting" ? "<br>🎙️ from a meeting" : ""}`;
    tip.hidden = false;
    const box = svg.parentElement.getBoundingClientRect();
    const r = g.getBoundingClientRect();
    tip.style.left = `${Math.max(0, Math.min(r.left - box.left + 16, box.width - 270))}px`;
    tip.style.top = `${r.top - box.top + 16}px`;
  };
  g.addEventListener("mouseenter", showTip);
  g.addEventListener("focus", showTip);
  g.addEventListener("mouseleave", () => (tip.hidden = true));
  g.addEventListener("blur", () => (tip.hidden = true));
}
