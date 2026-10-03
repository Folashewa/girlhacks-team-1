/**
 * The grove as one SVG (viewBox 1000×700). Every element is a focusable
 * button with an aria-label; hover/focus reports it, click selects it.
 * Elements animate in on mount (CSS), so only new items grow on updates.
 */

import type { KeyboardEvent } from 'react'
import { labelWidth, type Layout, type Shape } from '../../grove/layout'
import type { Item } from '../../grove/payload'

interface Props {
  layout: Layout
  onHover: (shape: Shape | null) => void
  onSelect: (item: Item) => void
  hoverId?: string | null
  selectedId?: string | null
}

/** Label position nudged so the whole label stays inside the view (phones crop tightly). */
function fitTag(s: Shape, b: Layout['bounds']): { x: number; y: number; anchor: Shape['tag']['anchor'] } {
  const w = labelWidth(s.short)
  const { x, y, anchor } = s.tag
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
  const lo = b.x + 6
  const hi = b.x + b.w - 6
  const shift = left < lo ? lo - left : left + w > hi ? hi - (left + w) : 0
  return { x: x + shift, y: Math.max(b.y + 20, y), anchor }
}

/** Half the trunk's width at height y (it tapers toward the top). */
function trunkHalf(t: Layout['trunk'], y: number): number {
  const k = (t.base - y) / (t.base - t.top)
  return 30 - 19 * Math.min(1, Math.max(0, k))
}

function Trunk({ t }: { t: Layout['trunk'] }) {
  const b = trunkHalf(t, t.base)
  const top = trunkHalf(t, t.top)
  // A gentle S-curve so it reads as wood, not a pole.
  const d = `M ${t.x - b} ${t.base} C ${t.x - b + 14} ${t.base - 200}, ${t.x - top - 16} ${t.top + 180}, ${t.x - top + 2} ${t.top}
             L ${t.x + top + 2} ${t.top} C ${t.x + top - 6} ${t.top + 180}, ${t.x + b + 10} ${t.base - 200}, ${t.x + b} ${t.base} Z`
  // Crown: twigs splaying from the top of the trunk.
  const twigs = [
    `M ${t.x - 4} ${t.top + 6} Q ${t.x - 40} ${t.top - 30} ${t.x - 92} ${t.top - 52}`,
    `M ${t.x + 4} ${t.top + 6} Q ${t.x + 46} ${t.top - 26} ${t.x + 98} ${t.top - 44}`,
    `M ${t.x} ${t.top + 2} Q ${t.x + 6} ${t.top - 40} ${t.x - 6} ${t.top - 78}`,
    `M ${t.x - 50} ${t.top - 30} Q ${t.x - 64} ${t.top - 62} ${t.x - 58} ${t.top - 86}`,
    `M ${t.x + 52} ${t.top - 26} Q ${t.x + 70} ${t.top - 52} ${t.x + 66} ${t.top - 80}`,
  ]
  return (
    <g>
      {twigs.map((tw, i) => (
        <path key={i} d={tw} stroke="url(#gk-bark)" strokeWidth={i < 3 ? 9 : 5} strokeLinecap="round" fill="none" filter="url(#gk-glow-soft)" />
      ))}
      {/* roots */}
      {[-1, 1].map((s) => (
        <g key={s} stroke="url(#gk-bark)" strokeLinecap="round" fill="none" opacity="0.9">
          <path d={`M ${t.x + s * 18} ${t.base - 6} Q ${t.x + s * 60} ${t.base + 8} ${t.x + s * 120} ${t.base + 22}`} strokeWidth="7" />
          <path d={`M ${t.x + s * 8} ${t.base} Q ${t.x + s * 30} ${t.base + 20} ${t.x + s * 54} ${t.base + 40}`} strokeWidth="5" />
        </g>
      ))}
      <path d={d} fill="url(#gk-bark)" stroke="#F2C86B" strokeOpacity="0.55" strokeWidth="1.5" filter="url(#gk-glow-soft)" />
    </g>
  )
}

function Glyph({ s, t }: { s: Shape; t: Layout['trunk'] }) {
  switch (s.shape) {
    case 'seed':
      return <ellipse className="grove-pulse" rx="7" ry="5" fill={s.color} filter="url(#gk-glow)" />
    case 'sprout':
      return (
        <g filter="url(#gk-glow)">
          <ellipse rx="7" ry="5" fill={s.color} />
          <path d="M 0 -3 C 0 -12, -1 -18, 0 -26" stroke={s.color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 0 -18 C -10 -24, -16 -20, -17 -15 C -10 -13, -4 -14, 0 -18 Z" fill={s.color} />
          <path d="M 0 -24 C 9 -32, 16 -28, 17 -23 C 10 -21, 4 -21, 0 -24 Z" fill={s.color} />
          {s.credited && <circle r="12" fill="none" stroke="#F2C86B" strokeWidth="1.6" />}
        </g>
      )
    case 'bud':
      return (
        <g className="grove-flicker" filter="url(#gk-glow)">
          <path d="M 0 -17 C 11 -8, 11 6, 0 13 C -11 6, -11 -8, 0 -17 Z" fill="rgba(242,200,107,0.16)" stroke="#F2C86B" strokeWidth="2" />
          <path d="M 0 13 L 0 22" stroke="#F2C86B" strokeWidth="2" strokeLinecap="round" />
        </g>
      )
    case 'leaf':
      return (
        <path
          d="M 0 0 C 8 -9, 22 -9, 30 0 C 22 9, 8 9, 0 0 Z"
          transform={`rotate(${s.angle})`}
          fill={s.color}
          fillOpacity="0.9"
          stroke="#fff"
          strokeOpacity="0.25"
          filter="url(#gk-glow)"
        />
      )
    case 'blossom':
      return (
        <g filter="url(#gk-glow)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} rx="6" ry="9" cy="-8" transform={`rotate(${a})`} fill={s.color} fillOpacity="0.92" />
          ))}
          <circle r="4" fill="#F7E4B0" />
        </g>
      )
    case 'ring': {
      const half = trunkHalf(t, s.y) - 3
      return <ellipse rx={half} ry="5" fill="none" stroke="#F2C86B" strokeWidth="2.2" filter="url(#gk-glow)" />
    }
    case 'mist':
      return (
        <g className="grove-drift">
          <ellipse rx="52" ry="20" fill="#8E6CF0" opacity="0.38" filter="url(#gk-blur)" />
          <ellipse rx="26" ry="9" fill="#C9B4FF" opacity="0.35" filter="url(#gk-blur)" />
        </g>
      )
  }
}

