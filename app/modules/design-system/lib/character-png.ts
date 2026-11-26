import type { Character } from "./character.ts";
import { avatarLimits } from "../../avatars/index.ts";
import { characterUri } from "./character.ts";

const ORIGIN = 0;

async function characterPng(character: Character): Promise<Uint8Array> {
  const image = new Image();
  image.src = characterUri(character);
  await image.decode();
  const canvas = new OffscreenCanvas(avatarLimits.side, avatarLimits.side);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("The browser couldn't draw the character.");
  }
  context.drawImage(image, ORIGIN, ORIGIN, avatarLimits.side, avatarLimits.side);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

export { characterPng };
