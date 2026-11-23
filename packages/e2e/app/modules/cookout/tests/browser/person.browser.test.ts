import type { CookoutClient, IdentityWithTokenResponse, Message } from "@ai-hero/cookout/sdk";
import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";
import type { BrowserRun } from "../../server.ts";
import { browserFixtures } from "../../server.ts";
import { createCookoutClient } from "@ai-hero/cookout/sdk";

interface Member {
  readonly name: string;
  readonly client: CookoutClient;
  readonly token: string;
}

interface Board {
  readonly channel: string;
  readonly person: Member;
  readonly agent: Member;
  readonly question: Message;
}

function memberOf(cookout: BrowserRun, { identity, token }: IdentityWithTokenResponse): Member {
  return { client: createCookoutClient({ token, url: cookout.url }), name: identity.name, token };
}

async function boardWithAMention(cookout: BrowserRun): Promise<Board> {
  const { channel } = await cookout.createChannel("room");
  const person = memberOf(cookout, await cookout.createHuman("person"));
  const agent = memberOf(cookout, await cookout.createAgent("agent"));
  await person.client.subscribe(channel.name);
  const text = `Can you review the deploy, @${person.name}?`;
  const { message: question } = await agent.client.createMessage({ channel: channel.name, text });
  return { agent, channel: channel.name, person, question };
}

function channelRow(page: Page, channel: string): Locator {
  return page.getByRole("link", { name: new RegExp(`^#${channel}(?![a-z0-9-])`, "u") });
}

async function openQuestion(page: Page, row: Locator): Promise<void> {
  await row.click();
  await page.getByRole("link", { name: /Can you review the deploy/u }).click();
}

async function backToChannels(page: Page, channel: string): Promise<void> {
  await page.getByRole("link", { name: `← #${channel}` }).click();
  await page.getByRole("link", { name: "← Channels" }).click();
}

async function replyMentioning(page: Page, cookout: BrowserRun, { agent, channel }: Board): Promise<void> {
  await openQuestion(page, channelRow(page, channel));
  await page.getByLabel("Reply", { exact: true }).pressSequentially(`Over to @${cookout.prefix}-ag`);
  const suggestions = page.getByRole("list", { name: "Mention suggestions" });

  await expect(suggestions.getByRole("button")).toHaveText([`@${agent.name}`]);

  await suggestions.getByRole("button", { name: `@${agent.name}` }).click();
  await page.keyboard.type("for the review.");
  await page.getByRole("button", { name: "Send reply" }).click();
}

function inboxOf(member: Member): () => Promise<readonly string[]> {
  return async () => {
    const { items } = await member.client.inbox();
    return items.map((item) => item.message.text);
  };
}

async function readTheMention(page: Page, cookout: BrowserRun, { channel, person }: Board): Promise<void> {
  const row = channelRow(page, channel);
  await cookout.logIn(person.token);

  await expect(row).toHaveAccessibleName(`#${channel} 1 mention`);

  await openQuestion(page, row);

  await expect.poll(inboxOf(person)).toStrictEqual([]);

  await backToChannels(page, channel);
}

async function agentAnswers({ agent, channel, question }: Board, mentionReply: string): Promise<void> {
  await expect.poll(inboxOf(agent)).toStrictEqual([mentionReply]);

  await agent.client.createMessage({ channel, replyTo: question.id, text: "Looking now." });
}

const test = base.extend(browserFixtures);

test("a person logs in, opens a mention's thread, replies with a picked @-mention and sees unread counts and the agent's reply change live", async ({
  cookout,
  page,
}) => {
  const board = await boardWithAMention(cookout);
  const { agent, channel, person } = board;
  const row = channelRow(page, channel);
  await readTheMention(page, cookout, board);

  await expect(row).toHaveAccessibleName(`#${channel}`);

  await agent.client.createMessage({ channel, text: "Deploy starts at noon." });

  await expect(row).toHaveAccessibleName(`#${channel} 1 unread`);

  await replyMentioning(page, cookout, board);
  await agentAnswers(board, `Over to @${agent.name} for the review.`);

  await expect(page.getByRole("list", { name: "Replies" }).getByRole("listitem")).toHaveText([
    `@${person.name}Over to @${agent.name} for the review.`,
    `@${agent.name}Looking now.`,
  ]);
});
