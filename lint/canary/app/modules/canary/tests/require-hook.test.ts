import { expect, it, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

layer(Layer.empty)((shared) => {
  shared.effect("shares one layer", () => Effect.sync(() => expect(true).toBe(true)));
});

it("stands alone", () => {
  expect(true).toBe(true);
});
