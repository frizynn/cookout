import type { ReactNode } from "react";

const TEXT = { label: "New", shown: "New" } as const;

export function NewLine(): ReactNode {
  return (
    <div className="my-1 flex items-center px-5">
      <hr aria-label={TEXT.label} className="flex-1 border-t border-unread" />
      <span
        aria-hidden="true"
        className="ml-2 rounded-sm bg-unread px-1.5 py-px text-[10px] font-bold tracking-wide text-white uppercase"
      >
        {TEXT.shown}
      </span>
    </div>
  );
}
