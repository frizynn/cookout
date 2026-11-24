const SCOPES = ["search box", "text box", "profile panel", "channel row", "sidebar", "inbox", "everywhere"] as const;

type Scope = (typeof SCOPES)[number];

const TEXT_SCOPES: ReadonlySet<Scope> = new Set(["search box", "text box"]);

const KEYS = [
  { action: "openSearch", chord: "Mod+K", scope: "everywhere" },
  { action: "nextChannel", chord: "Alt+ArrowDown", scope: "everywhere" },
  { action: "previousChannel", chord: "Alt+ArrowUp", scope: "everywhere" },
  { action: "nextUnreadChannel", chord: "Alt+Shift+ArrowDown", scope: "everywhere" },
  { action: "previousUnreadChannel", chord: "Alt+Shift+ArrowUp", scope: "everywhere" },
  { action: "nextLink", chord: "ArrowDown", scope: "sidebar" },
  { action: "previousLink", chord: "ArrowUp", scope: "sidebar" },
  { action: "markChannelRead", chord: "e", scope: "channel row" },
  { action: "toggleSubscription", chord: "s", scope: "channel row" },
  { action: "highlightNext", chord: "ArrowDown", scope: "search box" },
  { action: "highlightPrevious", chord: "ArrowUp", scope: "search box" },
  { action: "openHighlighted", chord: "Enter", scope: "search box" },
  { action: "closeSearch", chord: "Escape", scope: "search box" },
  { action: "leaveTextBox", chord: "Escape", scope: "text box" },
  { action: "closeProfile", chord: "Escape", scope: "profile panel" },
  { action: "nextRow", chord: "j", scope: "inbox" },
  { action: "nextRow", chord: "ArrowDown", scope: "inbox" },
  { action: "previousRow", chord: "k", scope: "inbox" },
  { action: "previousRow", chord: "ArrowUp", scope: "inbox" },
  { action: "replyToRow", chord: "Enter", scope: "inbox" },
  { action: "replyToRow", chord: "r", scope: "inbox" },
  { action: "markRowRead", chord: "e", scope: "inbox" },
  { action: "markRowUnread", chord: "u", scope: "inbox" },
  { action: "openRow", chord: "o", scope: "inbox" },
  { action: "backToRows", chord: "Escape", scope: "inbox" },
] as const satisfies readonly { readonly action: string; readonly chord: string; readonly scope: Scope }[];

type Key = (typeof KEYS)[number];

type Action = Key["action"];

type ActionOf<Covered extends Scope> = Extract<Key, { readonly scope: Covered }>["action"];

export { type Action, type ActionOf, KEYS, type Key, SCOPES, type Scope, TEXT_SCOPES };
