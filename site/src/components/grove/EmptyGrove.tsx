/** Shown before a chat has anything in its grove: one glowing seed. */

import type { ReactNode } from 'react'

export function EmptyGrove({ hint }: { hint: ReactNode }) {
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
