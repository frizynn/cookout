import { Context } from "effect";
import type { Effect } from "effect";

interface RouterPick {
  readonly name: string;
  readonly confidence?: number;
}

interface RouterAsk {
  readonly url: string;
  readonly body: string;
  readonly signature: string;
}

interface RouterCallerService {
  readonly ask: (ask: RouterAsk) => Effect.Effect<readonly RouterPick[], string>;
}

class RouterCaller extends Context.Service<RouterCaller, RouterCallerService>()(
  "@ai-hero/cookout/channels/lib/server/router-caller/RouterCaller",
) {}

export { type RouterAsk, RouterCaller, type RouterCallerService, type RouterPick };
