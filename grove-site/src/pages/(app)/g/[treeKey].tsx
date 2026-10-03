/**
 * /g/:treeKey — one chat's live tree.
 *
 * The treeKey (128-bit, only ever sent inside that chat) names the chat's own
 * RecordRoom, `tree:<treeKey>`. The room's collections are read-only for
 * everyone; only the authenticated sync route writes. A wrong key opens an
 * empty room, which looks exactly like a chat with no items yet — the page
 * never reveals whether a key exists.
 */

import { RecordScope, useQuery } from 'deepspace'
import { useParams } from 'react-router-dom'
import { GroveView } from '../../../components/grove/GroveView'
import { TREE_KEY_RE } from '../../../grove/payload'
import { treeRoomId } from '../../../grove/room'
import { COLLECTIONS, rowsToGrove, type ChatRow, type ItemRow, type PersonRow } from '../../../grove/rows'
import { groveSchemas } from '../../../schemas/grove-schemas'
import { groveTitle } from '../../../grove/story'
import DemoGrove from '../../g/demo'
import '../../../components/grove/grove.css'

function LiveGrove() {
  const chat = useQuery<ChatRow>(COLLECTIONS.chats)
  const people = useQuery<PersonRow>(COLLECTIONS.people)
  const items = useQuery<ItemRow>(COLLECTIONS.items)

  if ([chat, people, items].some((q) => q.status === 'loading')) {
    return <div className="grove" aria-busy="true" />
  }
  if ([chat, people, items].some((q) => q.status === 'error')) {
    return (
      <div className="grove flex items-center justify-center px-6 text-center">
        <p className="grove-story text-2xl" style={{ color: 'var(--gold-soft)' }}>
          The grove is out of reach for a moment. Try again shortly.
        </p>
      </div>
    )
  }
  const grove = rowsToGrove(chat.records[0], people.records, items.records)
  return (
    <>
      <title>{`${groveTitle(grove)} · Grovekeeper`}</title>
      <GroveView grove={grove} />
    </>
  )
}

export default function TreePage() {
  const { treeKey = '' } = useParams()
  // React Router ranks /g/demo above /g/:treeKey; this is a belt-and-braces guard.
  if (treeKey === 'demo') return <DemoGrove />
  if (!TREE_KEY_RE.test(treeKey)) {
    return (
      <div className="grove flex items-center justify-center px-6 text-center">
        <title>Grovekeeper</title>
        <p className="grove-story text-2xl" style={{ color: 'var(--gold-soft)' }}>
          This path leads nowhere. Ask Grovekeeper for your grove's link with &lsquo;keeper tree&rsquo;.
        </p>
      </div>
    )
  }
  return (
    <RecordScope roomId={treeRoomId(treeKey)} schemas={groveSchemas} isolated>
      <LiveGrove />
    </RecordScope>
  )
}
