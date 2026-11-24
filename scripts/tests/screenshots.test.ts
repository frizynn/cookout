import { expect, it } from "vitest";
import { screenshotOptions, takeScreenshots } from "../lib/screenshots.ts";
import type { Shot } from "../lib/screenshots.ts";

const SCREENS = screenshotOptions([]).screens;

function recordingShooter(note: (name: string) => void, broken: string): (shot: Shot) => Promise<void> {
  return async (shot) => {
    await Promise.resolve();
    const name = `${shot.screen.name}-${shot.theme}`;
    if (name === broken) {
      throw new Error("Timed out waiting for Thanks, both of you.");
    }
    note(name);
  };
}

interface Recorder {
  readonly note: (name: string) => void;
  readonly taken: readonly string[];
}

function recorder(): Recorder {
  const taken: string[] = [];
  return {
    note: (name): void => {
      taken.push(name);
    },
    taken,
  };
}

function pairs(): readonly string[] {
  return SCREENS.flatMap((screen) => [`${screen.name}-light`, `${screen.name}-dark`]);
}

it("takes each standard screen in light and then in dark before the next screen", { timeout: 2000 }, async () => {
  expect.hasAssertions();

  const { note, taken } = recorder();
  const failures = await takeScreenshots({ screens: SCREENS, shoot: recordingShooter(note, "") });

  expect([failures, taken, SCREENS.map((screen) => screen.name)]).toStrictEqual([
    [],
    pairs(),
    [
      "inbox",
      "inbox-more",
      "inbox-nudge",
      "inbox-offer",
      "inbox-loading",
      "inbox-thread",
      "inbox-narrow",
      "inbox-channel",
      "channel",
      "thread",
      "receipt",
      "people",
      "profile",
      "warning",
      "admin-profile",
      "admin-deactivated",
      "confirm",
      "settings",
      "new-channel",
      "narrow",
      "closed-threads",
      "closed-thread",
      "open-threads",
      "collapsed",
      "reconnecting",
    ],
  ]);
});

it("a screen that fails to render is reported, and the others are still taken", { timeout: 2000 }, async () => {
  expect.hasAssertions();

  const { note, taken } = recorder();
  const failures = await takeScreenshots({ screens: SCREENS, shoot: recordingShooter(note, "thread-dark") });

  expect([failures, taken]).toStrictEqual([
    ["thread-dark: Timed out waiting for Thanks, both of you."],
    pairs().filter((name) => name !== "thread-dark"),
  ]);
});

it("--only picks screens by name and --out names the folder", { timeout: 2000 }, () => {
  expect.hasAssertions();

  const options = screenshotOptions(["--only", "thread", "--only", "narrow", "--out", "/tmp/shots"]);

  expect(options).toStrictEqual({
    out: "/tmp/shots",
    screens: SCREENS.filter((screen) => ["thread", "narrow"].includes(screen.name)),
  });
});

it("with no flags it takes every screen into no named folder", { timeout: 2000 }, () => {
  expect.hasAssertions();
  expect(Object.keys(screenshotOptions([]))).toStrictEqual(["screens"]);
});

it("an unknown screen or flag, or a flag with no value, is refused", { timeout: 2000 }, () => {
  expect.hasAssertions();
  expect(() => screenshotOptions(["--only", "nope"])).toThrow(
    "Unknown screen nope: pick from inbox, inbox-more, inbox-nudge, inbox-offer, inbox-loading, inbox-thread, inbox-narrow, inbox-channel, channel, thread, receipt, people, profile, warning, admin-profile, admin-deactivated, confirm, settings, new-channel, narrow, closed-threads, closed-thread, open-threads, collapsed, reconnecting.",
  );
  expect(() => screenshotOptions(["--theme", "dark"])).toThrow(
    "Unknown flag --theme: use --only <screen> or --out <dir>.",
  );
  expect(() => screenshotOptions(["--out"])).toThrow("--out needs a value.");
});
