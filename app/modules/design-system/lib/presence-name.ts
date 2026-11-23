import type { PresenceShown } from "./avatar-parts.ts";

interface Named {
  readonly name: string;
  readonly presence: PresenceShown | null;
}

export function presenceNameOf({ name, presence }: Named): string {
  if (presence === null) {
    return name;
  }
  return `${name}, ${presence.spoken}`;
}
