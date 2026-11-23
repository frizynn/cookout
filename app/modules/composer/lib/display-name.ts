import type { CookoutClient, IdentityName, Refusal } from "../../sdk/index.ts";
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
}

interface DisplayNameDraft {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => DisplayNameSnapshot;
  readonly edit: (text: string) => void;
  readonly save: () => void;
}

interface DisplayNameOptions {
  readonly client: Pick<CookoutClient, "setDisplayName">;
  readonly list: IdentityList;
  readonly name: IdentityName;
}

function savedOf(list: IdentityList, name: IdentityName): string {
  for (const identity of list.identities()) {
    if (identity.name === name) {
      return identity.displayName ?? "";
    }
  }
  return "";
}

function sentOf(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  return trimmed;
}

function createDisplayName(options: DisplayNameOptions): DisplayNameDraft {
  const { client, list, name } = options;
  const listeners = listenersOf(list.load);
  let current: DisplayNameSnapshot = { save: { status: "idle" }, text: null };
  let saving = Promise.resolve();

  function publish(next: DisplayNameSnapshot): void {
    current = next;
    listeners.notify();
  }

  async function send(text: string | null): Promise<void> {
    try {
      const { identity } = await client.setDisplayName(name, sentOf(text ?? savedOf(list, name)));
      list.put(identity);
      publish({ save: { status: "idle" }, text: null });
    } catch (error: unknown) {
      publish({ save: { ...refusalOf(error), status: "failed" }, text });
    }
  }

  async function sendAfter(previous: Promise<void>, text: string | null): Promise<void> {
    await previous;
    await send(text);
  }

  return {
    edit: (text) => {
      publish({ ...current, text });
    },
    save: () => {
      const { text } = current;
      publish({ save: { status: "saving" }, text });
      saving = sendAfter(saving, text);
    },
    snapshot: () => current,
    subscribe: listeners.add,
  };
}

export { type DisplayNameDraft, type DisplayNameSnapshot, type SaveState, createDisplayName };
