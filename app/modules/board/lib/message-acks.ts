import type { CookoutClient, MessageId } from "../../sdk/index.ts";

type AckClient = Pick<CookoutClient, "ack">;

async function ackAfter(previous: Promise<boolean>, client: AckClient, id: MessageId): Promise<boolean> {
  await previous;
  try {
    await client.ack(id);
    return true;
  } catch {
    return false;
  }
}

function createMessageAcks(client: AckClient): (id: MessageId) => void {
  let queue = Promise.resolve(true);
  return (id) => {
    queue = ackAfter(queue, client, id);
  };
}

export { createMessageAcks };
