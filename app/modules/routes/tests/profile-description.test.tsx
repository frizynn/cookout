import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { inProfile } from "./regions.ts";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

interface Crew {
  readonly human: CookoutClient;
  readonly stranger: CookoutClient;
}

async function crewOf(prefix: string): Promise<Crew> {
  const human = await newIdentity({ kind: "human", name: `${prefix}-human` });
  await newIdentity({ kind: "agent", name: `${prefix}-bot`, owner: `${prefix}-human` });
  const stranger = await newIdentity({ kind: "human", name: `${prefix}-stranger` });
  return { human: human.client, stranger: stranger.client };
}

interface Watching {
  readonly close: () => void;
  readonly events: EventStream;
}

async function watchProfile(client: CookoutClient, name: string): Promise<Watching> {
  const { live, stream } = watched(client);
  const close = openAt({ client, hash: `#/inbox?profile=${name}`, live });
  const events = await stream;
  await inProfile().findByRole("heading", { level: 3 });
  return { close, events };
}

async function describe(text: string): Promise<void> {
  const form = await inProfile().findByRole("form", { name: "Description" });
  fireEvent.change(within(form).getByRole("textbox"), { target: { value: text } });
  fireEvent.click(within(form).getByRole("button", { name: "Save" }));
}

it("an owner describes their agent in its profile panel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const prefix = "web-describe-owner";
  const { human } = await crewOf(prefix);
  const close = openAt({ client: human, hash: `#/inbox?profile=${prefix}-bot` });

  await describe("  Ada's to-dos ");

  await waitFor(async () => {
    await expect(human.getIdentity(`${prefix}-bot`)).resolves.toHaveProperty("identity.description", "Ada's to-dos");
  });

  close();
});

it("an admin edits any agent's description in its profile panel", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const prefix = "web-describe-admin";
  await crewOf(prefix);
  const admin = adminClient();
  await admin.setDescription(`${prefix}-bot`, "Release notes");
  const close = openAt({ client: admin, hash: `#/inbox?profile=${prefix}-bot` });
  const form = await inProfile().findByRole("form", { name: "Description" });

  await waitFor(() => {
    expect(within(form).getByRole("textbox")).toHaveProperty("value", "Release notes");
  });

  close();
});

it("someone else sees an agent's description, read-only, change live in its open panel", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const prefix = "web-describe-live";
  const { human, stranger } = await crewOf(prefix);
  const { close, events } = await watchProfile(stranger, `${prefix}-bot`);
  await human.setDescription(`${prefix}-bot`, "Voice-note follow-ups");

  await expect(inProfile().findByText("Voice-note follow-ups")).resolves.toBeDefined();
  expect(inProfile().queryAllByRole("form")).toStrictEqual([]);

  close();
  await events.close();
});
