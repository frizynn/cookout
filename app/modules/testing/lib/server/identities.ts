import type { Identity, IdentityName } from "../../../identities/index.ts";
import { isIdentityName, isOwner } from "../../../identities/index.ts";
import { expect } from "@effect/vitest";
import { fixtureTime } from "./time.ts";

type AgentFixtureOptions = { readonly kind?: "agent"; readonly owner?: string; readonly admin?: boolean };

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

export const identityName = nameOf;

export type IdentityFixtureOptions = { readonly kind: "human"; readonly admin?: boolean } | AgentFixtureOptions;

export const identityFixture = (name: string, options: IdentityFixtureOptions = {}): Identity => {
  if (options.kind === "human") {
    return { admin: options.admin ?? false, createdAt: fixtureTime, kind: "human", name: nameOf(name) };
  }
  return agentFixture(name, options);
};
