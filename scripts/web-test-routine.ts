import type { TestProject } from "vitest/node";
import { startFakeRoutine } from "./web-test-server.ts";

declare module "vitest" {
  interface ProvidedContext {
    webReceiverUrl: string;
  }
}

const FIRST = 0;
const running: (() => Promise<void>)[] = [];

export async function setup(project: TestProject): Promise<void> {
  const routine = await startFakeRoutine();
  running.push(routine.stop);
  project.provide("webReceiverUrl", routine.value);
}

export async function teardown(): Promise<void> {
  await Promise.all(
    running.splice(FIRST).map(async (stop) => {
      await stop();
    }),
  );
}
