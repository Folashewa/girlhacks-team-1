import { describe, expect, it } from 'vitest'
import demo from '../fixtures/demo.json'
import type { Item } from './payload'
import { groveTitle, newestItem, storyOf } from './story'

const people = demo.people
const item = (id: string) => demo.items.find((i) => i.id === id) as Item

describe('item card story', () => {
  it('a credited idea keeps credit with its planter', () => {
    const s = storyOf(item('I1'), people)
    expect(s.eyebrow).toBe('Idea')
    expect(s.byline).toBe('Planted by Priya')
    expect(s.note).toContain('Credit stays with whoever said it first')
    expect(s.pills).toEqual([{ text: 'Credited to Priya', personKey: 'p1' }])
  })

  it('work shows who took it, and done work says so', () => {
    expect(storyOf(item('I3'), people)).toMatchObject({ eyebrow: 'Taken', byline: 'Taken by Jake' })
    expect(storyOf(item('I2'), people)).toMatchObject({ eyebrow: 'Done', pills: [{ text: 'Done' }] })
  })

  it('unclaimed requests invite rather than blame', () => {
    const s = storyOf(item('I4'), people)
    expect(s.eyebrow).toBe('Needs someone')
    expect(s.pills).toEqual([{ text: 'Due before 10:30am' }])
    expect(JSON.stringify(s)).not.toMatch(/overdue|hasn't|late|ignored/i)
  })

  it('the card defaults to the newest item', () => {
    expect(newestItem(demo.items as Item[])?.id).toBe('I2') // updated last (marked done)
    expect(newestItem([])).toBeNull()
  })

  it('titles a grove by the chat name, or by its size when the chat has no name', () => {
    expect(groveTitle({ title: 'Spring break', people })).toBe('Spring break')
    expect(groveTitle({ title: null, people })).toBe('A grove of 3')
    expect(groveTitle({ title: '   ', people })).toBe('A grove of 3')
    const twenty = Array.from({ length: 20 }, (_, i) => ({ personKey: `q${i}`, name: `Member ${i + 1}`, colorIndex: i % 8 }))
    expect(groveTitle({ title: null, people: twenty })).toBe('A grove of 20')
    expect(groveTitle({ title: null, people: [] })).toBe('Your grove')
  })
})
