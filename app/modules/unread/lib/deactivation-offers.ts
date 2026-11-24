import type { CookoutClient, CookoutEvent, DeactivationOffer, DeactivationOfferId } from "../../sdk/index.ts";
import type { Notifier } from "./notifier.ts";
import { createNotifier } from "./notifier.ts";

type DeactivationOffersState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly deactivationOffers: readonly DeactivationOffer[] }
  | { readonly status: "failed" };

interface DeactivationOffers {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => DeactivationOffersState;
  readonly keep: (id: DeactivationOfferId) => void;
}

interface LiveDeactivationOffers extends DeactivationOffers {
  readonly addAll: (offers: readonly DeactivationOffer[]) => void;
  readonly clearUpTo: (id: DeactivationOfferId) => void;
  readonly openAre: (offers: readonly DeactivationOffer[]) => void;
  readonly receive: (event: CookoutEvent) => boolean;
  readonly open: () => readonly DeactivationOffer[];
  readonly newestOpen: () => DeactivationOfferId | null;
}

interface DeactivationOffersOptions {
  readonly client: Pick<CookoutClient, "inboxHistory" | "keepDeactivationOffer">;
  readonly onChange: (open: readonly DeactivationOffer[]) => void;
}

const FIRST_PAGE = { limit: 1 } as const;

function newestFirst(offers: Iterable<DeactivationOffer>): readonly DeactivationOffer[] {
  return [...offers].toSorted((first, second) => second.id - first.id);
}

function newestIdOf(offers: readonly DeactivationOffer[]): DeactivationOfferId | null {
  const [newest = null] = offers;
  if (newest === null) {
    return null;
  }
  return newest.id;
}

interface Known {
  readonly addAll: (offers: readonly DeactivationOffer[]) => void;
  readonly open: () => readonly DeactivationOffer[];
  readonly historyRead: () => void;
}

function clearedOf(offer: DeactivationOffer): DeactivationOffer {
  return { ...offer, cleared: true };
}

function knownOffers(shown: Notifier<DeactivationOffersState>, onChange: DeactivationOffersOptions["onChange"]): Known {
  const known = new Map<DeactivationOfferId, DeactivationOffer>();
  let loaded = false;
  function open(): readonly DeactivationOffer[] {
    return newestFirst(known.values()).filter(({ cleared }) => !cleared);
  }
  return {
    addAll: (offers) => {
      for (const offer of offers) {
        known.set(offer.id, offer);
      }
      if (loaded) {
        shown.publish({ deactivationOffers: newestFirst(known.values()), status: "loaded" });
      }
      onChange(open());
    },
    historyRead: () => {
      loaded = true;
    },
    open,
  };
}

function keeping(client: DeactivationOffersOptions["client"], known: Known): DeactivationOffers["keep"] {
  let queue: Promise<void> = Promise.resolve();
  async function keepAfter(previous: Promise<void>, id: DeactivationOfferId): Promise<void> {
    await previous;
    try {
      const { deactivationOffer } = await client.keepDeactivationOffer(id);
      known.addAll([deactivationOffer]);
    } catch {
      known.addAll([]);
    }
  }
  return (id) => {
    queue = keepAfter(queue, id);
  };
}

function receiveIn(known: Known, event: CookoutEvent): boolean {
  if (event.type !== "deactivation-offer") {
    return false;
  }
  known.addAll([event.deactivationOffer]);
  return true;
}

function openOnly(known: Known, offers: readonly DeactivationOffer[]): void {
  const listed = new Set(offers.map(({ id }) => id));
  const gone = known.open().filter(({ id }) => !listed.has(id));
  known.addAll([...gone.map((offer) => clearedOf(offer)), ...offers]);
}

function createDeactivationOffers({ client, onChange }: DeactivationOffersOptions): LiveDeactivationOffers {
  const shown = createNotifier<DeactivationOffersState>({ status: "loading" });
  const known = knownOffers(shown, onChange);
  let loading: Promise<void> | null = null;

  async function readHistory(): Promise<void> {
    try {
      const { deactivationOffers } = await client.inboxHistory(FIRST_PAGE);
      known.historyRead();
      known.addAll(deactivationOffers);
    } catch {
      shown.publish({ status: "failed" });
    }
  }

  return {
    addAll: known.addAll,
    clearUpTo: (id) => {
      known.addAll(
        known
          .open()
          .filter((offer) => offer.id <= id)
          .map((offer) => clearedOf(offer)),
      );
    },
    keep: keeping(client, known),
    newestOpen: () => newestIdOf(known.open()),
    open: known.open,
    openAre: (offers) => {
      openOnly(known, offers);
    },
    receive: (event) => receiveIn(known, event),
    snapshot: shown.current,
    subscribe: (listener) => {
      loading ??= readHistory();
      return shown.subscribe(listener);
    },
  };
}

export { type DeactivationOffers, type DeactivationOffersState, type LiveDeactivationOffers, createDeactivationOffers };
