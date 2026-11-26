import { followBox, watchBox } from "./box-mirror-look.ts";
import { useEffect, useLayoutEffect, useRef } from "react";
import { BoxMirrorSegment } from "./box-mirror-segment.tsx";
import type { ReactNode } from "react";
import type { Segment } from "./box-mirror-segment.tsx";
import type { TextRange } from "./text-range.ts";

interface BoxMirrorParts {
  readonly value: string;
  readonly marks: readonly TextRange[];
}

const START = 0;
const LAST_LINE = "​";

function segmentsOf(value: string, marks: readonly TextRange[]): readonly Segment[] {
  const segments: Segment[] = [];
  let at = START;
  for (const mark of marks) {
    if (mark.start > at) {
      segments.push({ at, marked: false, text: value.slice(at, mark.start) });
    }
    segments.push({ at: mark.start, marked: true, text: value.slice(mark.start, mark.end) });
    at = mark.end;
  }
  segments.push({ at, marked: false, text: value.slice(at) + LAST_LINE });
  return segments;
}

export function BoxMirror(parts: BoxMirrorParts): ReactNode {
  const mirror = useRef<HTMLDivElement>(null);
  const { value } = parts;
  useLayoutEffect(() => {
    followBox(mirror.current);
  });
  useEffect(() => watchBox(mirror.current), []);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden border-solid border-transparent break-words whitespace-pre-wrap text-transparent"
      data-box-mirror
      ref={mirror}
    >
      {segmentsOf(value, parts.marks).map((segment) => (
        <BoxMirrorSegment key={segment.at} segment={segment} />
      ))}
    </div>
  );
}
