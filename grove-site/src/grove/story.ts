/**
 * Words for the item card. Kind, who, a one-line story, and pills.
 * Never shames (rule 6): no "overdue", no "still hasn't".
 */

import { nameOf } from './layout'
import type { Grove, Item, Person } from './payload'

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

export function storyOf(item: Item, people: Person[]): Story {
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
