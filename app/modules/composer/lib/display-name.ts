import type { IdentityName, Refusal } from "../../sdk/index.ts";
import type { IdentityList } from "./identity-list.ts";
import { listenersOf } from "./listeners.ts";
import { refusalOf } from "../../sdk/index.ts";

type SaveState =
  | { readonly status: "idle" }
  | { readonly status: "saving" }
  | (Refusal & { readonly status: "failed" });

interface DisplayNameSnapshot {
  readonly text: string | null;
  readonly save: SaveState;
  readonly saved: number;
}

interface DisplayNameDraft {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => DisplayNameSnapshot;
  readonly edit: (text: string) => void;
  readonly save: (text: string) => void;
  readonly discard: () => void;
}

interface DisplayNameOptions {
  readonly set: (name: IdentityName, text: string | null) => Promise<void>;
  readonly list: IdentityList;
  readonly name: IdentityName;
}

function sentOf(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  return trimmed;
}

const NONE_SAVED = 0;
const NEXT = 1;

function createDisplayName(options: DisplayNameOptions): DisplayNameDraft {
  const { list, name, set } = options;
  const listeners = listenersOf(list.show);
  let current: DisplayNameSnapshot = { save: { status: "idle" }, saved: NONE_SAVED, text: null };
  let saving = Promise.resolve();

  function publish(next: DisplayNameSnapshot): void {
    current = next;
    listeners.notify();
  }

  async function send(text: string): Promise<void> {
    try {
      await set(name, sentOf(text));
      publish({ save: { status: "idle" }, saved: current.saved + NEXT, text: null });
    } catch (error: unknown) {
      publish({ ...current, save: { ...refusalOf(error), status: "failed" }, text });
    }
  }

  async function sendAfter(previous: Promise<void>, text: string): Promise<void> {
    await previous;
    await send(text);
  }

  return {
    discard: () => {
      publish({ ...current, save: { status: "idle" }, text: null });
    },
    edit: (text) => {
      publish({ ...current, text });
    },
    save: (text) => {
      publish({ ...current, save: { status: "saving" }, text });
      saving = sendAfter(saving, text);
    },
    snapshot: () => current,
    subscribe: listeners.add,
  };
}

export { type DisplayNameDraft, createDisplayName };
