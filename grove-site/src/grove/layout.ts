/**
 * Deterministic tree layout (docs/IMPLEMENTATION.md §5.4).
 *
 * position = f(person order, item id hash). No randomness, no clock: the
 * same Grove always produces the same picture. Slots are claimed by hash with
 * linear probing in id order, so adding an item rarely moves existing ones.
 *
 * Coordinates are in the SVG viewBox (1000 × 700).
 */

import type { Grove, Item, Person } from './payload'

export const VIEW = { w: 1000, h: 700 } as const
export const PERSON_COLORS = ['#7FF2D0', '#FFB38A', '#C9B4FF', '#8FD3FF', '#F7A8C9', '#B9F28F', '#FFD978', '#A0E7E5']

const TRUNK = { x: 500, base: 650, top: 170 }

export type ShapeKind = 'seed' | 'sprout' | 'bud' | 'leaf' | 'blossom' | 'ring' | 'mist'

export interface Shape {
  item: Item
  shape: ShapeKind
  x: number
  y: number
  color: string
  /** Rotation for leaves, degrees. */
  angle: number
  credited: boolean
  /** Full accessible label ("Taken by Jake: Set up the repo"). */
  label: string
  /** Short on-tree label ("Jake · set up the repo") and where it sits. */
  short: string
  tag: { x: number; y: number; anchor: 'start' | 'end' | 'middle' }
}

export interface Branch {
  person: Person
  color: string
  side: -1 | 1
  path: string
  /** Point on the branch at t ∈ [0, 1]. */
  at: (t: number) => { x: number; y: number; angle: number }
}

export interface LayoutOptions {
  /** Portrait phones: branches reach less far sideways, names sit above tips. */
  narrow?: boolean
}

export interface Layout {
  narrow: boolean
  /** Too many items (or a phone) to label everything: show labels on hover/focus/selection only. */
  busy: boolean
  branches: Branch[]
  shapes: Shape[]
  trunk: { x: number; base: number; top: number }
  /** Tight viewBox around everything drawn, so phones get a bigger tree. */
  bounds: { x: number; y: number; w: number; h: number }
}

/** FNV-1a, 32-bit. Stable across runtimes. */
export function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** "I12" < "I3" as strings; compare numerically when ids share a prefix. */
function byId(a: Item, b: Item): number {
  return a.id.localeCompare(b.id, 'en', { numeric: true })
}

function claimSlots<T extends { id: string }>(items: T[], slots: number): Map<string, number> {
  const taken = new Set<number>()
  const out = new Map<string, number>()
  for (const it of items) {
    if (taken.size >= slots) taken.clear() // overflow: start sharing slots
    let s = hash(it.id) % slots
    while (taken.has(s)) s = (s + 1) % slots
    taken.add(s)
    out.set(it.id, s)
  }
  return out
}

function makeBranch(person: Person, index: number, count: number, hx: number): Branch {
  const side: -1 | 1 = index % 2 === 0 ? -1 : 1
  const level = Math.floor(index / 2)
  const levels = Math.max(1, Math.ceil(count / 2))
  const span = TRUNK.base - 170 - (TRUNK.top + 60) // vertical room for branch roots
  const y0 = TRUNK.base - 170 - (level + 0.5) * (span / levels) + (side === 1 ? 22 : 0)
  const reach = (320 - level * (110 / levels)) * hx
  const p0 = { x: TRUNK.x + side * 10, y: y0 }
  const c = { x: TRUNK.x + side * reach * 0.55, y: y0 - 20 }
  const p1 = { x: TRUNK.x + side * reach, y: y0 - 150 + level * 10 }
  const at = (t: number) => {
    const u = 1 - t
    const x = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x
    const y = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
    const dx = 2 * u * (c.x - p0.x) + 2 * t * (p1.x - c.x)
    const dy = 2 * u * (c.y - p0.y) + 2 * t * (p1.y - c.y)
    return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI }
  }
  return {
    person,
    color: PERSON_COLORS[person.colorIndex % 8],
    side,
    path: `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`,
    at,
  }
}

