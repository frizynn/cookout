import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { Screen, Shot, Theme, ThemePass } from "./lib/screenshots.ts";
import { field, list, parseJson, text } from "./lib/json.ts";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { screenshotOptions, takeScreenshots, withNudge, withOlderHistory } from "./lib/screenshots.ts";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { createInterface } from "node:readline";
import { dropWatch } from "./lib/dropped-watch.ts";
import { once } from "node:events";
import path from "node:path";
import { tmpdir } from "node:os";

interface Server {
  readonly stop: () => Promise<void>;
  readonly url: string;
}

interface Board {
  readonly closed: readonly number[];
  readonly dropped: string;
  readonly token: string;
  readonly url: string;
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
const ADMIN_TOKEN = "screenshots-admin-token-0123456789abcdef0123456789";
const LOGGED_IN_AS = "grace";
const DROPPED_AGENT = "triage-agent";
const CLOSED_IN_DEPLOYS = ["deployed", "rollbackCall"] as const;

function withEnv(variables: Readonly<Record<string, string>>, args: readonly string[]): string[] {
  return [...Object.entries(variables).map(([name, value]: readonly [string, string]) => `${name}=${value}`), ...args];
}

function build(): void {
  const run = spawnSync("pnpm", ["-s", "build"], { encoding: "utf8", maxBuffer: MAX_BUFFER });
  if (run.status !== EXIT_SUCCESS) {
    throw new Error(`pnpm build failed:\n${run.stdout}${run.stderr}`);
  }
}

async function listeningUrl(lines: AsyncIterable<string>): Promise<string> {
  for await (const line of lines) {
    const url = text(field(parseJson(line), "listening"));
    if (typeof url === "string") {
      return url;
    }
  }
  throw new Error("cookout serve stopped before printing its address");
}

async function startServer(database: string): Promise<Server> {
  const server = spawn(
    "env",
    withEnv({ COOKOUT_ADMIN_TOKEN: ADMIN_TOKEN, COOKOUT_PRESENCE_GRACE_SECONDS: "1" }, [
      process.execPath,
      "dist/main.js",
      "serve",
      "--port",
      "0",
      "--host",
      "127.0.0.1",
      "--db",
      database,
    ]),
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  async function stop(): Promise<void> {
    if (server.exitCode === null) {
      server.kill("SIGINT");
      await once(server, "exit");
    }
  }
  try {
    const url = await listeningUrl(createInterface({ input: server.stdout }));
    return { stop, url };
  } catch (error) {
    await stop();
    throw error;
  }
}

function tokenOf(identities: readonly unknown[], name: string): string {
  const found = identities.find((entry) => field(field(entry, "identity"), "name") === name);
  const token = text(field(found, "token"));
  if (typeof token !== "string") {
    throw new TypeError(`pnpm seed printed no token for ${name}`);
  }
  return token;
}

function seed(url: string): Board {
  const run = spawnSync(
    "env",
    withEnv({ COOKOUT_ALLOW_HUMAN: "1", COOKOUT_TOKEN: ADMIN_TOKEN, COOKOUT_URL: url }, [
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
  return { closed: closed.filter((id) => typeof id === "number"), ...tokens, url };
}

function closeThreads({ closed, token, url }: Board): void {
  for (const id of closed) {
    const run = spawnSync(
      "env",
      withEnv({ COOKOUT_ALLOW_HUMAN: "1", COOKOUT_TOKEN: token, COOKOUT_URL: url }, [
        process.execPath,
        "dist/main.js",
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

async function loggedIn(browser: Browser, { token, url }: Board, theme: Theme): Promise<BrowserContext> {
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
  if (shot.screen.nudge === true) {
    await withNudge(page);
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

type NewPage = (login: Login) => Promise<Page>;

function shooter(newPage: NewPage, out: string): (shot: Shot) => Promise<void> {
  return async (shot) => {
    await screenshot(await newPage(loginOf(shot)), shot, out);
  };
}

async function loggedInBoth(browser: Browser, board: Board, theme: Theme): Promise<NewPage> {
  const admin = await loggedIn(browser, { ...board, token: ADMIN_TOKEN }, theme);
  const member = await loggedIn(browser, board, theme);
  return async (login) => {
    const page = await { admin, member }[login].newPage();
    return page;
  };
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

async function prepared(url: string): Promise<Board> {
  const board = seed(url);
  closeThreads(board);
  await dropWatch({ adminToken: ADMIN_TOKEN, agent: DROPPED_AGENT, agentToken: board.dropped, url });
  return board;
}

function freshBoards(browser: Browser, out: string): (theme: Theme) => Promise<ThemePass> {
  return async (theme) => {
    const folder = mkdtempSync(path.join(tmpdir(), "cookout-screenshots-db-"));
    function removeFolder(): void {
      rmSync(folder, { force: true, recursive: true });
    }
    const server = await startServer(path.join(folder, "cookout.db")).catch((error: unknown) => {
      removeFolder();
      throw error;
    });
    async function stop(): Promise<void> {
      await server.stop();
      removeFolder();
    }
    try {
      const newPage = await loggedInBoth(browser, await prepared(server.url), theme);
      return { shoot: shooter(newPage, out), stop };
    } catch (error) {
      await stop();
      throw error;
    }
  };
}

async function shootFreshBoards(screens: readonly Screen[], out: string): Promise<readonly string[]> {
  const browser = await chromium.launch();
  try {
    const failures = await takeScreenshots({ freshBoard: freshBoards(browser, out), screens });
    return failures;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const options = screenshotOptions(process.argv.slice(ARGUMENTS_FROM));
  const out = options.out ?? mkdtempSync(path.join(tmpdir(), "cookout-screenshots-"));
  mkdirSync(out, { recursive: true });
  build();
  report(await shootFreshBoards(options.screens, out), out);
}

await main();
