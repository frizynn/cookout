import type { HandFocus } from "../../testing/web.ts";
import type { Reading } from "../../unread/index.ts";
import { createPageFocus } from "../../page-focus/index.ts";
import { createReading } from "../../unread/index.ts";
import { handClock } from "./hand-clock.ts";
import { handFocus } from "../../testing/web.ts";

interface HandReading {
  readonly reading: Reading;
  readonly advance: (millis: number) => void;
  readonly page: HandFocus;
}

function handReading(): HandReading {
  const time = handClock();
  const page = handFocus();
  return {
    advance: time.advance,
    page,
    reading: createReading({ clock: time.clock, page: createPageFocus(page.adapter) }),
  };
}

export { type HandReading, handReading };
