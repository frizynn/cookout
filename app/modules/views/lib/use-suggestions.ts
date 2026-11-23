import type { Command, Identity } from "../../sdk/index.ts";
import { shownIn, usePresences } from "./use-presence.ts";
import { useCallback, useMemo } from "react";
import type { Draft } from "../../composer/index.ts";
import type { PresenceShown } from "./use-presence.ts";
import type { Presences } from "../../presence-store/index.ts";

const NONE = 0;
const SIGN = 1;
const MENTIONS = "Mention suggestions";
const COMMANDS = "Command suggestions";

interface SuggestionsOf {
  readonly draft: Draft;
  readonly suggestions: readonly Identity[];
  readonly commands: readonly Command[];
}

interface Suggestion {
  readonly option: string;
  readonly detail: string | null;
  readonly presence: PresenceShown | null;
}

interface Shown {
  readonly label: string;
  readonly options: readonly Suggestion[];
  readonly onChoose: (option: string) => void;
}

interface Handlers {
  readonly mention: (option: string) => void;
  readonly command: (option: string) => void;
}

function shownFor({ commands, suggestions }: SuggestionsOf, handlers: Handlers, presences: Presences): Shown {
  if (commands.length > NONE) {
    const options = commands.map((command) => ({
      detail: command.description ?? null,
      option: `/${command.name}`,
      presence: null,
    }));
    return { label: COMMANDS, onChoose: handlers.command, options };
  }
  const options = suggestions.map((identity) => ({
    detail: identity.displayName ?? null,
    option: `@${identity.name}`,
    presence: shownIn({ name: identity.name, presences }),
  }));
  return { label: MENTIONS, onChoose: handlers.mention, options };
}

function useSuggestions(of: SuggestionsOf): Shown {
  const { commands, draft, suggestions } = of;
  const mention = useCallback(
    (option: string) => {
      draft.choose(option.slice(SIGN));
    },
    [draft],
  );
  const command = useCallback(
    (option: string) => {
      draft.pick(option.slice(SIGN));
    },
    [draft],
  );
  const presences = usePresences();
  return useMemo(
    () => shownFor({ commands, draft, suggestions }, { command, mention }, presences),
    [command, commands, draft, mention, presences, suggestions],
  );
}

export { useSuggestions };
