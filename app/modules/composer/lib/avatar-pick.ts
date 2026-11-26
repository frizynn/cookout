import type { IdentityName, Refusal } from "../../sdk/index.ts";
import type { IdentityList } from "./identity-list.ts";
import { listenersOf } from "./listeners.ts";
import { refusalOf } from "../../sdk/index.ts";

type AvatarSaveState =
  | { readonly status: "idle" }
  | { readonly status: "saving" }
  | (Refusal & { readonly status: "failed" });

interface AvatarPickSnapshot {
  readonly style: string;
  readonly round: number;
  readonly picked: number | null;
  readonly save: AvatarSaveState;
  readonly saved: number;
}

interface AvatarPick {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => AvatarPickSnapshot;
  readonly chooseStyle: (style: string) => void;
  readonly shuffle: () => void;
  readonly pick: (index: number) => void;
  readonly save: (png: Promise<Uint8Array>) => void;
}

const FIRST_ROUND = 0;
const NEXT = 1;
const NONE_SAVED = 0;

interface AvatarPickOptions {
  readonly list: IdentityList;
  readonly name: IdentityName;
  readonly style: string;
}

function createAvatarPick(options: AvatarPickOptions): AvatarPick {
  const { list, name } = options;
  const listeners = listenersOf(list.show);
  let current: AvatarPickSnapshot = {
    picked: null,
    round: FIRST_ROUND,
    save: { status: "idle" },
    saved: NONE_SAVED,
    style: options.style,
  };
  let saving = Promise.resolve();

  function publish(next: AvatarPickSnapshot): void {
    current = next;
    listeners.notify();
  }

  async function send(png: Promise<Uint8Array>): Promise<void> {
    try {
      await list.calls.setAvatar(name, await png);
      publish({ ...current, picked: null, save: { status: "idle" }, saved: current.saved + NEXT });
    } catch (error: unknown) {
      publish({ ...current, save: { ...refusalOf(error), status: "failed" } });
    }
  }

  async function sendAfter(previous: Promise<void>, png: Promise<Uint8Array>): Promise<void> {
    await previous;
    await send(png);
  }

  return {
    chooseStyle: (style) => {
      publish({ ...current, picked: null, style });
    },
    pick: (index) => {
      publish({ ...current, picked: index });
    },
    save: (png) => {
      publish({ ...current, save: { status: "saving" } });
      saving = sendAfter(saving, png);
    },
    shuffle: () => {
      publish({ ...current, picked: null, round: current.round + NEXT });
    },
    snapshot: () => current,
    subscribe: listeners.add,
  };
}

export { type AvatarPick, createAvatarPick };
