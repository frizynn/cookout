import { createPageFocus, documentFocusAdapter } from "../../page-focus/index.ts";
import type { Reading } from "./reading.ts";
import { browserClock } from "../../format/index.ts";
import { createReading } from "./reading.ts";

function browserReading(): Reading {
  return createReading({ clock: browserClock, page: createPageFocus(documentFocusAdapter()) });
}

export { browserReading };
