import { test } from "node:test";
import assert from "node:assert/strict";
import { Keeper, type Inbound } from "../src/keeper.ts";
import { Store } from "../src/store.ts";
import { NullBrain } from "../src/brain.ts";
import { config } from "../src/config.ts";
import { parseCommand } from "../src/commands.ts";

let n = 0;
const msg = (senderId: string, text: string, spaceId = "g", isGroup = true): Inbound =>
  ({ spaceId, isGroup, senderId, msgId: `M${++n}`, text, ts: Date.now() });

test("keeper help replies in thread and never calls the model", () => {
  const k = new Keeper(new Store(null), new NullBrain(), config);
  const { actions, analyze } = k.ingest(msg("Priya", "keeper help"));
  assert.equal(analyze, false);
  assert.equal(actions[0].type, "reply");
});

test("ordinary group chatter is queued for analysis, with no immediate reply", () => {
  const k = new Keeper(new Store(null), new NullBrain(), config);
  const { actions, analyze } = k.ingest(msg("Jake", "lol same"));
  assert.deepEqual(actions, []);
  assert.equal(analyze, true);
});

test("commands in a group need the wake word; in a DM they don't", () => {
  assert.equal(parseCommand("list", "Keeper", false), null);
  assert.deepEqual(parseCommand("list", "Keeper", true), { type: "list" });
  assert.deepEqual(parseCommand("keeper quiet 2h", "Keeper", false), { type: "quiet", minutes: 120 });
});

test("chats never mix: forgetting one chat leaves the other", () => {
  const store = new Store(null);
  const a = store.space("a", true);
  const b = store.space("b", true);
  store.addItem(a, { kind: "idea", text: "x", status: "open", originId: "P", ownerId: null, due: null, dueAt: null, engaged: false, restatedBy: [], sourceMsgId: null }, 0);
  store.addItem(b, { kind: "idea", text: "y", status: "open", originId: "P", ownerId: null, due: null, dueAt: null, engaged: false, restatedBy: [], sourceMsgId: null }, 0);
  const k = new Keeper(store, new NullBrain(), config);
  k.ingest(msg("P", "keeper forget everything", "a"));
  assert.equal(a.items.length, 0);
  assert.equal(b.items.length, 1);
});
