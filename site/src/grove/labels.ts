/**
 * Every piece of wording the grove shows: accessible labels, the short labels
 * drawn on the tree, header counts, the page title, and the item card's text.
 * Never shames (rule 6): no "overdue", no "still hasn't".
 */

import type { Grove, Item, Person } from './sync-payload'

export function nameOf(people: Person[], key: string | null): string {
  if (!key) return 'someone'
  return people.find((p) => p.personKey === key)?.name ?? 'a member'
}

/** Accessible label, also the tooltip's first line. */
export function describe(item: Item, people: Person[]): string {
  const from = nameOf(people, item.from)
  const owner = nameOf(people, item.owner)
  switch (item.kind) {
    case 'idea':
      return `Idea from ${from}: ${item.text}`
    case 'decision':
      return `Decided: ${item.text}`
    case 'question':
      return item.status === 'done' ? `Answered question from ${from}: ${item.text}` : `Open question from ${from}: ${item.text}`
    default:
      if (!item.owner) return item.status === 'done' ? `Done: ${item.text}` : `Needs someone: ${item.text}`
      return item.status === 'done' ? `Done by ${owner}: ${item.text}` : `Taken by ${owner}: ${item.text}`
  }
}

const clip = (t: string, n = 30) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** The short label drawn next to an element on the tree. */
export function shortLabel(item: Item, people: Person[]): string {
  const from = nameOf(people, item.from)
  const text = clip(lower(item.text))
  switch (item.kind) {
    case 'idea':
      if (item.status === 'done') return `${from}'s idea, done`
      return item.credited ? `${from}'s seed, credited` : item.discussed ? `${from}'s seed, growing` : `${from}'s seed`
    case 'decision':
      return `decided: ${text}`
    case 'question':
      return clip(item.text)
    default:
      if (!item.owner) return item.status === 'done' ? `done: ${text}` : `still needs someone: ${text}`
      return `${nameOf(people, item.owner)} · ${text}${item.status === 'done' ? ', done' : ''}`
  }
}

export function counts(items: Item[]): string {
  const work = (i: Item) => i.kind === 'request' || i.kind === 'commitment'
  const taken = items.filter((i) => work(i) && i.owner && i.status === 'open').length
  const needs = items.filter((i) => i.kind === 'request' && !i.owner && i.status === 'open').length
  const ideas = items.filter((i) => i.kind === 'idea').length
  const decided = items.filter((i) => i.kind === 'decision').length
  const done = items.filter((i) => (work(i) || i.kind === 'idea') && i.status === 'done').length
  return `${taken} taken · ${needs} need${needs === 1 ? 's' : ''} someone · ${ideas} idea${ideas === 1 ? '' : 's'} · ${decided} decided · ${done} done`
}

export const KIND_LABEL: Record<Item['kind'], string> = {
  idea: 'Idea',
  request: 'Needs doing',
  commitment: 'Taken',
  decision: 'Decision',
  question: 'Open question',
}

export interface Pill {
  text: string
  /** Person key whose color tints the pill, if any. */
  personKey?: string
}

export interface Story {
  eyebrow: string
  byline: string
  note: string
  pills: Pill[]
}

export function itemStory(item: Item, people: Person[]): Story {
  const from = nameOf(people, item.from)
  const owner = item.owner ? nameOf(people, item.owner) : null
  const done = item.status === 'done'
  const pills: Pill[] = []
  if (item.kind === 'idea' && item.credited) pills.push({ text: `Credited to ${from}`, personKey: item.from })
  if (done) pills.push({ text: 'Done' })
  if (item.due && !done) pills.push({ text: `Due ${item.due}` })

  switch (item.kind) {
    case 'idea':
      return {
        eyebrow: done ? 'Idea · came true' : 'Idea',
        byline: `Planted by ${from}`,
        note: done
          ? 'This one grew all the way. Credit stays with whoever said it first.'
          : item.credited
            ? 'Picked up by the team later. Credit stays with whoever said it first.'
            : item.discussed
              ? 'The group is talking it over. Credit stays with whoever said it first.'
              : 'Planted and waiting for the group to pick it up.',
        pills,
      }
    case 'decision':
      return { eyebrow: 'Decision', byline: `Raised by ${from}`, note: 'The group settled this.', pills }
    case 'question':
      return {
        eyebrow: done ? 'Question · answered' : 'Open question',
        byline: `Asked by ${from}`,
        note: done ? 'The group found an answer.' : 'Still drifting. Nobody has settled this yet.',
        pills,
      }
    default:
      if (!owner) {
        return {
          eyebrow: done ? 'Done' : 'Needs someone',
          byline: `Asked by ${from}`,
          note: done ? 'Taken care of.' : 'Up for grabs. Anyone in the chat can take it.',
          pills,
        }
      }
      return {
        eyebrow: done ? 'Done' : 'Taken',
        byline: item.kind === 'request' && item.from !== item.owner ? `Taken by ${owner} · asked by ${from}` : `Taken by ${owner}`,
        note: done ? `${owner} finished this one.` : `${owner} said they'd handle it.`,
        pills,
      }
  }
}

/** The item the card shows before anyone clicks: the newest thing in the grove. */
export function newestItem(items: Item[]): Item | null {
  let best: Item | null = null
  for (const i of items) {
    if (!best || i.updatedAt > best.updatedAt || (i.updatedAt === best.updatedAt && i.createdAt > best.createdAt)) best = i
  }
  return best
}

/**
 * The page title: the group chat's own name, or — for unnamed chats — one that
 * scales to any size without listing names ("A grove of 20"). Counts the people
 * the agent has seen take part, not silent members.
 */
export function groveTitle(grove: Pick<Grove, 'title' | 'people'>): string {
  const name = grove.title?.trim()
  if (name) return name
  return grove.people.length >= 2 ? `A grove of ${grove.people.length}` : 'Your grove'
}
