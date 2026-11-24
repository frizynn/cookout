import { createPageFocus, documentFocusAdapter } from "../../page-focus/index.ts";
import type { ReaderTools } from "./reader.ts";
import { browserClock } from "../../format/index.ts";

function browserReadingTools(): ReaderTools {
  return { clock: browserClock, page: createPageFocus(documentFocusAdapter()) };
}

export { browserReadingTools };
