import { describe, expect, it } from 'vitest'
import demo from '../fixtures/demo.json'
import type { Grove, Item } from './sync-payload'
import { counts, describe as label, groveTitle, newestItem, shortLabel, itemStory } from './labels'

const grove: Grove = { title: demo.chat.title, people: demo.people, items: demo.items as Item[] }

const people = demo.people
const item = (id: string) => demo.items.find((i) => i.id === id) as Item

describe('grove wording', () => {
  it('a credited idea keeps credit with its planter', () => {
    const s = itemStory(item('I1'), people)
    expect(s.eyebrow).toBe('Idea')
    expect(s.byline).toBe('Planted by Priya')
    expect(s.note).toContain('Credit stays with whoever said it first')
    expect(s.pills).toEqual([{ text: 'Credited to Priya', personKey: 'p1' }])
  })

  it('work shows who took it, and done work says so', () => {
    expect(itemStory(item('I3'), people)).toMatchObject({ eyebrow: 'Taken', byline: 'Taken by Jake' })
    expect(itemStory(item('I2'), people)).toMatchObject({ eyebrow: 'Done', pills: [{ text: 'Done' }] })
  })

  it('unclaimed requests invite rather than blame', () => {
    const s = itemStory(item('I4'), people)
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

  it('labels are readable and name people, never keys', () => {
    expect(label(grove.items[0] as Item, grove.people)).toBe('Idea from Priya: Make it live in the group chat instead of an app')
    expect(label(grove.items[3] as Item, grove.people)).toBe('Needs someone: Submit the Devpost')
    expect(label(grove.items[5] as Item, grove.people)).toBe('Open question from Maya: Who presents the demo?')
  })

  it('header counts', () => {
    expect(counts(grove.items as Item[])).toBe('1 taken · 1 needs someone · 1 idea · 1 decided · 1 done')
    expect(counts([])).toBe('0 taken · 0 need someone · 0 ideas · 0 decided · 0 done')
  })

  it('short on-tree labels read like the design', () => {
    const p = grove.people
    const it = (id: string) => grove.items.find((i) => i.id === id) as Item
    expect(shortLabel(it('I1'), p)).toBe("Priya's seed, credited")
    expect(shortLabel(it('I2'), p)).toBe('Maya · figma mockups, done')
    expect(shortLabel(it('I3'), p)).toBe('Jake · set up the repo')
    expect(shortLabel(it('I4'), p)).toBe('still needs someone: submit the Devpost')
    expect(shortLabel(it('I5'), p)).toBe('decided: pivot to a group chat agent')
    expect(shortLabel(it('I6'), p)).toBe('Who presents the demo?')
    expect(shortLabel({ ...it('I3'), text: 'A very long task description that goes on and on' }, p)).toBe('Jake · a very long task description…')
  })
})
