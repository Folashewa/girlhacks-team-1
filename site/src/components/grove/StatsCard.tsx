/** "This grove" totals, plus the privacy note shown under it. */

import type { Grove } from '../../grove/sync-payload'

export function StatsCard({ grove }: { grove: Grove }) {
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

export const PRIVACY_NOTE =
  "Only people in this chat have this link. No messages or phone numbers are stored here, only what the group decided and who's doing what."
