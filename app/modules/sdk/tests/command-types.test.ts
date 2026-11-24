import type { BuiltInCommand, Command, RegisteredCommand } from "../index.ts";
import { expect, expectTypeOf, it } from "vitest";

it("the SDK names both kinds of Command, so a caller narrows a Command to each", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const narrowed = [
    expectTypeOf<Command>().extract<{ readonly builtIn: true }>().toEqualTypeOf<BuiltInCommand>(),
    expectTypeOf<Command>().exclude<{ readonly builtIn: true }>().toEqualTypeOf<RegisteredCommand>(),
  ];

  expect(narrowed).toStrictEqual([true, true]);
});
