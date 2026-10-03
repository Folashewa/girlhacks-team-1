// One structured model call per burst of messages, with defensive parsing.
// TODO(Task 3): implement with OpenAI / Azure OpenAI structured outputs.
// The model PROPOSES updates; keeper.ts validates and decides.
import type { ItemKind } from "./store.ts";

export interface ProposedUpdate {
  op: "add" | "claim" | "done" | "drop" | "engage" | "restate";
  kind: ItemKind | null;
  text: string | null;
  item: string | null; // "I3"
  msg: string | null; // "M7": the message this update comes from
  due: string | null;
  confidence: number;
}

export interface Analysis {
  updates: ProposedUpdate[];
  answer: string | null; // only when someone addressed the agent
  creditText: string | null;
}

export interface Brain {
  analyze(snapshot: string): Promise<Analysis>;
}

/** Used until a model key is configured: records nothing. */
export class NullBrain implements Brain {
  async analyze(): Promise<Analysis> {
    return { updates: [], answer: null, creditText: null };
  }
}
