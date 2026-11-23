import { test as base, expect } from "@playwright/test";
import { browserFixtures, exampleCommand } from "../../server.ts";
import { createCookoutClient } from "@ai-hero/cookout/sdk";

const INDENT = 2;
const REPLY_WITHIN = 20_000;

function pretty(value: unknown): string {
  return JSON.stringify(value, null, INDENT);
}

const test = base.extend(browserFixtures);

test("a person sees a call to the example command and the handler's result reply with its data in the thread", async ({
  cookout,
  page,
}) => {
  test.skip(!(await cookout.exampleCommandRegistered()), `The cookout has no command ${exampleCommand}.`);

  const { channel } = await cookout.createChannel("calls");
  const { identity, token } = await cookout.createHuman("person");
  const person = createCookoutClient({ token, url: cookout.url });
  const { threadId } = await person.callCommand(exampleCommand, { channel: channel.name, data: { branch: "main" } });
  await cookout.logIn(token);
  await page.goto(`${cookout.url}/#/channels/${channel.name}/threads/${String(threadId)}`);

  await expect(page.getByRole("article", { name: "Parent message" })).toContainText(`@${identity.name}`);
  await expect(
    page.getByRole("article", { name: "Parent message" }).getByLabel(`Call to /${exampleCommand}`),
  ).toHaveText(pretty({ branch: "main" }));
  await expect(page.getByRole("list", { name: "Replies" }).getByRole("listitem")).toHaveText(
    [`@${exampleCommand}/${exampleCommand} is done.${pretty({ received: { branch: "main" } })}`],
    { timeout: REPLY_WITHIN },
  );
});
