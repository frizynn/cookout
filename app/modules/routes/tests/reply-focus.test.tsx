import { adminClient, openAt } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

async function channelWith(channel: string, replies: readonly string[]): Promise<void> {
  const admin = adminClient();
  await admin.createChannel({ name: channel });
  const { message } = await admin.createMessage({ channel, text: "The message" });
  await Promise.all(
    replies.map(async (text) => {
      await admin.createMessage({ channel, replyTo: message.id, text });
    }),
  );
}

async function focusedBox(): Promise<string | null> {
  const panel = await screen.findByRole("complementary", { name: "Thread" });
  const box = await within(panel).findByLabelText("Reply");
  await waitFor(() => {
    expect(document.activeElement).toBe(box);
  });
  return box.getAttribute("name");
}

it('"Reply" on a message opens its thread in the panel with the cursor in the reply box', {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await channelWith("web-reply-focus", []);
  const close = openAt({ client: adminClient(), hash: "#/channels/web-reply-focus" });

  fireEvent.click(await screen.findByRole("link", { name: "Reply" }));

  await expect(focusedBox()).resolves.toBe("text");

  close();
});

it("a message's reply count opens its thread with the cursor in the reply box", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await channelWith("web-reply-count-focus", ["The reply"]);
  const close = openAt({ client: adminClient(), hash: "#/channels/web-reply-count-focus" });

  fireEvent.click(await screen.findByRole("link", { name: "1 reply" }));

  await expect(focusedBox()).resolves.toBe("text");

  close();
});
