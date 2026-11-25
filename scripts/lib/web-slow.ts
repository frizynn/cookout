import { WEB_SLOW_VARIABLE } from "../../app/modules/config/index.ts";

interface SlowRun {
  readonly delayMs: number;
  readonly files: readonly string[];
}

type SlowArguments = (SlowRun & { readonly ok: true }) | { readonly ok: false };

const DEFAULT_DELAY_MS = 700;
const NONE = 0;
const WHOLE_NUMBER = /^\d+$/u;

function delayAndFiles(args: readonly string[]): SlowRun {
  const [first = "", ...rest] = args;
  if (WHOLE_NUMBER.test(first)) {
    return { delayMs: Number(first), files: rest };
  }
  return { delayMs: DEFAULT_DELAY_MS, files: args };
}

function slowArguments(args: readonly string[]): SlowArguments {
  const { delayMs, files } = delayAndFiles(args);
  if (delayMs === NONE || files.length === NONE) {
    return { ok: false };
  }
  return { delayMs, files, ok: true };
}

function slowRun({ delayMs, files }: SlowRun): readonly string[] {
  return [
    `${WEB_SLOW_VARIABLE}=${String(delayMs)}`,
    "node_modules/.bin/vitest",
    "run",
    "--project",
    "web",
    "--project",
    "web-clock",
    ...files,
  ];
}

export { slowArguments, slowRun };
