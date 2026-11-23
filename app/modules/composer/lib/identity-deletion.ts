import { closedHref, hrefOf, locationOf } from "../../paths/index.ts";
import type { IdentityName } from "../../sdk/index.ts";

interface IdentityDeletion {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => IdentityName | null;
  readonly dismiss: () => void;
  readonly closeIfOpen: (name: IdentityName) => void;
}

function closingHref(name: IdentityName): string | null {
  const { profile, route } = locationOf(globalThis.location.hash);
  if (route.name === "profile" && route.identity === name) {
    return hrefOf({ name: "people" });
  }
  if (profile === name) {
    return closedHref(route);
  }
  return null;
}

function createIdentityDeletion(): IdentityDeletion {
  const listeners = new Set<() => void>();
  let notice: IdentityName | null = null;

  function show(next: IdentityName | null): void {
    notice = next;
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    closeIfOpen: (name) => {
      const href = closingHref(name);
      if (href !== null) {
        globalThis.location.hash = href;
        show(name);
      }
    },
    dismiss: () => {
      show(null);
    },
    snapshot: () => notice,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type IdentityDeletion, createIdentityDeletion };
