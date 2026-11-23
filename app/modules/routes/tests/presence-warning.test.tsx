import { expect, it } from "vitest";
import { offline, online, openedBy, profileDot, rowDot, warned } from "./presence.ts";
import { inProfile } from "./regions.ts";
import { newIdentity } from "./identities.ts";

const WARNING = "Offline, went offline unexpectedly";
const SEEN = "Offline, last seen just now";

interface Owned {
  readonly owner: string;
  readonly agent: string;
}

async function watchingAgent({ agent, owner }: Owned): Promise<() => Promise<void>> {
  await newIdentity({ kind: "human", name: owner });
  const bot = await newIdentity({ kind: "agent", name: agent, owner });
  const events = await bot.client.watch();
  return events.close;
}

it("as the owner, an agent that drops shows the warning on its dot and profile, and reconnecting clears it", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const owner = await newIdentity({ kind: "human", name: "web-warning-owner" });
  const bot = await newIdentity({ kind: "agent", name: "web-warning-bot", owner: "web-warning-owner" });
  const events = await bot.client.watch();
  await openedBy({ client: owner.client, hash: "#/people/web-warning-bot" });
  await inProfile().findByText("Online · watching");
  await events.close();

  await expect(
    Promise.all([
      rowDot({ label: WARNING, who: "web-warning-bot" }),
      profileDot({ label: WARNING, who: "web-warning-bot" }),
      inProfile().findByText("Went offline unexpectedly just now: connection lost"),
    ]),
  ).resolves.toStrictEqual([warned(WARNING), warned(WARNING), expect.anything()]);

  await bot.client.watch();

  await expect(profileDot({ label: "Online", who: "web-warning-bot" })).resolves.toStrictEqual(online());
});

it("as the owner, an agent that dropped before the page opened shows the warning from the first read", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const owner = await newIdentity({ kind: "human", name: "web-warning-early-owner" });
  const bot = await newIdentity({ kind: "agent", name: "web-warning-early-bot", owner: "web-warning-early-owner" });
  const events = await bot.client.watch();
  await events.close();
  await openedBy({ client: owner.client, hash: "#/people/web-warning-early-bot" });

  await expect(profileDot({ label: WARNING, who: "web-warning-early-bot" })).resolves.toStrictEqual(warned(WARNING));
});

it("as another person, an agent that drops shows the plain offline ring and no warning", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const drop = await watchingAgent({ agent: "web-warning-other-bot", owner: "web-warning-other-owner" });
  const reader = await newIdentity({ kind: "human", name: "web-warning-other-reader" });
  await openedBy({ client: reader.client, hash: "#/people/web-warning-other-bot" });
  await inProfile().findByText("Online · watching");
  await drop();

  await expect(
    Promise.all([
      profileDot({ label: SEEN, who: "web-warning-other-bot" }),
      inProfile().findByText("Offline: connection lost · last seen just now"),
    ]),
  ).resolves.toStrictEqual([offline(SEEN), expect.anything()]);
});
