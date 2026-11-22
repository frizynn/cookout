import { expect, it } from "vitest";
import { channelNameSchema, messageSchema } from "../src/index.ts";

it("channel names are 1-80 lowercase letters, digits or '-'", () => {
  for (const name of ["grill-auth", "a", "v1-2026", "x".repeat(80)]) {
    expect(channelNameSchema.safeParse(name).success).toBe(true);
  }
  for (const name of ["", "Grill", "grill_auth", "grill auth", "#grill", "x".repeat(81)]) {
    expect(channelNameSchema.safeParse(name).success).toBe(false);
  }
});

it("a message is either top-level (with reply count) or a reply (with replyTo)", () => {
  const base = { id: 2, channel: "grill", author: { name: "agent" }, text: "hi", mentions: [], createdAt: "2026-01-01T00:00:00.000Z" };
  expect(messageSchema.safeParse({ ...base, replyCount: 0, latestReplyId: null }).success).toBe(true);
  expect(messageSchema.safeParse({ ...base, replyTo: 1 }).success).toBe(true);
  expect(messageSchema.safeParse(base).success).toBe(false);
});
