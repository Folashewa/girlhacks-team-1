/**
 * Landing page — STATIC (no providers, prerendered at build).
 * Night-forest hero, the pitch, how to add Grovekeeper, and the demo button.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { TreeSvg } from '../components/grove/TreeSvg'
import { Stars } from '../components/grove/GroveView'
import '../components/grove/grove.css'
import demo from '../fixtures/demo.json'
import { layoutGrove } from '../grove/layout'
import type { Item } from '../grove/payload'
import { KEEPER_CONTACT } from '../grove/site'
import { seo } from '../seo'

const hero = layoutGrove({ title: demo.chat.title, people: demo.people, items: demo.items as Item[] })

const LEGEND: [string, string][] = [
  ['Seed', 'an idea, glowing in the color of whoever said it first'],
  ['Sprout', 'that idea got picked up — still credited to its planter'],
  ['Leaf', 'someone took a task'],
  ['Blossom', 'it got done'],
  ['Gold bud', 'something nobody has taken yet'],
  ['Ring in the trunk', 'a decision the group made'],
  ['Purple mist', 'a question still hanging in the air'],
]

const noop = () => {}

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="grove">
        <Stars />
        <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-14 text-center">
          <p className="grove-title mb-4 text-sm">Grovekeeper</p>
          <h1 className="grove-story mb-5 max-w-3xl text-4xl leading-tight sm:text-6xl" style={{ color: 'var(--gold-soft)' }}>
            Every group chat is a grove.
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: 'var(--ink)' }}>
            Ideas are seeds, and seeds get trampled. Grovekeeper lives in your iMessage group, quietly keeps track of
            who&rsquo;s doing what, and makes sure every seed is remembered &mdash; and remembered as yours.
          </p>
          <div className="mb-4 flex flex-wrap justify-center gap-3">
            <Link to="/g/demo" className="grove-btn px-6! py-3! text-base!">
              See a grove grow
            </Link>
          </div>
          <p className="grove-muted max-w-md text-sm">
            {KEEPER_CONTACT ? (
              <>
                Add Grovekeeper to your group chat: text <strong style={{ color: 'var(--gold-soft)' }}>{KEEPER_CONTACT}</strong>
              </>
            ) : (
              <>Add Grovekeeper to your group chat, then say &lsquo;keeper tree&rsquo; to get your grove&rsquo;s link.</>
            )}
          </p>
        </section>

        <div className="relative z-0 mx-auto -mt-2 w-full max-w-4xl px-2" aria-hidden="true" inert>
          <div className="grove-sway pointer-events-none" style={{ aspectRatio: `${hero.bounds.w} / ${hero.bounds.h}` }}>
            <TreeSvg layout={hero} onHover={noop} onSelect={noop} />
          </div>
        </div>

        <section className="relative z-10 mx-auto max-w-3xl px-4 pb-20">
          <h2 className="grove-title mb-5 text-center text-lg">How to read a grove</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {LEGEND.map(([name, what]) => (
              <li key={name} className="grove-panel px-4 py-3 text-sm">
                <span className="grove-story text-lg" style={{ color: 'var(--gold-soft)' }}>
                  {name}
                </span>{' '}
                <span className="grove-muted">&mdash; {what}</span>
              </li>
            ))}
          </ul>
          <p className="grove-muted mt-8 text-center text-xs leading-relaxed">
            Each chat&rsquo;s grove is private to that chat: it lives behind an unguessable link that is only ever sent
            inside the chat. No phone numbers or messages ever reach this site &mdash; only first names and the plan.
          </p>
        </section>
      </div>
    </>
  )
}

