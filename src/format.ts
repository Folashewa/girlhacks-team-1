// Deterministic replies for commands.
import type { Item, SpaceState } from "./store.ts";

export function formatHelp(agentName: string): string {
  const n = agentName.toLowerCase();
  return [
    `I'm ${agentName} 🌱 I quietly keep track of what still needs someone, who's doing what, what got decided, and ideas that shouldn't get lost.`,
    `"${n} list" · "${n} done <item>" · "${n} quiet 30m" · "${n} resume" · "${n} call me <name>" · "${n} forget everything"`,
  ].join("\n");
}

export function formatList(space: SpaceState, nameOf: (id: string) => string): string {
  const open = space.items.filter((i) => i.status === "open");
  if (open.length === 0) return "Nothing open right now.";
  const section = (title: string, items: Item[], line: (i: Item) => string) =>
    items.length ? [`${title}:`, ...items.map((i) => `• ${line(i)}`)] : [];
  const due = (i: Item) => (i.due ? ` (${i.due})` : "");
  return [
    ...section("Needs someone", open.filter((i) => i.kind === "request" && !i.ownerId), (i) => i.text + due(i)),
    ...section("Taken", open.filter((i) => i.ownerId), (i) => `${i.text} — ${nameOf(i.ownerId!)}${due(i)}`),
    ...section("Decided", open.filter((i) => i.kind === "decision"), (i) => i.text),
    ...section("Ideas", open.filter((i) => i.kind === "idea"), (i) => `${i.text} — ${nameOf(i.originId)}`),
    ...section("Open questions", open.filter((i) => i.kind === "question"), (i) => i.text),
  ].join("\n");
}
