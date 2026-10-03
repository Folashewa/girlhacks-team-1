// "keeper ..." commands. These never call the model: instant and free.
export type Command =
  | { type: "help" }
  | { type: "list" }
  | { type: "done"; ref: string }
  | { type: "quiet"; minutes: number }
  | { type: "resume" }
  | { type: "callme"; name: string }
  | { type: "forget" };
// TODO: "me" (private stats), "tree" (Task 4.4), "wrapup" (Task 6)

export function parseCommand(text: string, agentName: string, isDm: boolean): Command | null {
  const name = agentName.toLowerCase();
  let t = text.trim().toLowerCase();
  const prefix = new RegExp(`^(hey\\s+)?${name}[,:]?\\s*`);
  if (prefix.test(t)) t = t.replace(prefix, "");
  else if (!isDm) return null; // in a group, commands need the wake word

  if (/^(help|\?)$/.test(t)) return { type: "help" };
  if (/^(list|what'?s (still )?(open|left)\??|todo)$/.test(t)) return { type: "list" };
  if (/^resume$/.test(t)) return { type: "resume" };
  if (/^forget everything$/.test(t)) return { type: "forget" };

  const done = t.match(/^done\s+(.+)$/);
  if (done) return { type: "done", ref: done[1] };

  const quiet = t.match(/^quiet(?:\s+(\d+)\s*(m|min|h|hr)?)?$/);
  if (quiet) {
    const n = quiet[1] ? Number(quiet[1]) : 60;
    return { type: "quiet", minutes: quiet[2]?.startsWith("h") ? n * 60 : n };
  }

  const callme = text.trim().match(/call me\s+([\p{L}' -]{1,30})$/iu);
  if (callme) return { type: "callme", name: callme[1].trim() };

  return null;
}
