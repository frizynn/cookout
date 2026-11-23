import { adminClient, clientWith, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, getDefaultNormalizer, screen, within } from "@testing-library/react";
import type { Message } from "../../sdk/index.ts";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

async function threadIn(channel: string): Promise<Message> {
  await adminClient().createChannel({ name: channel });
  const { message } = await adminClient().createMessage({ channel, text: "The parent" });
  return message;
}

function hashOf(parent: Message): string {
  return `#/channels/${parent.channel}/threads/${String(parent.id)}`;
}

async function typeInReply(text: string): Promise<HTMLElement> {
  const box = await screen.findByLabelText("Reply");
  fireEvent.change(box, { target: { value: text } });
  return box;
}

async function suggested(): Promise<readonly (string | null)[]> {
  const list = await screen.findByRole("list", { name: "Mention suggestions" });
  const shown: (string | null)[] = [];
  for (const button of within(list).getAllByRole("button")) {
    shown.push(button.textContent);
  }
  return shown;
}

it("typing @ and a prefix suggests the identities whose names start with it, humans and agents", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "human", name: "suggest-ada" });
  await newIdentity({ kind: "agent", name: "suggest-agent" });
  await newIdentity({ kind: "human", name: "other-grace" });
  const parent = await threadIn("web-composer-suggests");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });

  await typeInReply("Ping @sugg");

  await expect(suggested()).resolves.toStrictEqual(["@suggest-ada", "@suggest-agent"]);

  close();
});

it("choosing a suggestion puts the mention in the reply box in place of the prefix", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "human", name: "chosen-linus" });
  const parent = await threadIn("web-composer-chooses");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });

  const box = await typeInReply("Ping @chosen-l");
  await suggested();
  fireEvent.click(inPane().getByRole("button", { name: "@chosen-linus" }));

  expect([
    screen.queryByDisplayValue("Ping @chosen-linus ", { normalizer: getDefaultNormalizer({ trim: false }) }),
    screen.queryByRole("list", { name: "Mention suggestions" }),
  ]).toStrictEqual([box, null]);

  close();
});

it("text with no @ before the caret suggests nobody", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-composer-quiet");
  const close = openAt({ client: adminClient(), hash: hashOf(parent) });

  await typeInReply("mail me at me@admin");

  expect(screen.queryByRole("list", { name: "Mention suggestions" })).toBeNull();

  close();
});

it("when the server refuses the identity list, typing @ suggests nobody and the box still takes text", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const parent = await threadIn("web-composer-refused");
  const refused = clientWith("cookout_not-a-real-token");
  const close = openAt({ client: { ...adminClient(), listIdentities: refused.listIdentities }, hash: hashOf(parent) });
  const box = await typeInReply("Ping @adm");

  await expect(refused.listIdentities()).rejects.toThrow("token");

  expect([
    screen.queryByRole("list", { name: "Mention suggestions" }),
    screen.queryByDisplayValue("Ping @adm"),
  ]).toStrictEqual([null, box]);

  close();
});
