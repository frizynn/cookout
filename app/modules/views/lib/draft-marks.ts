import type { TextRange } from "../../design-system/controls.tsx";
import { mentionPattern } from "../../messages/index.ts";

const AT = 1;
const WHOLE = 0;

function mentionMarks(text: string): readonly TextRange[] {
  const marks: TextRange[] = [];
  for (const found of text.matchAll(mentionPattern)) {
    marks.push({ end: found.index + found[WHOLE].length, start: found.index - AT });
  }
  return marks;
}

export { mentionMarks };
