/** "See as list": the same grove as grouped, accessible lists. */

import { describe } from '../../grove/labels'
import type { Grove, Item } from '../../grove/sync-payload'

const LIST_GROUPS: { title: string; test: (i: Item) => boolean }[] = [
  { title: 'Needs someone', test: (i) => i.kind === 'request' && !i.owner && i.status === 'open' },
  { title: 'Taken', test: (i) => (i.kind === 'request' || i.kind === 'commitment') && i.status === 'open' && !!(i.owner || i.kind === 'commitment') },
  { title: 'Done', test: (i) => (i.kind === 'request' || i.kind === 'commitment' || i.kind === 'idea') && i.status === 'done' },
  { title: 'Ideas', test: (i) => i.kind === 'idea' && i.status === 'open' },
  { title: 'Decided', test: (i) => i.kind === 'decision' },
  { title: 'Questions', test: (i) => i.kind === 'question' },
]

export function ListView({ grove, onSelect, selectedId }: { grove: Grove; onSelect: (i: Item) => void; selectedId: string | null }) {
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
