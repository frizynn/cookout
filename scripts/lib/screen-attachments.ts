import { createCookoutClient } from "../../app/modules/sdk/index.ts";

interface Owner {
  readonly url: string;
  readonly ownerToken: string;
  readonly image: Uint8Array;
}

const NOTES_LENGTH = 2048;

export async function postScreenAttachments({ image, ownerToken, url }: Owner): Promise<void> {
  const owner = createCookoutClient({ env: {}, token: ownerToken, url });
  await owner.createChannel({ name: "design" });
  await owner.createMessage({
    attachments: [
      { bytes: image, name: "hills.png" },
      { bytes: new TextEncoder().encode("x".repeat(NOTES_LENGTH)), name: "notes.txt" },
    ],
    channel: "design",
    text: "The view from the office, and my notes.",
  });
}
