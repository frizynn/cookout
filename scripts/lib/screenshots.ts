import { field, list, parseJson } from "./json.ts";
import type { Page } from "@playwright/test";

type Theme = "light" | "dark";

interface Screen {
  readonly name: string;
  readonly hash: string;
  readonly click?: string;
  readonly focusTimeOf?: string;
  readonly text: string;
  readonly narrow?: boolean;
  readonly admin?: boolean;
  readonly liveDown?: boolean;
  readonly nudge?: boolean;
  readonly offer?: boolean;
  readonly history?: "more" | "loading";
}

interface Shot {
  readonly screen: Screen;
  readonly theme: Theme;
}

interface ScreenshotOptions {
  readonly out?: string;
  readonly screens: readonly Screen[];
}

interface Flags {
  readonly only: readonly string[];
  readonly out?: string;
}

interface TakeScreenshots {
  readonly screens: readonly Screen[];
  readonly shoot: (shot: Shot) => Promise<void>;
}

const THEMES: readonly Theme[] = ["light", "dark"];
const NUDGE_TEXT = "Quiet for 3 days: close it, or follow up?";
const OFFER_TEXT = "@release-bot has had no activity for 30 days. Deactivate it?";
const OFFER_RAISED_AT = "2026-01-31T09:00:00.000Z";

const SCREENS: readonly Screen[] = [
  { hash: "#/inbox", name: "inbox", text: "Thanks, both of you." },
  { hash: "#/inbox", history: "more", name: "inbox-more", text: "Show earlier" },
  { hash: "#/inbox", name: "inbox-nudge", nudge: true, text: NUDGE_TEXT },
  { admin: true, hash: "#/inbox", name: "inbox-offer", offer: true, text: OFFER_TEXT },
  { click: "Show earlier", hash: "#/inbox", history: "loading", name: "inbox-loading", text: "Loading…" },
  { hash: "#/inbox/general/1", name: "inbox-thread", text: "Thanks, both of you." },
  { hash: "#/inbox/general/1", name: "inbox-narrow", narrow: true, text: "earlier replies" },
  { hash: "#/inbox/deploys", name: "inbox-channel", text: "Deployed 1.4.0." },
  { hash: "#/channels/general", name: "channel", text: "Lunch at 12:30." },
  { hash: "#/channels/general/threads/1", name: "thread", text: "Thanks, both of you." },
  {
    focusTimeOf: "@triage-agent can you post the failing run?",
    hash: "#/channels/general/threads/1",
    name: "receipt",
    text: "Not seen yet:",
  },
  { hash: "#/people", name: "people", text: "release-bot" },
  { hash: "#/people/release-bot", name: "profile", text: "Agent · owned by ada" },
  { hash: "#/people/triage-agent", name: "warning", text: "Went offline unexpectedly" },
  { admin: true, hash: "#/people/release-bot", name: "admin-profile", text: "Transfer to (a human's name)" },
  { admin: true, hash: "#/people/old-deploy-bot", name: "admin-deactivated", text: "Reactivate" },
  { admin: true, click: "Deactivate", hash: "#/people/release-bot", name: "confirm", text: "reactivate it later" },
  { hash: "#/settings", name: "settings", text: "System" },
  { click: "New channel", hash: "#/channels/general", name: "new-channel", text: "Lowercase letters" },
  { click: "Open the sidebar", hash: "#/channels/general", name: "narrow", narrow: true, text: "#deploys" },
  { hash: "#/channels/deploys", name: "closed-threads", text: "2 closed threads" },
  { hash: "#/channels/deploys/threads/8", name: "closed-thread", text: "Rolled back to 1.4.1." },
  { hash: "#/threads/all", name: "open-threads", text: "Lunch at 12:30." },
  { click: "Collapse sidebar", hash: "#/channels/general", name: "collapsed", text: "Lunch at 12:30." },
  { hash: "#/channels/general", liveDown: true, name: "reconnecting", text: "Reconnecting…" },
];

const NONE = 0;

function screenNamed(name: string): Screen {
  const screen = SCREENS.find((candidate) => candidate.name === name);
  if (typeof screen !== "object") {
    const names = SCREENS.map((candidate) => candidate.name).join(", ");
    throw new Error(`Unknown screen ${name}: pick from ${names}.`);
  }
  return screen;
}

