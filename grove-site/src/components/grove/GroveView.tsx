/**
 * One chat's grove: top bar (title, counts, Tree / See as list), the tree with
 * on-tree labels, a side panel (selected item + grove stats + privacy note),
 * and a legend. On phones the panel stacks under the tree and tapping an
 * element opens its card as a bottom sheet. Pure presentation — the demo page
 * feeds it the fixture, the live page feeds it the chat's room.
 */

import { useEffect, useState, type ReactNode } from 'react'
import './grove.css'
import { counts, describe, hash, layoutGrove, PERSON_COLORS, type Shape } from '../../grove/layout'
import type { Grove, Item, Person } from '../../grove/payload'
import { groveTitle, newestItem, storyOf } from '../../grove/story'
import { TreeSvg } from './TreeSvg'

export function Stars({ count = 36 }: { count?: number }) {
  return (
    <div className="grove-stars" aria-hidden="true">
      {Array.from({ length: Math.min(40, count) }, (_, i) => {
        const h = hash(`star${i}`)
        return (
          <span
            key={i}
            className="grove-star"
            style={{
              left: `${h % 100}%`,
              top: `${(h >>> 8) % 70}%`,
              animationDelay: `${((h >>> 16) % 40) / 10}s`,
              transform: `scale(${1 + ((h >>> 24) % 3) * 0.4})`,
            }}
          />
        )
      })}
    </div>
  )
}

export function SproutIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 21v-9" />
      <path d="M12 12c0-3.5-2.6-6-6.5-6 0 3.6 2.7 6 6.5 6Z" />
      <path d="M12 10c0-3 2.3-5.3 5.8-5.3 0 3.1-2.4 5.3-5.8 5.3Z" />
    </svg>
  )
}

const colorOf = (people: Person[], key?: string) => {
  const p = key ? people.find((x) => x.personKey === key) : undefined
  return p ? PERSON_COLORS[p.colorIndex % 8] : undefined
}

