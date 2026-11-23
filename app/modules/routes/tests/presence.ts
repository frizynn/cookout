import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import { screen, within } from "@testing-library/react";
import { newIdentity } from "./identities.ts";
import { onTestFinished } from "vitest";
import { openAt } from "./render.tsx";
import { watched } from "./watched.ts";

type Label = string | Readonly<RegExp>;

interface Watcher {
  readonly client: CookoutClient;
  readonly watch: () => Promise<EventStream>;
}

interface Dot {
  readonly presence: string | undefined;
  readonly tooltip: string;
}

interface Reading {
  readonly reader: string;
  readonly hash: string;
}

interface Looking {
  readonly at: string;
  readonly label: Label;
}

async function dotWithin(region: (at: string) => Promise<HTMLElement>, { at, label }: Looking): Promise<Dot> {
  const found = await region(at);
  const dot = await within(found).findByRole("img", { name: label });
  return { presence: dot.dataset["presence"], tooltip: within(found).getByTitle(label).title };
}

async function articleWith(text: string): Promise<HTMLElement> {
  const messages = await screen.findByRole("list", { name: "Messages" });
  const shown = await within(messages).findByText(text);
  return shown.closest("article") ?? messages;
}

async function rowNamed(name: string): Promise<HTMLElement> {
  const rows = await screen.findByRole("list", { name: "Identities" });
  const row = await within(rows).findByRole("link", { name: new RegExp(name, "u") });
  return row;
}

async function suggestionNamed(name: string): Promise<HTMLElement> {
  const list = await screen.findByRole("list", { name: "Mention suggestions" });
  return within(list).getByRole("button", { name: new RegExp(name, "u") });
}

async function openProfile(): Promise<HTMLElement> {
  const profile = await screen.findByRole("complementary", { name: "Profile" });
  return profile;
}

export async function agentNamed(name: string): Promise<Watcher> {
  const agent = await newIdentity({ kind: "agent", name, owner: "admin" });
  return {
    client: agent.client,
    watch: async () => {
      const events = await agent.client.watch();
      onTestFinished(events.close);
      return events;
    },
  };
}

export async function readerOn({ hash, reader }: Reading): Promise<void> {
  const { client } = await newIdentity({ kind: "human", name: reader });
  const { live, stream } = watched(client);
  openAt({ client, hash, live });
  await stream;
}

export async function authorDot({ at, label }: Looking): Promise<Dot> {
  const dot = await dotWithin(articleWith, { at, label });
  return dot;
}

export async function rowDot({ at, label }: Looking): Promise<Dot> {
  const dot = await dotWithin(rowNamed, { at, label });
  return dot;
}

export async function suggestionDot({ at, label }: Looking): Promise<Dot> {
  const dot = await dotWithin(suggestionNamed, { at, label });
  return dot;
}

export async function profileDot(label: Label): Promise<Dot> {
  const dot = await dotWithin(openProfile, { at: "", label });
  return dot;
}

export function online(): Dot {
  return { presence: "online", tooltip: "Online" };
}

export function offline(tooltip = "Offline"): Dot {
  return { presence: "offline", tooltip };
}
