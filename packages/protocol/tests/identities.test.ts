import { expect, it } from "vitest";
import { identityNameSchema } from "../src/index.ts";

it("identity names are 1-64 lowercase letters, digits or '-'", () => {
  for (const name of ["auth-griller", "a", "agent-7", "x".repeat(64)]) {
    expect(identityNameSchema.safeParse(name).success).toBe(true);
  }
  for (const name of ["", "Auth", "auth_griller", "auth griller", "@auth", "x".repeat(65)]) {
    expect(identityNameSchema.safeParse(name).success).toBe(false);
  }
});
