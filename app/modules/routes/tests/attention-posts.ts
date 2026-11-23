import type { CookoutClient, Message } from "../../sdk/index.ts";
import { adminClient, newIdentity } from "./identities.ts";

interface People {
  readonly poster: CookoutClient;
  readonly reader: CookoutClient;
}

async function people(channel: string): Promise<People> {
  const poster = await newIdentity({ kind: "agent", name: `${channel}-poster` });
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await adminClient().createChannel({ name: channel });
  return { poster: poster.client, reader: reader.client };
}

interface Posting {
  readonly by: CookoutClient;
  readonly channel: string;
  readonly text: string;
  readonly replyTo?: Message;
}

async function post({ by, channel, replyTo, text }: Posting): Promise<Message> {
  const { message } = await by.createMessage({ channel, text, ...(replyTo && { replyTo: replyTo.id }) });
  return message;
}

export { type People, people, post };
