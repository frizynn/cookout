import { expect, it } from "vitest";
import { loadReport, osReading } from "../lib/machine-load.ts";

const CORES = 10;
const BUSY = 14.5;
const QUIET = 3.25;
const NONE = 0;

it("prints the load average and core count, with no warning when the load is within the cores", {
  timeout: 5000,
}, () => {
  expect.hasAssertions();

  expect(loadReport(() => ({ cores: CORES, load: QUIET }))).toStrictEqual({
    line: "check: load average 3.25 over the last minute, on 10 cores.",
    warning: "",
  });
});

it("warns when the load average is above the core count", { timeout: 5000 }, () => {
  expect.hasAssertions();

  expect(loadReport(() => ({ cores: CORES, load: BUSY })).warning).toBe(
    "check: WARNING: the load average (14.50) is above the core count (10), so browser tests may time out at random. A timeout in a file you didn't touch is likely load, not your change.",
  );
});

it("reads the machine's own load and core count", { timeout: 5000 }, () => {
  expect.hasAssertions();

  const { cores, load } = osReading();

  expect([cores > NONE, load >= NONE]).toStrictEqual([true, true]);
});
