import { describe, expect, it } from 'vitest'
import demo from '../fixtures/demo.json'
import { layoutGrove } from './layout'
import type { Grove, Item } from './sync-payload'

const grove: Grove = { title: demo.chat.title, people: demo.people, items: demo.items as Item[] }
const shapeOf = (g: Grove, id: string) => layoutGrove(g).shapes.find((s) => s.item.id === id)

describe('tree layout', () => {
  it('is deterministic: same data, same picture', () => {
    const a = layoutGrove(grove)
    const b = layoutGrove({ ...grove, items: [...grove.items].reverse() })
    expect(b.shapes.map((s) => [s.item.id, s.x, s.y]).sort()).toEqual(a.shapes.map((s) => [s.item.id, s.x, s.y]).sort())
  })

  it('maps each kind to the shape in the spec', () => {
    expect(shapeOf(grove, 'I1')?.shape).toBe('sprout') // idea, discussed + credited
    expect(shapeOf(grove, 'I1')?.credited).toBe(true)
    expect(shapeOf(grove, 'I2')?.shape).toBe('blossom') // done commitment
    expect(shapeOf(grove, 'I3')?.shape).toBe('leaf') // owned, open
    expect(shapeOf(grove, 'I4')?.shape).toBe('bud') // request, nobody yet
    expect(shapeOf(grove, 'I5')?.shape).toBe('ring') // decision
    expect(shapeOf(grove, 'I6')?.shape).toBe('mist') // open question
  })

  it('an idea nobody discussed is a seed', () => {
    const g = { ...grove, items: [{ ...grove.items[0], discussed: false, credited: false }] }
    expect(shapeOf(g, 'I1')?.shape).toBe('seed')
  })

  it('credit stays with the planter: an idea grows on its origin’s branch, in their color', () => {
    const s = shapeOf(grove, 'I1')!
    expect(s.color).toBe('#7FF2D0') // Priya, colorIndex 0
  })

  it('a taken leaf sits on the owner’s branch, not the asker’s', () => {
    const asked: Item = { ...(grove.items[3] as Item), id: 'I9', owner: 'p2' } // Priya asked, Jake took it
    const s = shapeOf({ ...grove, items: [...grove.items, asked] }, 'I9')!
    expect(s.shape).toBe('leaf')
    expect(s.color).toBe('#FFB38A') // Jake
    expect(s.label).toBe('Taken by Jake: Submit the Devpost')
  })

  it('adding an item does not move existing ones', () => {
    const before = layoutGrove(grove).shapes
    const extra: Item = { ...(grove.items[2] as Item), id: 'I7', text: 'Record the backup demo' }
    const after = layoutGrove({ ...grove, items: [...grove.items, extra] }).shapes
    for (const s of before) {
      const t = after.find((x) => x.item.id === s.item.id)!
      expect([t.x, t.y]).toEqual([s.x, s.y])
    }
  })

  it('handles more people than colors and stays inside the view', () => {
    const people = Array.from({ length: 12 }, (_, i) => ({ personKey: `q${i}`, name: `Member ${i + 1}`, colorIndex: i % 8 }))
    const items = people.map((p, i): Item => ({ ...(grove.items[2] as Item), id: `I${i + 1}`, from: p.personKey, owner: p.personKey }))
    for (const s of layoutGrove({ title: null, people, items }).shapes) {
      expect(s.x).toBeGreaterThan(0)
      expect(s.x).toBeLessThan(1000)
      expect(s.y).toBeGreaterThan(0)
      expect(s.y).toBeLessThan(700)
    }
  })

  it('adjusts to a busy chat: nothing stacks on top of anything else', () => {
    const base = grove.items[2] as Item
    const people = Array.from({ length: 10 }, (_, i) => ({ personKey: `q${i}`, name: `Member ${i + 1}`, colorIndex: i % 8 }))
    let n = 0
    const make = (count: number, over: Partial<Item>): Item[] =>
      Array.from({ length: count }, () => ({ ...base, ...over, id: `I${++n}` }))
    const items = [
      ...make(30, { kind: 'commitment', from: 'q0', owner: 'q0' }), // one very busy person
      ...make(15, { kind: 'idea', from: 'q1', owner: null }),
      ...make(25, { kind: 'request', from: 'q2', owner: null }),
      ...make(12, { kind: 'question', from: 'q3', owner: null }),
      ...make(20, { kind: 'decision', from: 'q4', owner: null }),
    ]
    for (const narrow of [false, true]) {
      const shapes = layoutGrove({ title: null, people, items }, { narrow }).shapes
      expect(shapes).toHaveLength(items.length)
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const a = shapes[i]
          const b = shapes[j]
          if (a.shape === 'ring' && b.shape === 'ring') continue // rings stack in the trunk by design
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          expect(d, `${a.item.id} (${a.shape}) on top of ${b.item.id} (${b.shape}), narrow=${narrow}`).toBeGreaterThan(6)
        }
      }
    }
  })

  it('labels everything in small chats, only on hover when busy or on a phone', () => {
    expect(layoutGrove(grove).busy).toBe(false)
    expect(layoutGrove(grove, { narrow: true }).busy).toBe(true)
    const many = Array.from({ length: 13 }, (_, i): Item => ({ ...(grove.items[2] as Item), id: `I${i + 1}` }))
    expect(layoutGrove({ ...grove, items: many }).busy).toBe(true)
  })
})
