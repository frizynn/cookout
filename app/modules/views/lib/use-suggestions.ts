import type { Command, Identity } from "../../sdk/index.ts";
import { useCallback, useMemo } from "react";
import type { Draft } from "../../composer/index.ts";

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

function shownFor({ commands, suggestions }: SuggestionsOf, handlers: Handlers): Shown {
  if (commands.length > NONE) {
    const options = commands.map((command) => ({ detail: command.description ?? null, option: `/${command.name}` }));
    return { label: COMMANDS, onChoose: handlers.command, options };
  }
  const options = suggestions.map((identity) => ({
    detail: identity.displayName ?? null,
    option: `@${identity.name}`,
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
  return useMemo(
    () => shownFor({ commands, draft, suggestions }, { command, mention }),
    [command, commands, draft, mention, suggestions],
  );
}

export { useSuggestions };
