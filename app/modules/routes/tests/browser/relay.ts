import type { Fixtures, PlaywrightTestArgs } from "@playwright/test";
import { relayCutPath, relayOpenPath, relayRestorePath } from "../../../http/index.ts";

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

function urlIn(opened: unknown): string {
  if (typeof opened === "object" && opened !== null && "url" in opened && typeof opened.url === "string") {
    return opened.url;
  }
  throw new TypeError("the relay opened no relay");
}

const relayFixtures: Fixtures<RelayFixtures & RelayOptions, object, PlaywrightTestArgs> = {
  relay: async ({ relayUrl, request }, provide) => {
    const response = await request.post(`${relayUrl}${relayOpenPath}`);
    const opened: unknown = await response.json();
    const url = urlIn(opened);
    await provide({
      cut: async () => {
        await request.post(`${url}${relayCutPath}`);
      },
      restore: async () => {
        await request.post(`${url}${relayRestorePath}`);
      },
      url,
    });
  },
  relayUrl: ["", { option: true }],
};

export { type Relay, type RelayFixtures, type RelayOptions, relayFixtures };
