/** The selected item: kind, text, who, a one-line story, and pills (e.g. "Credited to Priya"). */

import { itemStory } from '../../grove/labels'
import { PERSON_COLORS } from '../../grove/layout'
import type { Grove, Item, Person } from '../../grove/sync-payload'

const colorOf = (people: Person[], key?: string) => {
  const p = key ? people.find((x) => x.personKey === key) : undefined
  return p ? PERSON_COLORS[p.colorIndex % 8] : undefined
}

export function ItemCard({ item, grove, onClose }: { item: Item; grove: Grove; onClose?: () => void }) {
  const s = itemStory(item, grove.people)
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
