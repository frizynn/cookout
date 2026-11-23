import { AgentBadge } from "./agent-badge.tsx";
import type { AvatarParts } from "./parts.ts";
import type { ReactNode } from "react";

const HUES = [
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_250)]",
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_290)]",
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_335)]",
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_20)]",
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_60)]",
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_145)]",
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_180)]",
  "bg-[oklch(var(--avatar-lightness)_var(--avatar-chroma)_215)]",
] as const;

const LARGEST = 2_147_483_647;
const MULTIPLIER = 31;
const FIRST = 0;
const BOTH = 2;
const ONE = 1;

function hashOf(name: string): number {
  let value = 0;
  for (const character of name) {
    value = (value * MULTIPLIER + Number(character.codePointAt(FIRST))) % LARGEST;
  }
  return value;
}

function hueOf(name: string): string {
  const hue = hashOf(name) % HUES.length;
  return HUES.slice(hue, hue + ONE).join("");
}

function initialsOf(name: string): string {
  const parts = name.split("-").filter((part) => part !== "");
  if (parts.length < BOTH) {
    return name.charAt(FIRST).toUpperCase();
  }
  return parts
    .slice(FIRST, BOTH)
    .map((part) => part.charAt(FIRST))
    .join("")
    .toUpperCase();
}

const SIZES = {
  large: { box: "h-14 w-14 text-lg", testId: "avatar" },
  small: { box: "h-8 w-8 text-xs", testId: "avatar" },
  tiny: { box: "h-5 w-5 text-[9px] ring-2 ring-background", testId: "replier-avatar" },
} as const;

function shapeOf(agent: boolean): string {
  if (agent) {
    return "rounded-[28%]";
  }
  return "rounded-full";
}

export function Avatar(parts: AvatarParts): ReactNode {
  const size = SIZES[parts.size ?? "small"];
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center font-semibold text-white select-none before:content-[attr(data-initials)] ${size.box} ${shapeOf(parts.agent)} ${hueOf(parts.name)}`}
      data-agent={parts.agent}
      data-initials={initialsOf(parts.name)}
      data-testid={size.testId}
    >
      {parts.agent && parts.size !== "tiny" && <AgentBadge />}
    </span>
  );
}
