// `npm run mac`: Keeper drives this Mac's own Messages app through Photon's local provider.
// Group chats work like any iMessage user's; nothing is needed from Photon.
// Run it in a separate macOS user signed in with the bot's own Apple ID, so it only ever
// sees chats the bot was added to (never your personal Messages).

/** With MAC_CHATS set, every other chat is ignored before its text is read. */
export function allowedChat(chatId: string, allowlist: readonly string[]): boolean {
  return allowlist.length === 0 || allowlist.includes(chatId);
}

export const MAC_WARNING =
  "[keeper] mac mode reads this macOS user's Messages. Run it in a separate macOS user signed in " +
  "with the bot's Apple ID, never your personal account.";
