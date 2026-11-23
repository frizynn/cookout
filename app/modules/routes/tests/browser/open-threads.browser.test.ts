import type { Browser, Locator, Page } from "@playwright/test";
import { adminClient, newIdentity } from "./people.ts";
import { expect, test } from "@playwright/test";
import { inPane, inThread } from "./regions.ts";
import { logInWithStream } from "./login.ts";

const channel = "browser-open-threads";

interface Opening {
  readonly browser: Browser;
  readonly hash: string;
  readonly token: string;
}

interface Tokens {
  readonly ann: string;
  readonly bob: string;
  readonly first: number;
}

async function openAs({ browser, hash, token }: Opening): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await logInWithStream({ page, token });
  await page.goto(`/${hash}`);
  return page;
}

function rowsOn(page: Page): Locator {
  return inPane(page).getByRole("list", { name: "Open threads" }).getByRole("listitem").filter({ hasText: channel });
}

async function started(): Promise<Tokens> {
  await adminClient().createChannel({ name: channel });
  const ann = await newIdentity({ kind: "human", name: `${channel}-ann` });
  const bob = await newIdentity({ kind: "human", name: `${channel}-bob` });
  const { message } = await ann.client.createMessage({ channel, text: "First ask." });
  await ann.client.createMessage({ channel, text: "Second ask." });
  return { ann: ann.token, bob: bob.token, first: message.id };
}

test("one person replies in a listed thread, and the other's list moves it to the end with no reload", async ({
  browser,
}) => {
  const tokens = await started();
  const annRows = rowsOn(await openAs({ browser, hash: "#/threads", token: tokens.ann }));
  const bob = await openAs({
    browser,
    hash: `#/channels/${channel}/threads/${String(tokens.first)}`,
    token: tokens.bob,
  });

  await expect(annRows).toHaveText([/First ask\./u, /Second ask\./u]);

  await bob.getByLabel("Reply", { exact: true }).fill("On it.");
  await inThread(bob).getByRole("button", { name: "Send" }).click();

  await expect(annRows).toHaveText([/Second ask\./u, /First ask\./u]);
});
