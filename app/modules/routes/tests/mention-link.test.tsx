import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

const CHANNEL = "web-mention-link";
const NONE = 0;

async function profileHeading(): Promise<string> {
  const panel = await screen.findByRole("complementary", { name: "Profile" });
  const heading = await within(panel).findByRole("heading", { level: 3 });
  return heading.textContent;
}

async function openMentions(): Promise<() => void> {
  const reader = await newIdentity({ kind: "human", name: `${CHANNEL}-reader` });
  await newIdentity({ kind: "agent", name: `${CHANNEL}-gone`, owner: `${CHANNEL}-reader` });
  await adminClient().createChannel({ name: CHANNEL });
  await adminClient().createMessage({
    channel: CHANNEL,
    text: `Ask **@${CHANNEL}-reader** or @${CHANNEL}-gone, not [@${CHANNEL}-reader](https://example.com)`,
  });
  await adminClient().deactivateIdentity(`${CHANNEL}-gone`);
  const close = openAt({ client: reader.client, hash: `#/channels/${CHANNEL}` });
  await inPane().findByRole("link", { name: `@${CHANNEL}-gone` });
  return close;
}

function hrefsOf(name: string): readonly (string | null)[] {
  const hrefs: (string | null)[] = [];
  for (const link of inPane().getAllByRole("link", { name })) {
    hrefs.push(link.getAttribute("href"));
  }
  return hrefs;
}

it("clicking a mention in a message opens that identity's profile panel, deactivated or not", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const close = await openMentions();

  expect([hrefsOf(`@${CHANNEL}-reader`), document.querySelectorAll("a a").length]).toStrictEqual([
    [`#/channels/${CHANNEL}?profile=${CHANNEL}-reader`, "https://example.com"],
    NONE,
  ]);

  fireEvent.click(inPane().getByRole("link", { name: `@${CHANNEL}-gone` }));
  await waitFor(async () => {
    await expect(profileHeading()).resolves.toMatch(`${CHANNEL}-gone(deactivated)`);
  });

  close();
});
