const FOCUSABLE = "a[href], button:not(:disabled)";
const FIRST = 0;
const LAST = -1;

interface CardFocus {
  readonly mark: string;
  readonly allows: (open: boolean) => boolean;
  readonly blurred: () => void;
  readonly enter: () => boolean;
  readonly backToName: () => void;
  readonly holdsFocus: () => boolean;
  readonly atEdge: (backwards: boolean) => boolean;
}

function boxOf(mark: string): Element | null {
  return globalThis.document.querySelector(`[data-identity-card-box="${mark}"]`);
}

function stopsIn(mark: string): readonly Element[] {
  const box = boxOf(mark);
  if (box === null) {
    return [];
  }
  return [...box.querySelectorAll(FOCUSABLE)];
}

function holds(mark: string): boolean {
  const box = boxOf(mark);
  if (box === null) {
    return false;
  }
  return box.contains(globalThis.document.activeElement);
}

function edgeOf(mark: string, backwards: boolean): Element | undefined {
  if (backwards) {
    return stopsIn(mark).at(FIRST);
  }
  return stopsIn(mark).at(LAST);
}

function createCardFocus(mark: string): CardFocus {
  let keptClosed = false;
  let entering = false;
  return {
    allows: (open) => {
      if (open) {
        return !keptClosed;
      }
      return !entering && !holds(mark);
    },
    atEdge: (backwards) => edgeOf(mark, backwards) === globalThis.document.activeElement,
    backToName: () => {
      keptClosed = true;
      const name = globalThis.document.querySelector(`[data-identity-card="${mark}"]`);
      if (name instanceof HTMLElement) {
        name.focus();
      }
    },
    blurred: () => {
      keptClosed = false;
    },
    enter: () => {
      const first = stopsIn(mark).at(FIRST);
      if (!(first instanceof HTMLElement)) {
        return false;
      }
      entering = true;
      first.focus();
      entering = false;
      return true;
    },
    holdsFocus: () => holds(mark),
    mark,
  };
}

export { createCardFocus };
export type { CardFocus };
