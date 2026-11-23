type Theme = "light" | "dark";

interface Screen {
  readonly name: string;
  readonly hash: string;
  readonly click?: string;
  readonly text: string;
  readonly narrow?: boolean;
  readonly admin?: boolean;
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

const SCREENS: readonly Screen[] = [
  { hash: "#/inbox", name: "inbox", text: "Thanks, both of you." },
  { hash: "#/channels/general", name: "channel", text: "Lunch at 12:30." },
  { hash: "#/channels/general/threads/1", name: "thread", text: "Thanks, both of you." },
  { hash: "#/people", name: "people", text: "release-bot" },
  { hash: "#/people/release-bot", name: "profile", text: "Agent · owned by ada" },
  { admin: true, hash: "#/people/release-bot", name: "admin-profile", text: "Transfer to (a human's name)" },
  { admin: true, hash: "#/people/old-deploy-bot", name: "admin-deactivated", text: "Reactivate" },
  { hash: "#/settings", name: "settings", text: "System" },
  { click: "New channel", hash: "#/channels/general", name: "new-channel", text: "Lowercase letters" },
  { click: "Open the sidebar", hash: "#/channels/general", name: "narrow", narrow: true, text: "#deploys" },
  { click: "Collapse sidebar", hash: "#/channels/general", name: "collapsed", text: "Lunch at 12:30." },
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

export type { Screen, Shot, Theme };
export { screenshotOptions, takeScreenshots };
