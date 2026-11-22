const FIRST = 0;
const STEP = 1;
const BLANK = /[ \t]/u;
const LINE_BREAK = /[\n\r]/u;

function widenStart(text, from) {
  let start = from;
  while (BLANK.test(text.charAt(start - STEP))) {
    start -= STEP;
  }
  return start;
}

function widenEnd(text, to) {
  let end = to;
  while (BLANK.test(text.charAt(end))) {
    end += STEP;
  }
  return end;
}

function startsLine(text, start) {
  return start === FIRST || text.charAt(start - STEP) === "\n";
}

function endsLine(text, end) {
  return end === text.length || LINE_BREAK.test(text.charAt(end));
}

function pastLineBreak(text, end) {
  let next = end;
  if (text.charAt(next) === "\r") {
    next += STEP;
  }
  if (text.charAt(next) === "\n") {
    next += STEP;
  }
  return next;
}

export function removeComment(text) {
  return (comment) => (fixer) => {
    const [from, to] = comment.range;
    const start = widenStart(text, from);
    const end = widenEnd(text, to);
    const wholeLine = startsLine(text, start) && endsLine(text, end);
    if (wholeLine) {
      return fixer.removeRange([start, pastLineBreak(text, end)]);
    }
    if (startsLine(text, start) || endsLine(text, end)) {
      return fixer.removeRange([start, end]);
    }
    return fixer.replaceTextRange([start, end], " ");
  };
}