const HIT: Record<Shape['shape'], { rx: number; ry: number; cy?: number }> = {
  seed: { rx: 16, ry: 16 },
  sprout: { rx: 18, ry: 22, cy: -10 },
  bud: { rx: 16, ry: 16 },
  leaf: { rx: 20, ry: 20 },
  blossom: { rx: 18, ry: 18 },
  ring: { rx: 26, ry: 11 },
  mist: { rx: 50, ry: 22 },
}

export function TreeSvg({ layout, onHover, onSelect, hoverId = null, selectedId = null }: Props) {
  const { bounds } = layout
  const key = (e: KeyboardEvent, item: Item) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(item)
    }
  }
  // Leaves sit after branches; rings over the trunk; mist on top.
  const order: Shape['shape'][] = ['ring', 'seed', 'sprout', 'leaf', 'blossom', 'bud', 'mist']
  const shapes = [...layout.shapes].sort((a, b) => order.indexOf(a.shape) - order.indexOf(b.shape))

  return (
    <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} className="h-full w-full" role="group" aria-label="The grove">
      <defs>
        <linearGradient id="gk-bark" x1="0" x2="1">
          <stop offset="0" stopColor="#3b2a14" />
          <stop offset="0.5" stopColor="#7a5a26" />
          <stop offset="1" stopColor="#2a1d0e" />
        </linearGradient>
        <filter id="gk-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="gk-glow-soft" x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="gk-blur" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id="gk-ground">
          <stop offset="0" stopColor="#F2C86B" stopOpacity="0.18" />
          <stop offset="1" stopColor="#F2C86B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gk-canopy">
          <stop offset="0" stopColor="#F2C86B" stopOpacity="0.13" />
          <stop offset="0.55" stopColor="#8E6CF0" stopOpacity="0.1" />
          <stop offset="1" stopColor="#8E6CF0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={layout.trunk.x} cy={layout.trunk.top + 150} rx="400" ry="260" fill="url(#gk-canopy)" />

      <ellipse cx="500" cy="660" rx="330" ry="40" fill="url(#gk-ground)" />

      {layout.branches.map((b) => (
        <g key={b.person.personKey}>
          <path d={b.path} stroke={b.color} strokeOpacity="0.75" strokeWidth="6" fill="none" strokeLinecap="round" filter="url(#gk-glow)" />
          {(() => {
            const end = b.at(1)
            return (
              <text
                x={layout.narrow ? end.x : end.x + b.side * 10}
                y={end.y - (layout.narrow ? 16 : 8)}
                textAnchor={layout.narrow ? 'middle' : b.side === 1 ? 'start' : 'end'}
                className="grove-story"
                fontSize="27"
                fill={b.color}
              >
                {b.person.name}
              </text>
            )
          })()}
        </g>
      ))}

      <Trunk t={layout.trunk} />

      {shapes.map((s) => (
        <g
          key={`${s.item.id}:${s.shape}`}
          transform={`translate(${s.x} ${s.y})`}
          className="grove-el"
          tabIndex={0}
          role="button"
          aria-label={s.label}
          onMouseEnter={() => onHover(s)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(s)}
          onBlur={() => onHover(null)}
          onClick={() => onSelect(s.item)}
          onKeyDown={(e) => key(e, s.item)}
        >
          <g className="grove-grow">
            <Glyph s={s} t={layout.trunk} />
          </g>
          {s.item.id === selectedId && (
            <ellipse
              rx={HIT[s.shape].rx + 4}
              ry={HIT[s.shape].ry + 4}
              cy={HIT[s.shape].cy ?? 0}
              fill="none"
              stroke="#F7E4B0"
              strokeWidth="1.4"
              strokeDasharray="3 4"
              opacity="0.9"
            />
          )}
          <ellipse className="grove-hit" rx={HIT[s.shape].rx} ry={HIT[s.shape].ry} cy={HIT[s.shape].cy ?? 0} fill="transparent" stroke="none" />
        </g>
      ))}

      {/* On-tree labels: all of them in small chats; only hovered/selected when busy. */}
      <g aria-hidden="true" pointerEvents="none">
        {shapes
          .filter((s) => !layout.busy || s.item.id === hoverId || s.item.id === selectedId)
          .map((s) => (
            <text
              key={`label:${s.item.id}`}
              {...(({ x, y, anchor }) => ({ x, y, textAnchor: anchor }))(fitTag(s, layout.bounds))}
              className="grove-story grove-label"
              fontSize="19"
              fill={s.item.id === selectedId || s.item.id === hoverId ? '#F7E4B0' : '#ECE6F7'}
              fillOpacity={s.item.id === selectedId || s.item.id === hoverId ? 1 : 0.82}
            >
              {s.short}
            </text>
          ))}
      </g>
    </svg>
  )
}
