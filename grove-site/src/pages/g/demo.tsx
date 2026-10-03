/**
 * /g/demo — the tree fed by the bundled fixture (src/fixtures/demo.json).
 *
 * A STATIC page (outside (app)/): no auth, no WebSocket, no fetch. It must
 * work with sync down or no Wi-Fi. Reveals one item every 2.5s, then Replay.
 */

import { useEffect, useState } from 'react'
import { Seo } from '../../components/Seo'
import { GroveView } from '../../components/grove/GroveView'
import type { Grove, Item } from '../../grove/payload'
import demo from '../../fixtures/demo.json'
import { seo } from '../../seo'

const STEP_MS = 2500
const all = demo.items as Item[]

export default function DemoGrove() {
  const [shown, setShown] = useState(1)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (shown >= all.length) return
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [shown, run])

  const grove: Grove = { title: demo.chat.title, people: demo.people, items: all.slice(0, shown) }
  const done = shown >= all.length

  return (
    <>
      <Seo
        {...seo}
        title="Demo grove | Grovekeeper"
        description="Watch a group chat's plan grow into a glowing tree: ideas as seeds, tasks as leaves, decisions as rings."
        path="/g/demo"
      />
      <GroveView
        key={run}
        grove={grove}
        focusId={all[shown - 1]?.id}
        actions={
          done ? (
            <button
              className="grove-btn"
              onClick={() => {
                setShown(1)
                setRun((r) => r + 1)
              }}
            >
              Replay
            </button>
          ) : (
            <span className="grove-story hidden self-center text-base sm:inline" style={{ color: 'var(--muted)' }} aria-live="polite">
              a seed lands… {shown} of {all.length}
            </span>
          )
        }
      />
    </>
  )
}
