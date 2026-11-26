import type { ReactNode } from "react";

interface Segment {
  readonly at: number;
  readonly text: string;
  readonly marked: boolean;
}

interface BoxMirrorSegmentParts {
  readonly segment: Segment;
}

export function BoxMirrorSegment({ segment }: BoxMirrorSegmentParts): ReactNode {
  if (segment.marked) {
    return (
      <mark className="rounded-[3px] bg-draft-mention/15 text-transparent shadow-[inset_0_-2px_0_var(--color-draft-mention)]">
        {segment.text}
      </mark>
    );
  }
  return <span>{segment.text}</span>;
}

export type { Segment };
