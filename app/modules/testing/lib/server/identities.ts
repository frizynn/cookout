import { expect } from "@effect/vitest";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { isIdentityName, isOwner } from "../../../identities/index.ts";

export const identityName = (value: string): IdentityName =>
  isIdentityName(value) ? value : expect.unreachable(`${value} is not an identity name`);

export type IdentityFixtureOptions = { readonly owner?: string; readonly admin?: boolean };

export const identityFixture = (name: string, options: IdentityFixtureOptions = {}): Identity => {
  const base = { name: identityName(name), admin: options.admin ?? false, createdAt: "2026-01-01T00:00:00.000Z" };
  if (options.owner === undefined) return base;
  return isOwner(options.owner)
    ? { ...base, owner: options.owner }
    : expect.unreachable(`${options.owner} is not an owner`);
};
