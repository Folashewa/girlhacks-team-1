// Every setting, read from .env. See docs/IMPLEMENTATION.md section 6.
const env = process.env;

export const config = {
  projectId: env.SPECTRUM_PROJECT_ID ?? "",
  projectSecret: env.SPECTRUM_PROJECT_SECRET ?? "",
  agentName: env.AGENT_NAME ?? "Keeper",
  ackEmoji: env.ACK_EMOJI ?? "👍",
  dataFile: env.DATA_FILE ?? "data/state.json",
  minConfidence: Number(env.MIN_CONFIDENCE ?? 0.75),
  maxUnpromptedPerDay: Number(env.MAX_UNPROMPTED_PER_DAY ?? 6),
  unpromptedCooldownMin: Number(env.UNPROMPTED_COOLDOWN_MIN ?? 10),
};

export type Config = typeof config;