export function nameOf(people: Person[], key: string | null): string {
  if (!key) return 'someone'
  return people.find((p) => p.personKey === key)?.name ?? 'a member'
}

/** Accessible label, also the tooltip's first line. */
export function describe(item: Item, people: Person[]): string {
  const from = nameOf(people, item.from)
  const owner = nameOf(people, item.owner)
  switch (item.kind) {
    case 'idea':
      return `Idea from ${from}: ${item.text}`
    case 'decision':
      return `Decided: ${item.text}`
    case 'question':
      return item.status === 'done' ? `Answered question from ${from}: ${item.text}` : `Open question from ${from}: ${item.text}`
    default:
      if (!item.owner) return item.status === 'done' ? `Done: ${item.text}` : `Needs someone: ${item.text}`
      return item.status === 'done' ? `Done by ${owner}: ${item.text}` : `Taken by ${owner}: ${item.text}`
  }
}

/** Above this many items, on-tree labels show only for the hovered/selected element. */
export const LABEL_ALL_MAX = 12

const clip = (t: string, n = 30) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** The short label drawn next to an element on the tree. */
export function shortLabel(item: Item, people: Person[]): string {
  const from = nameOf(people, item.from)
  const text = clip(lower(item.text))
  switch (item.kind) {
    case 'idea':
      if (item.status === 'done') return `${from}'s idea, done`
      return item.credited ? `${from}'s seed, credited` : item.discussed ? `${from}'s seed, growing` : `${from}'s seed`
    case 'decision':
      return `decided: ${text}`
    case 'question':
      return clip(item.text)
    default:
      if (!item.owner) return item.status === 'done' ? `done: ${text}` : `still needs someone: ${text}`
      return `${nameOf(people, item.owner)} · ${text}${item.status === 'done' ? ', done' : ''}`
  }
}

function tagFor(s: Omit<Shape, 'tag'>): Shape['tag'] {
  const right = s.x >= TRUNK.x
  switch (s.shape) {
    case 'ring':
      return { x: TRUNK.x + 40, y: s.y + 6, anchor: 'start' }
    case 'mist':
      return { x: s.x, y: s.y + 6, anchor: 'middle' }
    case 'bud':
      return { x: s.x + 22, y: s.y + 2, anchor: 'start' }
    case 'sprout':
      return { x: s.x + (right ? 24 : -24), y: s.y - 30, anchor: right ? 'start' : 'end' }
    default:
      return { x: s.x + (right ? 24 : -24), y: s.y - 14, anchor: right ? 'start' : 'end' }
  }
}

/** Rough rendered width of a label in viewBox units (italic serif, ~19px). */
export const labelWidth = (t: string) => t.length * 8.6

export function counts(items: Item[]): string {
  const work = (i: Item) => i.kind === 'request' || i.kind === 'commitment'
  const taken = items.filter((i) => work(i) && i.owner && i.status === 'open').length
  const needs = items.filter((i) => i.kind === 'request' && !i.owner && i.status === 'open').length
  const ideas = items.filter((i) => i.kind === 'idea').length
  const decided = items.filter((i) => i.kind === 'decision').length
  const done = items.filter((i) => (work(i) || i.kind === 'idea') && i.status === 'done').length
  return `${taken} taken · ${needs} need${needs === 1 ? 's' : ''} someone · ${ideas} idea${ideas === 1 ? '' : 's'} · ${decided} decided · ${done} done`
}

interface RowSpec {
  /** Positions per row along the branch, between t0 and t1. */
  perRow: number
  t0: number
  t1: number
  /** Distance from the branch for the first pair of rows, and per extra pair. */
  base: number
  gap: number
  /** Rows always available (keeps small chats stable as they grow). */
  minRows: number
}

const SEED_ROWS: RowSpec = { perRow: 5, t0: 0.08, t1: 0.36, base: 6, gap: 15, minRows: 1 }
const LEAF_ROWS: RowSpec = { perRow: 9, t0: 0.42, t1: 0.98, base: 15, gap: 22, minRows: 2 }

