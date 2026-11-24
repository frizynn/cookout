import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { Screen, Shot, Theme } from "./lib/screenshots.ts";
import { field, list, parseJson, text } from "./lib/json.ts";
import { mkdirSync, mkdtempSync } from "node:fs";
import { screenshotOptions, takeScreenshots, withOlderHistory } from "./lib/screenshots.ts";
import type { DevCookout } from "./lib/dev-cookout.ts";
import { chromium } from "@playwright/test";
import { dropWatch } from "./lib/dropped-watch.ts";
import { moveClockForward } from "../app/modules/testing/index.ts";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { startDevCookout } from "./lib/dev-cookout.ts";
import { tmpdir } from "node:os";

interface Board {
  readonly closed: readonly number[];
  readonly dropped: string;
  readonly token: string;
  readonly server: DevCookout;
}

type Login = "admin" | "member";

const ARGUMENTS_FROM = 2;
const EXIT_FAILURE = 1;
const EXIT_SUCCESS = 0;
const NONE = 0;
const MAX_BUFFER = 67_108_864;
const RENDER_MS = 15_000;
const WIDE = { height: 800, width: 1280 };
const NARROW = { height: 900, width: 600 };
const LOGGED_IN_AS = "grace";
const DROPPED_AGENT = "triage-agent";
const CLOSED_IN_DEPLOYS = ["deployed", "rollbackCall"] as const;

function withEnv(variables: Readonly<Record<string, string>>, args: readonly string[]): string[] {
  return [...Object.entries(variables).map(([name, value]: readonly [string, string]) => `${name}=${value}`), ...args];
}

function tokenOf(identities: readonly unknown[], name: string): string {
  const found = identities.find((entry) => field(field(entry, "identity"), "name") === name);
  const token = text(field(found, "token"));
  if (typeof token !== "string") {
    throw new TypeError(`pnpm seed printed no token for ${name}`);
  }
  return token;
}

function seed(server: DevCookout): Board {
  const run = spawnSync(
    "env",
    withEnv({ COOKOUT_ALLOW_HUMAN: "1", COOKOUT_TOKEN: server.adminToken, COOKOUT_URL: server.url }, [
      process.execPath,
      "app/dev.ts",
      "seed",
    ]),
    { encoding: "utf8", maxBuffer: MAX_BUFFER },
  );
  if (run.status !== EXIT_SUCCESS) {
    throw new Error(`pnpm seed failed:\n${run.stdout}${run.stderr}`);
  }
  const seeded = parseJson(run.stdout);
  const identities = list(field(seeded, "identities")) ?? [];
  const closed = CLOSED_IN_DEPLOYS.map((name) => field(field(seeded, "messages"), name));
  const tokens = { dropped: tokenOf(identities, DROPPED_AGENT), token: tokenOf(identities, LOGGED_IN_AS) };
  return { closed: closed.filter((id) => typeof id === "number"), ...tokens, server };
}

function closeThreads({ closed, server, token }: Board): void {
  for (const id of closed) {
    const run = spawnSync(
      "env",
      withEnv({ COOKOUT_ALLOW_HUMAN: "1", COOKOUT_TOKEN: token, COOKOUT_URL: server.url }, [
        process.execPath,
        "app/main.ts",
        "thread",
        "close",
        String(id),
      ]),
      { encoding: "utf8", maxBuffer: MAX_BUFFER },
    );
    if (run.status !== EXIT_SUCCESS) {
      throw new Error(`cookout thread close ${String(id)} failed:\n${run.stdout}${run.stderr}`);
    }
  }
}

