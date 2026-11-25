import { buttonsOf, channelMade, listOpened, made, pressedIn } from "./schedule-lists.ts";
import { expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";
import { alertSaying } from "./alerts.ts";
import { newIdentity } from "./identities.ts";

async function refusingPauses(channel: string): Promise<CookoutClient> {
  await channelMade(channel);
  const { client } = await newIdentity({ kind: "human", name: `${channel}-maker` });
  await made({ by: client, channel, text: "Retro" });
  const gone = await made({ by: client, channel, text: "Gone" });
  await client.deleteScheduledMessage(gone.id);
  return {
    ...client,
    pauseScheduledMessage: async () => {
      const paused = await client.pauseScheduledMessage(gone.id);
      return paused;
    },
  };
}

async function refused(): Promise<string | null> {
  await pressedIn({ button: "Pause", text: "Retro" });
  const alert = await alertSaying("Couldn't change it.");
  return alert.textContent;
}

async function cancelled(): Promise<readonly string[]> {
  await pressedIn({ button: "Delete", text: "Retro" });
  const confirming = await screen.findByRole("alertdialog", { name: "Delete this scheduled message?" });
  fireEvent.click(within(confirming).getByRole("button", { name: "Cancel" }));
  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  const buttons = await buttonsOf("Retro");
  return buttons;
}

it("a refused change says why on its row, and cancelling a delete keeps the schedule", {
  timeout: 10_000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-schedule-list-refused";
  const client = await refusingPauses(channel);
  const close = await listOpened({ channel, client });
  const said = await refused();

  expect([said, await cancelled()]).toStrictEqual([
    expect.stringMatching(/^Couldn't change it\. .+\(scheduled_message_not_found\)$/u),
    ["Pause", "Edit", "Delete"],
  ]);

  close();
});
