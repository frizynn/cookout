import { landThroughQueue, queueRequired } from "./merge-queue.ts";
import type { Queue } from "./merge-push.ts";
import type { Step } from "./merge-steps.ts";
import { ciGreen } from "./ci-gate.ts";

interface Wait {
  readonly args: readonly string[];
  readonly base: readonly string[];
  readonly log: (line: string) => void;
  readonly rerunRed?: boolean;
  readonly subject: string;
  readonly vouchedBy?: string;
}

const WAIT_MS = 30_000;
const APPEAR_WAITS = 20;
const RUN_WAITS = 40;
const SLEEP_SLOT = 0;

function sleep(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)), SLEEP_SLOT, SLEEP_SLOT, WAIT_MS);
}

function waitForCi({ args, base, log, rerunRed = false, subject, vouchedBy = "" }: Wait): Step {
  return ciGreen({
    appear: APPEAR_WAITS,
    args,
    base,
    cwd: process.cwd(),
    event: "push",
    gh: ["gh"],
    log,
    polls: RUN_WAITS,
    rerunRed,
    sleep,
    subject,
    vouchedBy,
  });
}

function queueOf(log: (line: string) => void): Queue {
  const options = { appear: APPEAR_WAITS, cwd: process.cwd(), gh: ["gh"], log, polls: RUN_WAITS, sleep };
  const required = queueRequired(options);
  return { land: (landing) => landThroughQueue({ landing, options: { ...options, required } }), required };
}

export { queueOf, waitForCi };
