import { expect, it } from "vitest";
import { rollbackImage } from "../lib/rollback-image.ts";

const OLD = "registry.fly.io/cookout:deployment-01OLD";
const NEW = "registry.fly.io/cookout:deployment-01NEW";
const EARLIER = "2026-11-23T10:00:00Z";
const LATER = "2026-11-23T11:00:00Z";

function machine(image: string, state: string, updatedAt: string): unknown {
  return { config: { image }, id: `machine-${updatedAt}`, state, updated_at: updatedAt };
}

function pick(machines: readonly unknown[]): string {
  return rollbackImage(JSON.stringify(machines));
}

it("rolls back to the image the only machine runs", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(pick([machine(OLD, "started", EARLIER)])).toBe(OLD);
});

it("rolls back to a started machine's image over a stopped machine's", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(pick([machine(NEW, "stopped", LATER), machine(OLD, "started", EARLIER)])).toBe(OLD);
});

it("rolls back to the most recently updated machine's image when none is started", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(pick([machine(OLD, "stopped", EARLIER), machine(NEW, "stopped", LATER)])).toBe(NEW);
});

it("rolls back to the most recently updated started machine's image", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(pick([machine(OLD, "started", EARLIER), machine(NEW, "started", LATER)])).toBe(NEW);
});

it("has nothing to roll back to when the app has no machine", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(pick([])).toBe("");
});

it("has nothing to roll back to when no machine names an image", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(pick([{ config: {}, id: "m", state: "started" }, { id: "n" }])).toBe("");
});

it("has nothing to roll back to when flyctl printed something other than a machine list", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(rollbackImage("Error: not authorized")).toBe("");
  expect(rollbackImage(JSON.stringify({ error: "not found" }))).toBe("");
});
