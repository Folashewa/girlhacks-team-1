/** Top bar: home mark, the chat's title and counts, and the Tree / See as list toggle. */

import type { ReactNode } from 'react'
import { counts, groveTitle } from '../../grove/labels'
import type { Grove } from '../../grove/sync-payload'
import { SproutIcon } from './SproutIcon'

interface TopBarProps {
  grove: Grove
  asList: boolean
  onViewChange: (asList: boolean) => void
  /** Extra controls before the toggle (the demo's Replay button). */
  actions?: ReactNode
}

export function TopBar({ grove, asList, onViewChange, actions }: TopBarProps) {
  const empty = grove.items.length === 0
  const toggle = (list: boolean, label: string) => (
    <button
      className={list === asList ? 'grove-btn grove-btn-on' : 'grove-btn'}
      onClick={() => onViewChange(list)}
      aria-pressed={list === asList}
    >
      {label}
    </button>
  )
  return (
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
  )
}
