import type { Fixtures } from "@playwright/test";
import { moveClockForward } from "../../../testing/index.ts";

interface ClockOptions {
  readonly clockUrl: string;
}

interface ClockFixtures {
  readonly daysPass: (days: number) => Promise<void>;
}

const clockFixtures: Fixtures<ClockFixtures & ClockOptions> = {
  clockUrl: ["", { option: true }],
  daysPass: async ({ clockUrl }, provide) => {
    await provide(async (days) => {
      await moveClockForward({ clockUrl, days });
    });
  },
};

export { type ClockFixtures, type ClockOptions, clockFixtures };
