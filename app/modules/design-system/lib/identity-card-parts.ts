import type { KeyboardEvent, ReactNode } from "react";
import type { PresenceShown } from "./avatar-parts.ts";
import { createContext } from "react";

interface IdentityCardLink {
  readonly name: string;
  readonly href: string;
}

interface IdentityCardSession {
  readonly href: string;
  readonly host: string;
}

interface IdentityCardParts {
  readonly name: string;
  readonly agent: boolean;
  readonly displayName: string | null;
  readonly presence: PresenceShown | null;
  readonly kind: string;
  readonly description: string | null;
  readonly deactivated: boolean;
  readonly profileHref: string;
  readonly broughtInBy: IdentityCardLink | null;
}

interface IdentityCardSource {
  readonly subscribe: (listener: () => void) => () => void;
  readonly cardOf: (name: string) => IdentityCardParts | null;
  readonly sessionOf: (name: string) => IdentityCardSession | null;
  readonly subscribeSession: (name: string) => (listener: () => void) => () => void;
}

interface IdentityCardTriggerParts {
  readonly name: string;
  readonly children: ReactNode;
}

type IdentityCardComposerParts = ((name: string) => void) | null;

interface IdentityCardControl {
  readonly mark: string;
  readonly canMessage: boolean;
  readonly onClose: () => void;
  readonly onEscape: () => void;
  readonly onMessage: () => void;
  readonly onStopKeyDown: (event: KeyboardEvent) => void;
}

interface IdentityCardBoxParts {
  readonly card: IdentityCardParts;
  readonly control: IdentityCardControl;
}

interface IdentityCardShownParts {
  readonly card: IdentityCardParts;
}

function noCard(): IdentityCardParts | null {
  return null;
}

function noSession(): IdentityCardSession | null {
  return null;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function subscribeSession(): (listener: () => void) => () => void {
  return subscribe;
}

const IdentityCards = createContext<IdentityCardSource>({
  cardOf: noCard,
  sessionOf: noSession,
  subscribe,
  subscribeSession,
});

const IdentityCardComposer = createContext<IdentityCardComposerParts>(null);

export { IdentityCardComposer, IdentityCards };
export type {
  IdentityCardBoxParts,
  IdentityCardComposerParts,
  IdentityCardControl,
  IdentityCardLink,
  IdentityCardParts,
  IdentityCardSession,
  IdentityCardShownParts,
  IdentityCardSource,
  IdentityCardTriggerParts,
};
