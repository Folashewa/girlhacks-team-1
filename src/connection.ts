// Transports: iMessage via Photon cloud, and a local terminal for testing without a phone.
// TODO(Task 1 fallback): connect-local.ts using @spectrum-ts/imessage-local.
import { createInterface } from "node:readline";
import { Spectrum, type Message, type Space } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import type { Action, Inbound } from "./keeper.ts";
import type { Config } from "./config.ts";

export interface Transport {
  start(onMessage: (msg: Inbound) => void): Promise<void>;
  execute(action: Action): Promise<void>;
  stop(): Promise<void>;
}

export class IMessageTransport implements Transport {
  private app?: Awaited<ReturnType<typeof Spectrum<[ReturnType<typeof imessage.config>]>>>;
  private readonly spaces = new Map<string, Space>();
  private readonly messages = new Map<string, Message>();

  constructor(private readonly config: Config) {}

  async start(onMessage: (msg: Inbound) => void): Promise<void> {
    if (!this.config.projectId || !this.config.projectSecret) {
      throw new Error("Missing SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET in .env");
    }
    this.app = await Spectrum({
      projectId: this.config.projectId,
      projectSecret: this.config.projectSecret,
      providers: [imessage.config()],
    });
    console.log("iMessage connected.");
    void (async () => {
      for await (const [space, message] of this.app!.messages) {
        if (message.direction !== "inbound" || !message.sender || message.sender.kind === "agent") continue;
        const text = extractText(message);
        if (!text) continue;
        this.spaces.set(space.id, space);
        this.remember(message);
        const isGroup = (space as unknown as { type?: string }).type === "group";
        onMessage({ spaceId: space.id, isGroup, senderId: message.sender.id, msgId: message.id, text, ts: message.timestamp.getTime() });
      }
    })();
  }

  async execute(action: Action): Promise<void> {
    if (action.type === "dm") {
      const space = await imessage(this.app!).space.create(action.personId);
      await space.send(action.text);
      return;
    }
    const space = this.spaces.get(action.spaceId);
    if (!space) return console.warn(`unknown space for ${action.type}`);
    if (action.type === "send") {
      await space.send(action.text);
      return;
    }
    const target = this.messages.get(action.msgId) ?? (await space.getMessage(action.msgId));
    if (!target) return console.warn(`message ${action.msgId} not found`);
    if (action.type === "react") await target.react(action.emoji);
    else await space.responding(() => target.reply(action.text));
  }

  async stop(): Promise<void> {
    await this.app?.stop();
  }

  private remember(message: Message): void {
    this.messages.set(message.id, message);
    if (this.messages.size > 2000) this.messages.delete(this.messages.keys().next().value!);
  }
}

function extractText(message: Message): string | null {
  const c = message.content as { type: string; text?: string; content?: { type: string; text?: string; markdown?: string } };
  if (c.type === "text") return c.text ?? null;
  if ((c.type === "reply" || c.type === "edit") && c.content) return c.content.text ?? c.content.markdown ?? null;
  return null; // TODO: voice memos (stretch)
}

/**
 * Type "Priya: I'll do the slides by 6" to speak in a group as Priya,
 * or "dm Priya: hi" to DM the agent as Priya.
 */
export class TerminalTransport implements Transport {
  private counter = 0;
  private rl = createInterface({ input: process.stdin });

  async start(onMessage: (msg: Inbound) => void): Promise<void> {
    console.log('Terminal mode. Type "Name: message" (group) or "dm Name: message".');
    this.rl.on("line", (line) => {
      const m = line.match(/^(dm\s+)?([^:]{1,30}):\s*(.+)$/i);
      if (!m) return console.log('  (format: "Priya: hello" or "dm Priya: hello")');
      const name = m[2].trim();
      const isGroup = !m[1];
      const msgId = `M${++this.counter}`;
      console.log(`  [${msgId}]`);
      onMessage({ spaceId: isGroup ? "terminal-group" : `dm:${name}`, isGroup, senderId: name, msgId, text: m[3], ts: Date.now() });
    });
  }

  async execute(a: Action): Promise<void> {
    if (a.type === "react") console.log(`  ${a.emoji} on ${a.msgId}`);
    else if (a.type === "reply") console.log(`  Keeper ↪ ${a.msgId}: ${a.text}`);
    else if (a.type === "send") console.log(`  Keeper: ${a.text}`);
    else console.log(`  [DM → ${a.personId}] ${a.text}`);
  }

  async stop(): Promise<void> {
    this.rl.close();
  }
}
