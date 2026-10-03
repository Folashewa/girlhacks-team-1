/** Who's who (color dots) and what each shape means. */

import { PERSON_COLORS } from '../../grove/layout'
import type { Person } from '../../grove/sync-payload'

export function Legend({ people }: { people: Person[] }) {
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