/**
 * Slots along a branch that grow with the chat: rows alternate above/below
 * the branch and step further out as it fills, so nothing ever stacks.
 */
function branchRows(b: Branch, count: number, r: RowSpec) {
  const rows = Math.max(r.minRows, Math.ceil(count / r.perRow))
  return {
    slots: rows * r.perRow,
    at(slot: number) {
      const row = Math.floor(slot / r.perRow)
      const along = slot % r.perRow
      const stagger = row % 2 === 1 ? 0.5 : 0 // odd rows sit between even rows' items
      const t = r.t0 + ((along + stagger) / r.perRow) * (r.t1 - r.t0)
      const p = b.at(Math.min(1, t))
      const side = row % 2 === 0 ? -1 : 1
      const off = (r.base + Math.floor(row / 2) * r.gap) * side
      const rad = ((p.angle + 90) * Math.PI) / 180
      return { x: p.x + Math.cos(rad) * off, y: p.y + Math.sin(rad) * off, angle: p.angle, side }
    },
  }
}

interface ArcSpec {
  perArc: number
  /** Start angle and span, in multiples of π (π…2π is the upper half). */
  from: number
  span: number
  rx: number
  ry: number
  /** How much each further arc shrinks toward the center (negative grows outward). */
  shrinkX: number
  shrinkY: number
  /** Split each arc into left and right flanks of width `span`, leaving the top clear. */
  flanks?: boolean
}

/** Slots on concentric upper arcs; more items → more (smaller) arcs, never stacking. */
function arcRows(count: number, a: ArcSpec) {
  const arcs = Math.max(1, Math.ceil(count / a.perArc))
  return {
    slots: arcs * a.perArc,
    at(slot: number) {
      const arc = Math.floor(slot / a.perArc)
      const along = (slot % a.perArc) + (arc % 2 === 1 ? 0.5 : 0)
      let ang = Math.PI * (a.from + (along / a.perArc) * a.span)
      if (a.flanks) {
        const half = a.perArc / 2
        const left = slot % a.perArc < half
        const k = (left ? along : along - half) / half
        ang = Math.PI * (left ? a.from + k * a.span : 3 - a.from - k * a.span)
      }
      const rx = Math.max(40, a.rx - arc * a.shrinkX)
      const ry = Math.max(30, a.ry - arc * a.shrinkY)
      return { dx: Math.cos(ang) * rx, dy: Math.sin(ang) * ry }
    },
  }
}

