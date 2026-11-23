interface MessageMenuParts {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onMarkUnread: () => void;
}

interface HoverActionsParts {
  readonly actionHref: string | null;
  readonly actionLabel: string;
  readonly menu: MessageMenuParts | null;
}

export type { HoverActionsParts, MessageMenuParts };
