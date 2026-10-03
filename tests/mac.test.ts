import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedChat } from "../src/mac.ts";

test("mac mode: with MAC_CHATS set, only listed chats are read", () => {
  const allow = ["iMessage;+;chat-team"];
  assert.equal(allowedChat("iMessage;+;chat-team", allow), true);
  assert.equal(allowedChat("iMessage;-;+15550000000", allow), false);
});

test("mac mode: with no MAC_CHATS, every chat the bot's account is in is read", () => {
  assert.equal(allowedChat("anything", []), true);
});
