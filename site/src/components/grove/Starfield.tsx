/** Sparse twinkling stars behind the grove (deterministic, ≤ 40, paused for reduced motion). */

import { hash } from '../../grove/layout'

export function Starfield({ count = 36 }: { count?: number }) {
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
