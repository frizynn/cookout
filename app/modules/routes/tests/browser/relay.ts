import type { Fixtures, PlaywrightTestArgs } from "@playwright/test";
import { relayCutPath, relayRestorePath } from "../../../http/index.ts";

interface RelayOptions {
  readonly relayUrl: string;
}

interface Relay {
  readonly url: string;
  readonly cut: () => Promise<void>;
  readonly restore: () => Promise<void>;
}

interface RelayFixtures {
  readonly relay: Relay;
}

const relayFixtures: Fixtures<RelayFixtures & RelayOptions, object, PlaywrightTestArgs> = {
  relay: async ({ relayUrl, request }, provide) => {
    await provide({
      cut: async () => {
        await request.post(`${relayUrl}${relayCutPath}`);
      },
      restore: async () => {
        await request.post(`${relayUrl}${relayRestorePath}`);
      },
      url: relayUrl,
    });
  },
  relayUrl: ["", { option: true }],
};

export { type Relay, type RelayFixtures, type RelayOptions, relayFixtures };