function withFlag(flags: Flags, flag: string, value: string | null): Flags {
  if (flag !== "--only" && flag !== "--out") {
    throw new Error(`Unknown flag ${flag}: use --only <screen> or --out <dir>.`);
  }
  if (value === null) {
    throw new Error(`${flag} needs a value.`);
  }
  if (flag === "--out") {
    return { ...flags, out: value };
  }
  return { ...flags, only: [...flags.only, screenNamed(value).name] };
}

function flagsOf(args: readonly string[], flags: Flags): Flags {
  const [flag, value, ...rest] = args;
  if (typeof flag !== "string") {
    return flags;
  }
  return flagsOf(rest, withFlag(flags, flag, value ?? null));
}

function screensNamed(only: readonly string[]): readonly Screen[] {
  if (only.length === NONE) {
    return SCREENS;
  }
  return SCREENS.filter((screen) => only.includes(screen.name));
}

function screenshotOptions(args: readonly string[]): ScreenshotOptions {
  const { only, ...out } = flagsOf(args, { only: [] });
  return { ...out, screens: screensNamed(only) };
}

function reasonOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function failureOf(shoot: TakeScreenshots["shoot"], shot: Shot): Promise<readonly string[]> {
  try {
    await shoot(shot);
    return [];
  } catch (error) {
    return [`${shot.screen.name}-${shot.theme}: ${reasonOf(error)}`];
  }
}

async function failuresOf(shoot: TakeScreenshots["shoot"], shots: readonly Shot[]): Promise<readonly string[]> {
  const [shot, ...rest] = shots;
  if (typeof shot !== "object") {
    return [];
  }
  const failure = await failureOf(shoot, shot);
  return [...failure, ...(await failuresOf(shoot, rest))];
}

async function takeScreenshots({ screens, shoot }: TakeScreenshots): Promise<readonly string[]> {
  const shots = screens.flatMap((screen) => THEMES.map((theme) => ({ screen, theme })));
  const failures = await failuresOf(shoot, shots);
  return failures;
}

const PAGE_NONE = 0;
const PAGE_ONE = 1;

interface OlderHistory {
  readonly page: Page;
  readonly history: NonNullable<Screen["history"]>;
}

async function withOlderHistory({ history, page }: OlderHistory): Promise<void> {
  let pages = PAGE_NONE;
  await page.route("**/v1/inbox/history*", async (route) => {
    pages += PAGE_ONE;
    if (history === "loading" && pages > PAGE_ONE) {
      return;
    }
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ body: body.replace('"hasMore":false', '"hasMore":true'), response });
  });
}

function nudgeOn(item: unknown): unknown {
  const parent = field(item, "parent");
  return {
    channel: field(item, "channel"),
    id: 1,
    kind: "first",
    parent,
    raisedAt: field(parent, "createdAt"),
    text: NUDGE_TEXT,
  };
}

function withNudgeIn(body: string): string {
  const inbox = parseJson(body);
  const [item] = list(field(inbox, "items")) ?? [];
  const nudges = JSON.stringify([nudgeOn(item)]);
  return body.replace('"nudges":[]', `"nudges":${nudges}`);
}

function withOfferIn(body: string): string {
  const raisedAt = OFFER_RAISED_AT;
  const identity = { admin: false, createdAt: raisedAt, kind: "agent", name: "release-bot", owner: "ada" };
  const offer = { cleared: false, id: 1, identity, quietDays: 30, raisedAt, text: OFFER_TEXT };
  return body.replace('"deactivationOffers":[]', `"deactivationOffers":${JSON.stringify([offer])}`);
}

function withEntriesIn(screen: Screen, body: string): string {
  let changed = body;
  if (screen.nudge === true) {
    changed = withNudgeIn(changed);
  }
  if (screen.offer === true) {
    changed = withOfferIn(changed);
  }
  return changed;
}

interface InboxEntries {
  readonly page: Page;
  readonly screen: Screen;
}

async function withInboxEntries({ page, screen }: InboxEntries): Promise<void> {
  if (screen.nudge !== true && screen.offer !== true) {
    return;
  }
  await page.route("**/v1/inbox", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ body: withEntriesIn(screen, await response.text()), response });
  });
}

export type { Screen, Shot, Theme };
export { screenshotOptions, takeScreenshots, withInboxEntries, withOlderHistory };
