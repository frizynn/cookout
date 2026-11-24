import { Avatar } from "./avatar.tsx";
import { FeedNoticeTitle } from "./feed-notice-title.tsx";
import { FeedRowWhy } from "./feed-row-why.tsx";
import type { PresenceShown } from "./avatar-parts.ts";
import type { ReactNode } from "react";

interface FeedNoticeRowParts {
  readonly level: "for-you" | "read";
  readonly why: string;
  readonly name: string;
  readonly href: string;
  readonly displayName: string | null;
  readonly note: string | null;
  readonly agent: boolean;
  readonly presence: PresenceShown | null;
  readonly time: string;
  readonly children?: ReactNode;
}

const LOOKS = { "for-you": "", read: "opacity-80 hover:opacity-100" } as const;
const DOTS = { "for-you": "bg-mention-bar", read: "hidden" } as const;

export function FeedNoticeRow(parts: FeedNoticeRowParts): ReactNode {
  return (
    <li className={`relative flex gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-hover ${LOOKS[parts.level]}`}>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-[1.35rem] left-0 h-1.5 w-1.5 rounded-full ${DOTS[parts.level]}`}
      />
      <Avatar agent={parts.agent} name={parts.name} presence={parts.presence} />
      <span className="flex min-w-0 flex-1 flex-col">
        <FeedRowWhy level={parts.level}>{parts.why}</FeedRowWhy>
        <FeedNoticeTitle
          bold={parts.level !== "read"}
          displayName={parts.displayName}
          href={parts.href}
          name={parts.name}
          note={parts.note}
          time={parts.time}
        />
        {parts.children}
      </span>
    </li>
  );
}
