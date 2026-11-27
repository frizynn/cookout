import type { MessageItemParts } from "./message-parts.ts";

const MARKS: Readonly<Record<MessageItemParts["mark"], string>> = {
  "for-you": "bg-mention-bg shadow-[inset_2px_0_0_var(--color-mention-bar)]",
  linked: "bg-accent motion-safe:animate-linked-fade",
  none: "hover:bg-hover focus-visible:bg-hover has-focus-visible:bg-hover pointer-coarse:active:bg-hover",
  open: "bg-accent",
};

function spacingOf(grouped: boolean): string {
  if (grouped) {
    return "pt-3 pb-0.5";
  }
  return "pt-2.5 pb-1";
}

function messageClass(parts: Pick<MessageItemParts, "grouped" | "mark">): string {
  return `group relative flex gap-3 px-5 pointer-coarse:flex-wrap pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none] outline-none focus-visible:ring-2 focus-visible:ring-link/50 focus-visible:ring-inset ${spacingOf(parts.grouped)} ${MARKS[parts.mark]}`;
}

export { messageClass };