export function layoutGrove(grove: Grove, opts: LayoutOptions = {}): Layout {
  const narrow = !!opts.narrow
  const hx = narrow ? 0.6 : 1
  const { people } = grove
  const items = [...grove.items].sort(byId)
  const branches = people.map((p, i) => makeBranch(p, i, people.length, hx))
  const shapes: Shape[] = []
  const push = (item: Item, s: Omit<Shape, 'item' | 'label' | 'credited' | 'short' | 'tag'>) => {
    const base = { item, credited: item.kind === 'idea' && item.credited, label: describe(item, people), short: shortLabel(item, people), ...s }
    shapes.push({ ...base, tag: tagFor(base) })
  }

  // Ideas: seeds near the base of the planter's branch (credit stays with the planter).
  for (const b of branches) {
    const mine = items.filter((i) => i.kind === 'idea' && i.from === b.person.personKey)
    const place = branchRows(b, mine.length, SEED_ROWS)
    const slots = claimSlots(mine, place.slots)
    for (const it of mine) {
      const p = place.at(slots.get(it.id)!)
      const grown = it.discussed || it.credited
      push(it, { shape: it.status === 'done' ? 'blossom' : grown ? 'sprout' : 'seed', x: p.x, y: p.y, color: b.color, angle: 0 })
    }
  }

  // Taken work: leaves on the owner's branch; done → blossom.
  for (const b of branches) {
    const mine = items.filter(
      (i) => (i.kind === 'request' || i.kind === 'commitment') && (i.owner ?? (i.kind === 'commitment' ? i.from : null)) === b.person.personKey,
    )
    const place = branchRows(b, mine.length, LEAF_ROWS)
    const slots = claimSlots(mine, place.slots)
    for (const it of mine) {
      const p = place.at(slots.get(it.id)!)
      push(it, { shape: it.status === 'done' ? 'blossom' : 'leaf', x: p.x, y: p.y, color: b.color, angle: p.angle + p.side * 40 })
    }
  }

  // Unclaimed requests: buds along the top of the canopy, in arcs that nest inward as they fill.
  const buds = items.filter((i) => i.kind === 'request' && !i.owner)
  const budArcs = arcRows(buds.length, { perArc: 11, from: 1.15, span: 0.7, rx: 190 * hx, ry: 120, shrinkX: 38 * hx, shrinkY: 26 })
  const budSlots = claimSlots(buds, budArcs.slots)
  for (const it of buds) {
    const p = budArcs.at(budSlots.get(it.id)!)
    push(it, {
      shape: it.status === 'done' ? 'blossom' : 'bud',
      x: TRUNK.x + p.dx,
      y: TRUNK.top + 20 + p.dy,
      color: '#F2C86B',
      angle: 0,
    })
  }

  // Decisions: gold rings in the trunk, oldest at the bottom, newest at the top.
  const decisions = items.filter((i) => i.kind === 'decision').sort((a, b) => a.createdAt - b.createdAt || byId(a, b))
  const ringGap = Math.min(30, (TRUNK.base - TRUNK.top - 80) / Math.max(1, decisions.length))
  decisions.forEach((it, i) => {
    push(it, { shape: 'ring', x: TRUNK.x, y: TRUNK.base - 50 - i * ringGap, color: '#F2C86B', angle: 0 })
  })

  // Open questions: purple mist drifting at the canopy's left and right edges.
  const questions = items.filter((i) => i.kind === 'question' && i.status === 'open')
  const mistArcs = arcRows(questions.length, { perArc: 8, from: 1.02, span: 0.3, rx: 340 * hx, ry: 150, shrinkX: -45 * hx, shrinkY: -12, flanks: true })
  const qSlots = claimSlots(questions, mistArcs.slots)
  for (const it of questions) {
    const p = mistArcs.at(qSlots.get(it.id)!)
    push(it, { shape: 'mist', x: TRUNK.x + p.dx, y: TRUNK.top + 70 + p.dy, color: '#8E6CF0', angle: 0 })
  }

  const busy = narrow || items.length > LABEL_ALL_MAX
  return { narrow, busy, branches, shapes, trunk: TRUNK, bounds: boundsOf(branches, shapes, narrow, busy) }
}

function boundsOf(branches: Branch[], shapes: Shape[], narrow: boolean, busy: boolean): Layout['bounds'] {
  const crown = narrow ? 130 : 230
  const xs = [TRUNK.x - crown, TRUNK.x + crown]
  const ys = [TRUNK.top - 90, TRUNK.base + 45]
  for (const b of branches) {
    const end = b.at(1)
    const label = b.person.name.length * 13 // room for the name label
    if (narrow) xs.push(end.x - label / 2 - 6, end.x + label / 2 + 6)
    else xs.push(end.x + b.side * (20 + label))
    ys.push(end.y - (narrow ? 44 : 34))
  }
  for (const s of shapes) {
    const r = s.shape === 'mist' ? 60 : 30
    xs.push(s.x - r, s.x + r)
    ys.push(s.y - r, s.y + r)
    if (!busy) {
      // Room for always-on labels.
      const w = labelWidth(s.short)
      const { x, y, anchor } = s.tag
      xs.push(anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x, anchor === 'start' ? x + w : anchor === 'middle' ? x + w / 2 : x)
      ys.push(y - 20)
    }
  }
  const x = Math.max(0, Math.min(...xs))
  const y = Math.max(0, Math.min(...ys))
  return { x, y, w: Math.min(VIEW.w, Math.max(...xs)) - x, h: Math.min(VIEW.h, Math.max(...ys)) - y }
}
