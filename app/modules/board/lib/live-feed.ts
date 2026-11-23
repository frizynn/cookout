import type { CookoutEvent, Message } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";

interface Receiver {
  readonly receive: (message: Message) => void;
}

interface Store {
  readonly subscribe: (listener: () => void) => () => void;
}

interface LiveFeed {
  readonly follow: () => void;
  readonly followed: <Messages extends Store>(store: Messages) => Messages;
}

interface LiveFeedOptions {
  readonly live: Live | null;
  readonly receivers: () => Iterable<Receiver>;
}

function createLiveFeed({ live, receivers }: LiveFeedOptions): LiveFeed {
  let following = false;

  function receive(event: CookoutEvent): void {
    if (event.type !== "message") {
      return;
    }
    for (const receiver of receivers()) {
      receiver.receive(event.message);
    }
  }

  function follow(): void {
    if (!following && live !== null) {
      following = true;
      live.subscribe(receive);
    }
  }

  return {
    follow,
    followed: (store) => ({
      ...store,
      subscribe: (listener) => {
        follow();
        return store.subscribe(listener);
      },
    }),
  };
}

export { createLiveFeed };
