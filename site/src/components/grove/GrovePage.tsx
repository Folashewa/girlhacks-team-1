/**
 * One chat's grove page: top bar, the tree (or list), a side panel with the
 * selected item, totals and privacy note, and a legend. On phones the panel
 * stacks under the tree and tapping an element opens its card as a bottom
 * sheet. Pure presentation: /g/demo feeds it the fixture, /g/:treeKey the
 * chat's live room.
 */

import { useState, type ReactNode } from 'react'
import './grove.css'
import { newestItem } from '../../grove/labels'
import { layoutGrove, type Shape } from '../../grove/layout'
import type { Grove, Item } from '../../grove/sync-payload'
import { EmptyGrove } from './EmptyGrove'
import { ItemCard } from './ItemCard'
import { Legend } from './Legend'
import { ListView } from './ListView'
import { Starfield } from './Starfield'
import { PRIVACY_NOTE, StatsCard } from './StatsCard'
import { TopBar } from './TopBar'
import { TreeDrawing } from './TreeDrawing'
import { useMedia } from './useMedia'

interface GrovePageProps {
  grove: Grove
  /** Item the card shows until someone picks one (the demo passes the newest seed). */
  focusId?: string | null
  /** Extra controls in the top bar (the demo's Replay button). */
  actions?: ReactNode
  emptyHint?: ReactNode
}

export function GrovePage({ grove, focusId, actions, emptyHint }: GrovePageProps) {
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

  return (
    <div className="grove flex flex-col">
      <Starfield />
      <TopBar grove={grove} asList={asList} onViewChange={setAsList} actions={actions} />

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
                <TreeDrawing
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
