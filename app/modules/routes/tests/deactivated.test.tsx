import { adminClient, clientWith, newIdentity, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";

const ONE = 1;

interface Crew {
  readonly human: CookoutClient;
  readonly bot: CookoutClient;
}

async function crewOf(prefix: string): Promise<Crew> {
  const human = await newIdentity({ kind: "human", name: `${prefix}-human` });
  const bot = await newIdentity({ kind: "agent", name: `${prefix}-bot`, owner: `${prefix}-human` });
  await human.client.setDisplayName(`${prefix}-bot`, "Release Bot");
  return { bot: bot.client, human: human.client };
}

function textsOf(elements: () => readonly HTMLElement[]): readonly string[] {
  const texts: string[] = [];
  for (const element of elements()) {
    texts.push(element.textContent);
  }
  return texts;
}

function rowNames(): readonly string[] {
  return textsOf(() => within(screen.getByRole("list", { name: "Identities" })).getAllByRole("link"));
}

async function profileHeading(): Promise<string> {
  const panel = await screen.findByRole("complementary", { name: "Profile" });
  const heading = await within(panel).findByRole("heading", { level: 3 });
  return heading.textContent;
}

async function deactivateFromProfile(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
  fireEvent.click(await screen.findByRole("button", { name: `Deactivate @${name}` }));
  await waitFor(async () => {
    await expect(profileHeading()).resolves.toBe(`${name}(deactivated)`);
  });
}

it("a deactivated author keeps their display name on their messages, marked (deactivated)", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { bot } = await crewOf("web-off-author");
  await adminClient().createChannel({ name: "web-off-author" });
  await bot.createMessage({ channel: "web-off-author", text: "Deployed" });
  await adminClient().deactivateIdentity("web-off-author-bot");
  const close = openAt({ client: adminClient(), hash: "#/channels/web-off-author" });
  const messages = await screen.findByRole("list", { name: "Messages" });

  await waitFor(() => {
    expect(within(messages).getByRole("listitem").textContent).toMatch(
      /Release Bot@web-off-author-bot\(deactivated\)agent.*Deployed/u,
    );
  });

  close();
});

it("people leaves deactivated identities out until Show deactivated is pressed", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await crewOf("web-off-people");
  await adminClient().deactivateIdentity("web-off-people-bot");
  const close = openAt({ client: adminClient(), hash: "#/people" });
  fireEvent.change(await screen.findByLabelText("Filter by name"), { target: { value: "web-off-people" } });
  await waitFor(() => {
    expect(rowNames()).toHaveLength(ONE);
  });
  const hidden = rowNames();
  fireEvent.click(screen.getByRole("button", { name: "Show deactivated" }));

  expect([hidden, rowNames()]).toStrictEqual([
    ["web-off-people-humanHuman"],
    [
      "Release Bot@web-off-people-bot(deactivated)agentAgent · owned by web-off-people-human",
      "web-off-people-humanHuman",
    ],
  ]);

  close();
});

it("an admin deactivates and reactivates from a profile, and the fresh token shows once", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await crewOf("web-off-profile");
  const close = openAt({ client: adminClient(), hash: "#/people/web-off-profile-human" });
  await deactivateFromProfile("web-off-profile-human");
  const { identities } = await adminClient().listIdentities({ include: "deactivated" });
  fireEvent.click(screen.getByRole("button", { name: "Reactivate" }));
  const token = await screen.findByLabelText("New Identity token");
  const { identity } = await clientWith(token.textContent).whoami();

  expect([
    identities.filter((each) => each.name.startsWith("web-off-profile")).map((each) => each.deactivated),
    identity.name,
    await profileHeading(),
  ]).toStrictEqual([[true, true], "web-off-profile-human", "web-off-profile-human"]);

  close();
});

it("the @ suggestions leave out deactivated identities", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await crewOf("web-off-suggest");
  await adminClient().deactivateIdentity("web-off-suggest-bot");
  await adminClient().createChannel({ name: "web-off-suggest" });
  const close = openAt({ client: adminClient(), hash: "#/channels/web-off-suggest" });
  fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "@web-off-suggest" } });
  const list = await screen.findByRole("list", { name: "Mention suggestions" });

  expect(textsOf(() => within(list).getAllByRole("button"))).toStrictEqual(["@web-off-suggest-human"]);

  close();
});
