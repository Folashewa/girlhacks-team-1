// JSON-file memory (data/state.json). One SpaceState per chat; chats never mix.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export type ItemKind = "request" | "commitment" | "decision" | "idea" | "question";
export type ItemStatus = "open" | "done" | "dropped";

export interface Item {
  id: string; // "I3", unique within its chat
  kind: ItemKind;
  text: string;
  status: ItemStatus;
  originId: string; // who said it first; credit follows this
  ownerId: string | null; // who is doing it
  due: string | null;
  dueAt: number | null;
  engaged: boolean; // others discussed it
  restatedBy: string[];
  sourceMsgId: string | null;
  createdAt: number;
  updatedAt: number;
  // TODO(Task: back-out flow): release?: { stage: "awaiting" | "told-origin" | "owner" }
}

export interface LogEntry {
  msgId: string;
  senderId: string;
  text: string;
  ts: number;
}

export interface SpaceState {
  id: string; // platform chat id; never leaves the agent
  alias: string; // "g1", "d2"
  isGroup: boolean;
  treeKey: string; // unguessable id for the tree URL
  log: LogEntry[];
  items: Item[];
  quietUntil: number;
  unprompted: number[]; // timestamps of unprompted messages
  nextItem: number;
}

interface State {
  spaces: Record<string, SpaceState>;
  names: Record<string, string>; // personId -> name from "keeper call me"
  nextAlias: number;
}

const LOG_LIMIT = 200;

export class Store {
  private state: State = { spaces: {}, names: {}, nextAlias: 1 };

  constructor(private readonly file: string | null) {
    if (file) this.load();
  }

  private load(): void {
    try {
      this.state = JSON.parse(readFileSync(this.file!, "utf8")) as State;
    } catch {
      // missing or unreadable file: start empty
    }
  }

  save(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    renameSync(tmp, this.file); // atomic write
  }

  space(id: string, isGroup: boolean): SpaceState {
    let s = this.state.spaces[id];
    if (!s) {
      s = {
        id,
        alias: `${isGroup ? "g" : "d"}${this.state.nextAlias++}`,
        isGroup,
        treeKey: randomBytes(16).toString("hex"),
        log: [],
        items: [],
        quietUntil: 0,
        unprompted: [],
        nextItem: 1,
      };
      this.state.spaces[id] = s;
      this.save();
    }
    return s;
  }

  spaces(): SpaceState[] {
    return Object.values(this.state.spaces);
  }

  byAlias(alias: string): SpaceState | undefined {
    return this.spaces().find((s) => s.alias === alias);
  }

  appendLog(space: SpaceState, entry: LogEntry): void {
    space.log.push(entry);
    if (space.log.length > LOG_LIMIT) space.log.splice(0, space.log.length - LOG_LIMIT);
    this.save();
  }

  addItem(space: SpaceState, fields: Omit<Item, "id" | "createdAt" | "updatedAt">, now: number): Item {
    const item: Item = { ...fields, id: `I${space.nextItem++}`, createdAt: now, updatedAt: now };
    space.items.push(item);
    this.save();
    return item;
  }

  nameOf(personId: string): string | undefined {
    return this.state.names[personId];
  }

  setName(personId: string, name: string): void {
    this.state.names[personId] = name;
    this.save();
  }

  wipe(space: SpaceState): void {
    space.log = [];
    space.items = [];
    space.unprompted = [];
    this.save();
  }
}
