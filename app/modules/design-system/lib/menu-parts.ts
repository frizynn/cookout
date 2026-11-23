interface MessageMenuParts {
  readonly onMarkUnread: () => void;
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
  readonly choices: readonly MenuChoice[] | null;
}

export type { HoverActionsParts, MenuChoice, MessageActionParts, MessageMenuParts };
