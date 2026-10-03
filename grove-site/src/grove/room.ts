/** Every chat gets its own RecordRoom; the treeKey is the only way to name it. */
export function treeRoomId(treeKey: string): string {
  return `tree:${treeKey}`
}
