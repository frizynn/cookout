import type { Channel, CookoutEvent, Message, ReadReceipt } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";

interface Receiver {
  readonly receive: (message: Message) => void;
}

interface ReceiptReceiver {
  readonly receiveReceipt: (receipt: ReadReceipt) => void;
  readonly refetch: () => void;
}

interface Store {
  readonly subscribe: (listener: () => void) => () => void;
}

interface LiveFeed {
  readonly follow: () => void;
  readonly followed: <Messages extends Store>(store: Messages) => Messages;
}

interface LiveFeedOptions {
  readonly added: (channel: Channel) => void;
  readonly back: () => void;
  readonly deleted: (channel: Channel) => void;
  readonly live: Live | null;
  readonly receivers: () => Iterable<Receiver>;
  readonly receiptReceivers: () => Iterable<ReceiptReceiver>;
}

function receiving({ added, deleted, receiptReceivers, receivers }: LiveFeedOptions): (event: CookoutEvent) => void {
  function heard(receipt: ReadReceipt): void {
    for (const receiver of receiptReceivers()) {
      receiver.receiveReceipt(receipt);
    }
  }

  function posted(message: Message): void {
    for (const receiver of receivers()) {
      receiver.receive(message);
    }
  }

  return (event) => {
    if (event.type === "channel") {
      added(event.channel);
    }
    if (event.type === "channel-deleted") {
      deleted(event.channel);
    }
    if (event.type === "read-receipt") {
      heard(event.receipt);
    }
    if (event.type === "message") {
      posted(event.message);
    }
  };
}

function backAgain({ back, receiptReceivers }: LiveFeedOptions): () => void {
  return () => {
    back();
    for (const receiver of receiptReceivers()) {
      receiver.refetch();
    }
  };
}

function createLiveFeed(options: LiveFeedOptions): LiveFeed {
  const { live } = options;
  let following = false;

  function follow(): void {
    if (!following && live !== null) {
      following = true;
      live.subscribe(receiving(options));
      live.onBack(backAgain(options));
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
