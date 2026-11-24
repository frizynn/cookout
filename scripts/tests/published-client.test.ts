import { expect, it } from "vitest";
import { optedOutSteps, withoutField } from "../lib/published-client.ts";

const steps = ["join", "post", "deactivate"];
const version = "0.2.1";
const reason = "deactivate's answer drops agents before 0.2.1's clients accept it (#999).";

it("no opt-outs runs every step", { timeout: 1000 }, () => {
  expect.hasAssertions();

  expect(optedOutSteps({ optOuts: [], steps, version })).toStrictEqual({ ok: true, value: new Set() });
});

it("an opt-out with a date and a reason skips its step for the published version", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const optOuts = [{ date: "2026-11-24", reason, step: "deactivate", version }];

  expect(optedOutSteps({ optOuts, steps, version })).toStrictEqual({ ok: true, value: new Set(["deactivate"]) });
});

it.each([
  ["no date", { reason, step: "deactivate", version }, "a date (YYYY-MM-DD)"],
  ["a date that is not YYYY-MM-DD", { date: "24 Nov", reason, step: "deactivate", version }, "a date (YYYY-MM-DD)"],
  ["no reason", { date: "2026-11-24", step: "deactivate", version }, "a reason"],
  ["an empty reason", { date: "2026-11-24", reason: " ", step: "deactivate", version }, "a reason"],
  ["an unknown step", { date: "2026-11-24", reason, step: "leave", version }, "names no step"],
])(
  "an opt-out with %s is refused",
  { timeout: 1000 },
  (_name: string, optOut: Readonly<Record<string, string>>, refusal: string) => {
    expect.hasAssertions();

    const outcome = optedOutSteps({ optOuts: [optOut], steps, version });

    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).toContain(refusal);
  },
);

it("an opt-out for an older published version is stale and refused", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const outcome = optedOutSteps({
    optOuts: [{ date: "2026-11-24", reason, step: "deactivate", version: "0.2.0" }],
    steps,
    version,
  });

  expect(outcome.ok).toBe(false);
  expect(JSON.stringify(outcome)).toContain("0.2.1 is published now: remove it");
});

it("opt-outs that are not a list are refused", { timeout: 1000 }, () => {
  expect.hasAssertions();

  expect(optedOutSteps({ optOuts: {}, steps, version }).ok).toBe(false);
});

it("the canary drops a field from a JSON answer and keeps the rest", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const body = JSON.stringify({ identity: { name: "a" }, ok: true });

  expect(JSON.parse(withoutField({ body, name: "identity" }))).toStrictEqual({ ok: true });
  expect(withoutField({ body: "not json", name: "identity" })).toBe("not json");
});
