import { Avatar } from "./avatar.tsx";
import { FeedRowBody } from "./feed-row-body.tsx";
import type { FeedRowParts } from "./feed-row-body.tsx";
import type { ReactNode } from "react";

interface RowParts extends FeedRowParts {
  readonly href: string;
  readonly agent: boolean;
}

const LOOKS = {
  activity: "",
  "for-you": "",
  read: "opacity-80 hover:opacity-100",
} as const;

export function FeedRow(parts: RowParts): ReactNode {
  return (
    <li>
      <a
        className={`relative flex gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-hover ${LOOKS[parts.level]}`}
        href={parts.href}
      >
        <Avatar agent={parts.agent} name={parts.author} />
        <FeedRowBody
          action={parts.action}
          author={parts.author}
          channel={parts.channel}
          context={parts.context}
          displayName={parts.displayName}
          level={parts.level}
          note={parts.note}
          time={parts.time}
          why={parts.why}
        >
          {parts.children}
        </FeedRowBody>
      </a>
    </li>
  );
}
