import type { MessageItemParts } from "./parts.ts";

const MARKS: Readonly<Record<MessageItemParts["mark"], string>> = {
  "for-you": "hover:bg-hover focus-within:bg-hover",
  none: "hover:bg-hover focus-within:bg-hover",
  open: "bg-accent",
};

function spacingOf(grouped: boolean): string {
  if (grouped) {
    return "py-0.5";
  }
  return "pt-2.5 pb-1";
}

function messageClass(parts: Pick<MessageItemParts, "grouped" | "mark">): string {
  return `group relative flex gap-3 px-5 outline-none focus-visible:ring-2 focus-visible:ring-link/50 focus-visible:ring-inset ${spacingOf(parts.grouped)} ${MARKS[parts.mark]}`;
}

function dotPlace(grouped: boolean): "message" | "grouped-message" {
  if (grouped) {
    return "grouped-message";
  }
  return "message";
}

export { dotPlace, messageClass };
