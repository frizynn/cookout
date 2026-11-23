import type { DisplayName, Identity, IdentityName } from "../../../identities/index.ts";
import { isDisplayName, isIdentityName, isOwner } from "../../../identities/index.ts";
import { expect } from "@effect/vitest";
import { fixtureTime } from "./time.ts";

type AgentFixtureOptions = {
  readonly kind?: "agent";
  readonly owner?: string;
  readonly admin?: boolean;
  readonly displayName?: string;
};

function nameOf(value: string): IdentityName {
  return isIdentityName(value) ? value : expect.unreachable(`${value} is not an identity name`);
}

function agentFixture(name: string, { admin = false, owner }: AgentFixtureOptions): Identity {
  const base = { admin, createdAt: fixtureTime, kind: "agent", name: nameOf(name) } as const;
  if (owner === undefined) {
    return base;
  }
  return isOwner(owner) ? { ...base, owner } : expect.unreachable(`${owner} is not an owner`);
}

function displayNameOf(value: string): DisplayName {
  if (isDisplayName(value)) {
    return value;
  }
  return expect.unreachable(`${value} is not a display name`);
}

function withDisplayName(identity: Identity, displayName: string | null = null): Identity {
  if (displayName === null) {
    return identity;
  }
  return { ...identity, displayName: displayNameOf(displayName) };
}

export const identityName = nameOf;

export type IdentityFixtureOptions =
  | { readonly kind: "human"; readonly admin?: boolean; readonly displayName?: string }
  | AgentFixtureOptions;

export const identityFixture = (name: string, options: IdentityFixtureOptions = {}): Identity => {
  if (options.kind === "human") {
    const human: Identity = {
      admin: options.admin ?? false,
      createdAt: fixtureTime,
      kind: "human",
      name: nameOf(name),
    };
    return withDisplayName(human, options.displayName);
  }
  return withDisplayName(agentFixture(name, options), options.displayName);
};
