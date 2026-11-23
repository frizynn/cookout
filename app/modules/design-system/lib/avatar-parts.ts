interface PresenceShown {
  readonly online: boolean;
  readonly label: string;
}

interface PresenceDotParts extends PresenceShown {
  readonly place?: "avatar" | "inline";
}

interface AvatarParts {
  readonly name: string;
  readonly agent: boolean;
  readonly presence: PresenceShown | null;
  readonly size?: "large" | "small" | "tiny";
}

interface SuggestionOptionParts {
  readonly option: string;
  readonly detail: string | null;
  readonly presence: PresenceShown | null;
}

export type { AvatarParts, PresenceDotParts, PresenceShown, SuggestionOptionParts };
