// ALL decision logic. Platform-independent: takes events, returns Actions.
// Rule: the model proposes, the code decides (docs/IMPLEMENTATION.md section 0).
import { parseCommand, type Command } from "./commands.ts";
import { formatHelp, formatList } from "./format.ts";
import type { Brain } from "./brain.ts";
import type { Config } from "./config.ts";
import type { SpaceState, Store } from "./store.ts";

export interface Inbound {
  spaceId: string;
  isGroup: boolean;
  senderId: string;
  msgId: string;
  text: string;
  ts: number;
}

export type Action =
  | { type: "react"; spaceId: string; msgId: string; emoji: string }
  | { type: "reply"; spaceId: string; msgId: string; text: string } // threaded
  | { type: "send"; spaceId: string; text: string }
  | { type: "dm"; personId: string; text: string };

export class Keeper {
  constructor(
    private readonly store: Store,
    private readonly brain: Brain,
    private readonly config: Config,
    private readonly now: () => number = Date.now,
  ) {}

  /** Handle one message instantly. Returns whether the chat needs a model pass (debounced by the caller). */
  ingest(msg: Inbound): { actions: Action[]; analyze: boolean } {
    const space = this.store.space(msg.spaceId, msg.isGroup);
    const command = parseCommand(msg.text, this.config.agentName, !msg.isGroup);
    if (command) return { actions: this.runCommand(space, msg, command), analyze: false };

    this.store.appendLog(space, { msgId: msg.msgId, senderId: msg.senderId, text: msg.text, ts: msg.ts });
    // TODO: DMs — private back-out replies (1/2/3), "done" for nudges, first-DM intro.
    return { actions: [], analyze: msg.isGroup };
  }

  /** One model pass over a chat's recent messages. */
  async analyze(spaceId: string): Promise<Action[]> {
    // TODO(Task 3): buildSnapshot → brain.analyze → validate each update
    // (confidence ≥ config.minConfidence, ownership, credit never names the restater)
    // → apply to store → return react/reply actions within rate limits and quiet mode.
    void spaceId;
    return [];
  }

  private runCommand(space: SpaceState, msg: Inbound, cmd: Command): Action[] {
    const reply = (text: string): Action[] => [{ type: "reply", spaceId: space.id, msgId: msg.msgId, text }];
    switch (cmd.type) {
      case "help":
        return reply(formatHelp(this.config.agentName));
      case "list":
        return reply(formatList(space, (id) => this.displayName(id)));
      case "quiet":
        space.quietUntil = this.now() + cmd.minutes * 60_000;
        this.store.save();
        return reply(`Going quiet for ${cmd.minutes} min. Say "${this.config.agentName.toLowerCase()} resume" to bring me back.`);
      case "resume":
        space.quietUntil = 0;
        this.store.save();
        return reply("I'm back.");
      case "callme":
        this.store.setName(msg.senderId, cmd.name);
        return reply(`Got it, ${cmd.name}.`);
      case "forget":
        this.store.wipe(space);
        return reply("Done. I've forgotten everything from this chat.");
      case "done":
        return reply("TODO: mark an item done."); // TODO: match cmd.ref to an open item the sender owns
    }
  }

  private displayName(personId: string): string {
    return this.store.nameOf(personId) ?? "someone";
  }
}
