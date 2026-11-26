import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

const NEAR_THE_END = 80;

interface ScrollAreaParts {
  readonly label: string;
  readonly count: number;
  readonly children: ReactNode;
}

function scrolledToEnd(area: unknown, atEnd: () => boolean): void {
  if (area instanceof HTMLElement && atEnd()) {
    area.scrollTop = area.scrollHeight;
  }
}

function followed(content: unknown, atEnd: () => boolean): () => void {
  const observers: ResizeObserver[] = [];
  if (content instanceof HTMLElement && "ResizeObserver" in globalThis) {
    const observer = new ResizeObserver(() => {
      scrolledToEnd(content.parentElement, atEnd);
    });
    observer.observe(content);
    observers.push(observer);
  }
  return () => {
    for (const observer of observers) {
      observer.disconnect();
    }
  };
}

export function ScrollArea(parts: ScrollAreaParts): ReactNode {
  const { count } = parts;
  const area = useRef<HTMLElement>(null);
  const atEnd = useRef(true);
  const shown = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    const element = area.current;
    atEnd.current = element === null || element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_THE_END;
  }, []);
  const content = useCallback((inner: unknown) => followed(inner, () => atEnd.current), []);
  useLayoutEffect(() => {
    const element = area.current;
    if (element !== null && shown.current !== count && atEnd.current) {
      element.scrollTop = element.scrollHeight;
    }
    shown.current = count;
  }, [count]);
  return (
    <section
      aria-label={parts.label}
      className="min-h-0 flex-1 overflow-y-auto pb-2"
      onScroll={handleScroll}
      ref={area}
    >
      <div ref={content}>{parts.children}</div>
    </section>
  );
}
