import { adminClient, newIdentity } from "./identities.ts";
import { expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { inDialog, inProfile } from "./regions.ts";
import type { CookoutClient } from "../../sdk/index.ts";
import { openAt } from "./render.tsx";

async function listedNames(prefix: string): Promise<readonly string[]> {
  const { identities } = await adminClient().listIdentities({ include: "deactivated" });
  return identities.filter((each) => each.name.startsWith(prefix)).map((each) => each.name);
}

it("an admin sees Delete on the profile of an identity with no messages, and deleting it removes it", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "agent", name: "web-delete-bot" });
  const close = openAt({ client: adminClient(), hash: "#/people/web-delete-bot" });
  fireEvent.click(await inProfile().findByRole("button", { name: "Delete" }));
  fireEvent.click(await inDialog().findByRole("button", { name: "Delete @web-delete-bot" }));
  await inProfile().findByText("Unknown identity");

  await expect(listedNames("web-delete-bot")).resolves.toStrictEqual([]);

  close();
});

it("an admin sees Deactivate, not Delete, on the profile of an identity with messages", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const talker = await newIdentity({ kind: "agent", name: "web-delete-talker" });
  await talker.client.createChannel({ name: "web-delete-talk" });
  await talker.client.createMessage({ channel: "web-delete-talk", text: "hello" });
  const close = openAt({ client: adminClient(), hash: "#/people/web-delete-talker" });
  await inProfile().findByRole("button", { name: "Deactivate" });
  await waitFor(() => {
    expect(inProfile().queryByRole("button", { name: "Delete" })).toBeNull();
  });

  await expect(listedNames("web-delete-talker")).resolves.toStrictEqual(["web-delete-talker"]);

  close();
});

it("an admin sees Deactivate when the message count can't be read", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await newIdentity({ kind: "agent", name: "web-delete-uncounted" });
  const countMessagesBy = vi.fn<CookoutClient["countMessagesBy"]>().mockRejectedValue(new Error("unreachable"));
  const client = { ...adminClient(), countMessagesBy };
  const close = openAt({ client, hash: "#/people/web-delete-uncounted" });
  await inProfile().findByRole("button", { name: "Deactivate" });
  await waitFor(() => {
    expect(countMessagesBy).toHaveBeenCalledWith("web-delete-uncounted");
  });

  expect(inProfile().queryByRole("button", { name: "Delete" })).toBeNull();

  close();
});
