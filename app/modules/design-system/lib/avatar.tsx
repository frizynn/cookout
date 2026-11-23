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

function shapeOf(agent: boolean): string {
  if (agent) {
    return "rounded-[28%]";
  }
  return "rounded-full";
}

export function Avatar(parts: AvatarParts): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold text-white select-none before:content-[attr(data-initials)] ${shapeOf(parts.agent)} ${hueOf(parts.name)}`}
      data-agent={parts.agent}
      data-initials={initialsOf(parts.name)}
      data-testid="avatar"
    >
      {parts.agent && <AgentBadge />}
    </span>
  );
}