function ItemCard({ item, grove, onClose }: { item: Item; grove: Grove; onClose?: () => void }) {
  const s = storyOf(item, grove.people)
  return (
    <section className="grove-panel p-6" aria-live="polite" aria-label="Selected item">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--gold)' }}>
          {s.eyebrow}
        </p>
        {onClose && (
          <button className="grove-btn px-3! py-1!" onClick={onClose} aria-label="Close details" autoFocus>
            ✕
          </button>
        )}
      </div>
      <h2 className="grove-story mb-4 text-[1.7rem] leading-snug" style={{ color: 'var(--gold-soft)' }}>
        {item.text}
      </h2>
      <p className="mb-1 font-medium" style={{ color: 'var(--ink)' }}>
        {s.byline}
      </p>
      <p className="grove-muted mb-4 text-sm leading-relaxed">{s.note}</p>
      {s.pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {s.pills.map((p) => {
            const c = colorOf(grove.people, p.personKey)
            return (
              <span
                key={p.text}
                className="rounded-full border px-3 py-1 text-sm"
                style={{ borderColor: c ?? 'rgba(242,200,107,0.45)', color: 'var(--ink)' }}
              >
                {p.text}
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}

function StatsCard({ grove }: { grove: Grove }) {
  const credited = grove.items.filter((i) => i.kind === 'idea' && i.credited).length
  return (
    <section className="grove-panel p-6" aria-label="This grove">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--gold)' }}>
        This grove
      </p>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dd className="text-3xl" style={{ color: 'var(--gold-soft)' }}>
            {grove.items.length}
          </dd>
          <dt className="grove-muted text-sm">things tracked</dt>
        </div>
        <div>
          <dd className="text-3xl" style={{ color: 'var(--gold-soft)' }}>
            {credited}
          </dd>
          <dt className="grove-muted text-sm">{credited === 1 ? 'idea credited' : 'ideas credited'}</dt>
        </div>
      </dl>
    </section>
  )
}

const PRIVACY_NOTE =
  "Only people in this chat have this link. No messages or phone numbers are stored here, only what the group decided and who's doing what."

const LIST_GROUPS: { title: string; test: (i: Item) => boolean }[] = [
  { title: 'Needs someone', test: (i) => i.kind === 'request' && !i.owner && i.status === 'open' },
  { title: 'Taken', test: (i) => (i.kind === 'request' || i.kind === 'commitment') && i.status === 'open' && !!(i.owner || i.kind === 'commitment') },
  { title: 'Done', test: (i) => (i.kind === 'request' || i.kind === 'commitment' || i.kind === 'idea') && i.status === 'done' },
  { title: 'Ideas', test: (i) => i.kind === 'idea' && i.status === 'open' },
  { title: 'Decided', test: (i) => i.kind === 'decision' },
  { title: 'Questions', test: (i) => i.kind === 'question' },
]

function ListView({ grove, onSelect, selectedId }: { grove: Grove; onSelect: (i: Item) => void; selectedId: string | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {LIST_GROUPS.map((g) => {
        const items = grove.items.filter(g.test)
        if (!items.length) return null
        return (
          <section key={g.title} className="grove-panel p-4">
            <h2 className="grove-title mb-3 text-sm">{g.title}</h2>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    className="w-full text-left text-sm leading-snug hover:underline"
                    style={{ color: i.id === selectedId ? 'var(--gold-soft)' : undefined }}
                    onClick={() => onSelect(i)}
                    aria-pressed={i.id === selectedId}
                  >
                    {describe(i, grove.people)}
                    {i.due ? <span className="grove-muted"> · {i.due}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function Legend({ people }: { people: Person[] }) {
  return (
    <footer className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-6 pt-2 text-sm">
      {people.map((p) => (
        <span key={p.personKey} className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PERSON_COLORS[p.colorIndex % 8] }} aria-hidden="true" />
          <span className="grove-muted">{p.name}</span>
        </span>
      ))}
      <span className="grove-muted">seed = idea · bud = needs someone · leaf = taken · blossom = done · ring = decided · mist = undecided</span>
    </footer>
  )
}

function EmptyGrove({ hint }: { hint: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 pt-16 text-center">
      <svg viewBox="-40 -40 80 80" className="mb-6 h-24 w-24" aria-hidden="true">
        <defs>
          <filter id="gk-empty-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ellipse className="grove-pulse" rx="11" ry="8" fill="#F2C86B" filter="url(#gk-empty-glow)" />
      </svg>
      <p className="grove-story max-w-md text-2xl" style={{ color: 'var(--gold-soft)' }}>
        {hint}
      </p>
    </div>
  )
}

/** Media query as state. Server render (prerender) assumes a wide screen; the client adjusts. */
function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatch(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return match
}

interface GroveViewProps {
  grove: Grove
  /** Item the card shows until someone picks one (the demo passes the newest seed). */
  focusId?: string | null
  /** Extra controls in the top bar (the demo's Replay button). */
  actions?: ReactNode
  emptyHint?: ReactNode
}

export function GroveView({ grove, focusId, actions, emptyHint }: GroveViewProps) {
  const [hover, setHover] = useState<Shape | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [asList, setAsList] = useState(false)
  // narrow: no side panel (card opens as a sheet). phone: compact tree layout.
  const narrow = useMedia('(max-width: 1023px)')
  const phone = useMedia('(max-width: 640px)')

  const picked = grove.items.find((i) => i.id === pickedId) ?? null
  const focus = grove.items.find((i) => i.id === focusId) ?? null
  const shown = picked ?? focus ?? newestItem(grove.items)
  const empty = grove.items.length === 0
  const layout = layoutGrove(grove, { narrow: phone })
  const { bounds } = layout

  const select = (i: Item) => {
    setPickedId(i.id)
    if (narrow) setSheetOpen(true)
  }

  const toggle = (list: boolean, label: string) => (
    <button
      className={list === asList ? 'grove-btn grove-btn-on' : 'grove-btn'}
      onClick={() => setAsList(list)}
      aria-pressed={list === asList}
    >
      {label}
    </button>
  )

  return (
    <div className="grove flex flex-col">
      <Stars />
      <header
        className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-3 border-b px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]"
        style={{ borderColor: 'rgba(242,200,107,0.12)' }}
      >
        <a href="/" className="w-fit shrink-0" aria-label="Grovekeeper home" style={{ color: 'var(--gold)' }}>
          <SproutIcon className="h-6 w-6" />
        </a>
        <div className="min-w-0 flex-1 lg:text-center">
          <h1 className="grove-title text-lg leading-tight sm:text-2xl">{groveTitle(grove)}</h1>
          {!empty && <p className="grove-muted mt-1 text-xs sm:text-sm">{counts(grove.items)}</p>}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto lg:justify-end">
          {actions}
          {!empty && (
            <>
              {toggle(false, 'Tree')}
              {toggle(true, 'See as list')}
            </>
          )}
        </div>
      </header>

      {empty ? (
        <main className="relative z-10 flex-1">
          <EmptyGrove hint={emptyHint ?? <>Your grove is waiting for its first seed. Say &lsquo;keeper help&rsquo; in the chat.</>} />
        </main>
      ) : (
        <main className="relative z-10 grid flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6">
          <div className="min-w-0">
            {asList ? (
              <ListView grove={grove} onSelect={select} selectedId={shown?.id ?? null} />
            ) : (
              <div
                className="grove-sway relative mx-auto"
                style={{ aspectRatio: `${bounds.w} / ${bounds.h}`, width: `min(100%, calc((100dvh - 200px) * ${bounds.w / bounds.h}))` }}
              >
                <TreeSvg
                  layout={layout}
                  onHover={setHover}
                  onSelect={select}
                  hoverId={hover?.item.id ?? null}
                  selectedId={shown?.id ?? null}
                />
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            {!narrow && shown && <ItemCard item={shown} grove={grove} />}
            <StatsCard grove={grove} />
            <p className="grove-muted px-1 text-sm leading-relaxed">{PRIVACY_NOTE}</p>
          </aside>
        </main>
      )}

      {!empty && <Legend people={grove.people} />}

      {narrow && sheetOpen && picked && (
        <div className="grove-sheet" role="dialog" aria-label="Item details">
          <ItemCard item={picked} grove={grove} onClose={() => setSheetOpen(false)} />
        </div>
      )}
    </div>
  )
}
