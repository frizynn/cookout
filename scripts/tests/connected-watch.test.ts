import { expect, it } from "vitest";
import { isWatching, watchConnected } from "../lib/connected-watch.ts";

const NOTE = JSON.stringify({ watching: "http://127.0.0.1:1/v1/events" });
const NOTE_TIMEOUT_MS = 200;

function node(source: string): readonly string[] {
  return [process.execPath, "--input-type=module", "-e", source];
}

it("only a watching note with a URL counts as connected", { timeout: 1000 }, () => {
  expect.hasAssertions();

  expect(isWatching(NOTE)).toBe(true);
  expect(isWatching('{"unread":1}')).toBe(false);
  expect(isWatching('{"watching":true}')).toBe(false);
  expect(isWatching("not json")).toBe(false);
});

it("runs the connected step once the note is printed, then waits for the watch to finish", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const steps: string[] = [];
  const watched = await watchConnected({
    argv: node(`console.error('{"unread":1}'); console.error(${JSON.stringify(NOTE)}); console.log("heard");`),
    cwd: ".",
    noteTimeoutMs: 5000,
    onConnected: () => {
      steps.push("posted");
    },
  });

  expect(steps).toStrictEqual(["posted"]);
  expect(watched).toMatchObject({ connected: true, status: 0, stdout: "heard\n" });
  expect(watched.output).toContain(NOTE);
});

it("stops a watch that prints no note before the timeout, without the connected step", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const steps: string[] = [];
  const watched = await watchConnected({
    argv: node(`console.error('{"unread":1}'); setInterval(() => {}, 1000);`),
    cwd: ".",
    noteTimeoutMs: NOTE_TIMEOUT_MS,
    onConnected: () => {
      steps.push("posted");
    },
  });

  expect(steps).toStrictEqual([]);
  expect(watched).toMatchObject({ connected: false, notes: '{"unread":1}', status: null });
});
