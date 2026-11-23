import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

const NEAR_THE_END = 80;

interface ScrollAreaParts {
  readonly count: number;
  readonly children: ReactNode;
}

export function ScrollArea(parts: ScrollAreaParts): ReactNode {
  const { count } = parts;
  const area = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const shown = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    const element = area.current;
    if (element !== null) {
      atEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_THE_END;
    }
  }, []);
  useLayoutEffect(() => {
    const element = area.current;
    if (element !== null && shown.current !== count && atEnd.current) {
      element.scrollTop = element.scrollHeight;
    }
    shown.current = count;
  }, [count]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-2" onScroll={handleScroll} ref={area}>
      {parts.children}
    </div>
  );
}
