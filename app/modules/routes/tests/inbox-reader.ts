import { adminClient, newIdentity } from "./identities.ts";
import { screen, within } from "@testing-library/react";
import type { CookoutClient } from "../../sdk/index.ts";

interface InboxReader {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

async function subscribe(reader: CookoutClient, channel: string): Promise<void> {
  await adminClient().createChannel({ name: channel });
  await reader.subscribe(channel);
}

async function subscribedReader(channel: string, ...others: readonly string[]): Promise<InboxReader> {
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await Promise.all(
    [channel, ...others].map(async (name) => {
      await subscribe(reader.client, name);
    }),
  );
  return { poster: poster.client, reader: reader.client };
}

function rowsOf(label: string): readonly string[] {
  const rows: string[] = [];
  for (const link of within(screen.getByRole("list", { name: label })).getAllByRole("link")) {
    rows.push(`${link.getAttribute("href") ?? ""} ${link.textContent}`);
  }
  return rows;
}

export { type InboxReader, rowsOf, subscribedReader };
