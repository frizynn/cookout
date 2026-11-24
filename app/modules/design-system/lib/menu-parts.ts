interface ReactionChoice {
  readonly symbol: string;
  readonly key: string;
  readonly onReact: () => void;
}

interface ThreadChoice {
  readonly label: string;
  readonly name: string;
  readonly onSelect: () => void;
}

interface MessageMenuParts {
  readonly onMarkUnread: () => void;
  readonly reactions: readonly ReactionChoice[];
  readonly thread: ThreadChoice | null;
}

interface MessageActionParts {
  readonly actionHref: string | null;
  readonly actionLabel: string;
  readonly onAction: (() => void) | null;
}

type MenuChoice =
  | { readonly label: string; readonly href: string; readonly onSelect: null }
  | { readonly label: string; readonly href: null; readonly onSelect: () => void };

interface HoverActionsParts extends MessageActionParts {
  readonly choices: readonly MenuChoice[];
  readonly reactions: readonly ReactionChoice[];
  readonly thread: ThreadChoice | null;
}

export type { HoverActionsParts, MenuChoice, MessageActionParts, MessageMenuParts, ReactionChoice, ThreadChoice };
