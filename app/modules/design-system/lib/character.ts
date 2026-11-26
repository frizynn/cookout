import { bottts, botttsNeutral, lorelei, notionists, pixelArt, thumbs } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

const SOFT = ["dbeafe", "e0e7ff", "fce7f3", "fef3c7", "dcfce7", "ccfbf1", "ede9fe", "ffedd5"];

const STYLES = {
  blob: { label: "Blob", make: (seed: string) => createAvatar(thumbs, { seed }) },
  bot: { label: "Bot", make: (seed: string) => createAvatar(botttsNeutral, { seed }) },
  face: { label: "Face", make: (seed: string) => createAvatar(lorelei, { backgroundColor: SOFT, seed }) },
  pixel: { label: "Pixel", make: (seed: string) => createAvatar(pixelArt, { backgroundColor: SOFT, seed }) },
  robot: { label: "Robot", make: (seed: string) => createAvatar(bottts, { backgroundColor: SOFT, seed }) },
  sketch: { label: "Sketch", make: (seed: string) => createAvatar(notionists, { backgroundColor: SOFT, seed }) },
} as const;

type CharacterStyle = keyof typeof STYLES;

interface Character {
  readonly style: CharacterStyle;
  readonly seed: string;
}

const drawn = new Map<string, string>();

function characterKey(character: Character): string {
  return `${character.style}:${character.seed}`;
}

function characterUri(character: Character): string {
  const key = characterKey(character);
  const known = drawn.get(key) ?? null;
  if (known !== null) {
    return known;
  }
  const uri = STYLES[character.style].make(character.seed).toDataUri();
  drawn.set(key, uri);
  return uri;
}

const ORDER: readonly CharacterStyle[] = ["bot", "robot", "pixel", "blob", "sketch", "face"];

const STYLE_CHOICES = ORDER.map((value) => ({ label: STYLES[value].label, value }));

function isCharacterStyle(value: string): value is CharacterStyle {
  return Object.hasOwn(STYLES, value);
}

const SHOWN = 8;
const FIRST_PLACE = 0;

interface CharacterRound {
  readonly seed: string;
  readonly style: CharacterStyle;
  readonly round: number;
}

interface CharacterPlace extends CharacterRound {
  readonly index: number;
}

function characterAt(place: CharacterPlace): Character {
  const shown = place.round * SHOWN + place.index;
  if (shown === FIRST_PLACE) {
    return { seed: place.seed, style: place.style };
  }
  return { seed: `${place.seed}-${String(shown)}`, style: place.style };
}

const CHARACTER_INDEXES = Array.from({ length: SHOWN }, (_slot, index) => index);

export {
  type Character,
  type CharacterRound,
  CHARACTER_INDEXES,
  characterAt,
  type CharacterStyle,
  STYLE_CHOICES,
  characterUri,
  isCharacterStyle,
};
