import type { DateTextParts } from "./parts.ts";
import type { ReactNode } from "react";

const START = 0;
const DATE_LENGTH = "2026-01-01".length;

export function DateText(parts: DateTextParts): ReactNode {
  return (
    <time className="font-mono" dateTime={parts.time}>
      {parts.time.slice(START, DATE_LENGTH)}
    </time>
  );
}
