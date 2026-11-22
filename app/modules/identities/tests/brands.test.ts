import { expect, it } from "@effect/vitest";
import { isIdentityName, isOwner } from "../index.ts";

it("identity names are 1-64 lowercase letters, digits or '-'", () => {
  for (const name of ["auth-griller", "a", "agent-7", "x".repeat(64)]) {
    expect(isIdentityName(name)).toBe(true);
  }
  for (const name of ["", "Auth", "auth_griller", "auth griller", "@auth", "x".repeat(65)]) {
    expect(isIdentityName(name)).toBe(false);
  }
});

it("an owner is 1-100 characters", () => {
  for (const owner of ["m", "matt", "x".repeat(100)]) {
    expect(isOwner(owner)).toBe(true);
  }
  for (const owner of ["", "x".repeat(101)]) {
    expect(isOwner(owner)).toBe(false);
  }
});
