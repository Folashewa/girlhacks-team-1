// Entry: connects a transport, runs Keeper, debounces model passes per chat.
import { config } from "./config.ts";
import { Store } from "./store.ts";
import { Keeper, type Action } from "./keeper.ts";
import { NullBrain } from "./brain.ts";
import { IMessageTransport, TerminalTransport, type Transport } from "./connection.ts";

const DEBOUNCE_MS = 6000; // wait for people to finish typing; one model call per burst

const terminal = process.argv.includes("--terminal");
const store = new Store(terminal ? null : config.dataFile);
const keeper = new Keeper(store, new NullBrain(), config); // TODO(Task 3): real Brain
const transport: Transport = terminal ? new TerminalTransport() : new IMessageTransport(config);

const timers = new Map<string, NodeJS.Timeout>();

async function run(actions: Action[]): Promise<void> {
  for (const action of actions) {
    try {
      await transport.execute(action);
    } catch (e) {
      console.error(`failed to ${action.type}:`, e instanceof Error ? e.message : e);
    }
  }
}

await transport.start((msg) => {
  const { actions, analyze } = keeper.ingest(msg);
  void run(actions);
  if (!analyze) return;
  clearTimeout(timers.get(msg.spaceId));
  timers.set(msg.spaceId, setTimeout(() => void keeper.analyze(msg.spaceId).then(run), DEBOUNCE_MS));
});

process.on("SIGINT", async () => {
  await transport.stop();
  process.exit(0);
});