async function loggedIn(browser: Browser, { server, token }: Board, theme: Theme): Promise<BrowserContext> {
  const url = server.webUrl;
  const context = await browser.newContext({
    baseURL: url,
    storageState: {
      cookies: [],
      origins: [{ localStorage: [{ name: "cookout-theme", value: theme }], origin: url }],
    },
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Token").fill(token);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("list", { name: "Channels" }).waitFor({ timeout: RENDER_MS });
  await page.close();
  return context;
}

function viewportOf(shot: Shot): typeof WIDE {
  if (shot.screen.narrow === true) {
    return NARROW;
  }
  return WIDE;
}

async function interact(page: Page, shot: Shot): Promise<void> {
  if (typeof shot.screen.click === "string") {
    await page.getByRole("button", { exact: true, name: shot.screen.click }).click({ timeout: RENDER_MS });
  }
  if (typeof shot.screen.focusTimeOf === "string") {
    await page
      .getByRole("article")
      .filter({ hasText: shot.screen.focusTimeOf })
      .locator("time")
      .focus({ timeout: RENDER_MS });
  }
}

async function render(page: Page, shot: Shot): Promise<void> {
  await page.setViewportSize(viewportOf(shot));
  if (typeof shot.screen.history === "string") {
    await withOlderHistory({ history: shot.screen.history, page });
  }
  if (shot.screen.liveDown === true) {
    await page.route("**/v1/events?*", async (route) => {
      await route.abort();
    });
  }
  await page.goto(`/${shot.screen.hash}`);
  await interact(page, shot);
  await page.getByText(shot.screen.text).first().waitFor({ timeout: RENDER_MS });
}

function errorsOn(page: Page): readonly string[] {
  const errors: string[] = [];
  page.on("pageerror", ({ message }: Readonly<Error>) => {
    errors.push(message);
  });
  return errors;
}

async function screenshot(page: Page, shot: Shot, out: string): Promise<void> {
  const errors = errorsOn(page);
  try {
    await render(page, shot);
    await page.screenshot({ path: path.join(out, `${shot.screen.name}-${shot.theme}.png`) });
  } finally {
    await page.close();
  }
  if (errors.length > NONE) {
    throw new Error(`the page threw: ${errors.join("; ")}`);
  }
}

function loginOf(shot: Shot): Login {
  if (shot.screen.admin === true) {
    return "admin";
  }
  return "member";
}

interface Shooting {
  readonly board: Board;
  readonly browser: Browser;
  readonly contexts: ReadonlyMap<string, BrowserContext>;
  readonly out: string;
}

function boardFor(board: Board, login: Login): Board {
  if (login === "admin") {
    return { ...board, token: board.server.adminToken };
  }
  return board;
}

async function contextFor({ board, browser, contexts }: Shooting, shot: Shot): Promise<BrowserContext> {
  if (typeof shot.screen.daysLater === "number") {
    const fresh = await loggedIn(browser, boardFor(board, loginOf(shot)), shot.theme);
    return fresh;
  }
  const key = `${loginOf(shot)}-${shot.theme}`;
  const context = contexts.get(key);
  if (typeof context !== "object") {
    throw new TypeError(`no browser logged in as ${key}`);
  }
  return context;
}

function shooter(shooting: Shooting): (shot: Shot) => Promise<void> {
  return async (shot) => {
    const context = await contextFor(shooting, shot);
    await screenshot(await context.newPage(), shot, shooting.out);
  };
}

async function shootBoard(board: Board, screens: readonly Screen[], out: string): Promise<readonly string[]> {
  const browser = await chromium.launch();
  try {
    const admin = boardFor(board, "admin");
    const contexts = new Map<string, BrowserContext>([
      ["member-light", await loggedIn(browser, board, "light")],
      ["member-dark", await loggedIn(browser, board, "dark")],
      ["admin-light", await loggedIn(browser, admin, "light")],
      ["admin-dark", await loggedIn(browser, admin, "dark")],
    ]);
    const { clockUrl } = board.server;
    const failures = await takeScreenshots({
      moveClock: async (days) => {
        await moveClockForward({ clockUrl, days });
      },
      screens,
      shoot: shooter({ board, browser, contexts, out }),
    });
    return failures;
  } finally {
    await browser.close();
  }
}

function report(failures: readonly string[], out: string): void {
  for (const failure of failures) {
    console.error(failure);
  }
  console.log(out);
  if (failures.length > NONE) {
    process.exitCode = EXIT_FAILURE;
  }
}

async function prepared(server: DevCookout): Promise<Board> {
  const board = seed(server);
  closeThreads(board);
  const { adminToken, url } = server;
  await dropWatch({ adminToken, agent: DROPPED_AGENT, agentToken: board.dropped, url });
  return board;
}

async function shootFreshBoard(screens: readonly Screen[], out: string): Promise<readonly string[]> {
  const server = await startDevCookout({ COOKOUT_PRESENCE_GRACE_SECONDS: "1" });
  try {
    const board = await prepared(server);
    const failures = await shootBoard(board, screens, out);
    return failures;
  } finally {
    await server.stop();
  }
}

async function main(): Promise<void> {
  const options = screenshotOptions(process.argv.slice(ARGUMENTS_FROM));
  const out = options.out ?? mkdtempSync(path.join(tmpdir(), "cookout-screenshots-"));
  mkdirSync(out, { recursive: true });
  report(await shootFreshBoard(options.screens, out), out);
}

await main();
