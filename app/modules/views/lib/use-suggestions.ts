import type { Command, Identity } from "../../sdk/index.ts";
import { useCallback, useMemo } from "react";
import type { Draft } from "../../composer/index.ts";

const NONE = 0;
const SIGN = 1;
const MENTIONS = "Mention suggestions";
const COMMANDS = "Command suggestions";
const NO_DETAILS = {} as const;

type Details = Readonly<Partial<Record<string, string>>>;

interface SuggestionsOf {
  readonly draft: Draft;
  readonly suggestions: readonly Identity[];
  readonly commands: readonly Command[];
}

interface Shown {
  readonly label: string;
  readonly options: readonly string[];
  readonly details: Details;
  readonly onChoose: (option: string) => void;
}

interface Handlers {
  readonly mention: (option: string) => void;
  readonly command: (option: string) => void;
}

function detailsOf(commands: readonly Command[]): Details {
  const details: Record<string, string> = {};
  for (const { description, name } of commands) {
    if (typeof description === "string") {
      details[`/${name}`] = description;
    }
  }
  return details;
}

function shownFor({ commands, suggestions }: SuggestionsOf, handlers: Handlers): Shown {
  if (suggestions.length > NONE) {
    const options = suggestions.map((identity) => `@${identity.name}`);
    return { details: NO_DETAILS, label: MENTIONS, onChoose: handlers.mention, options };
  }
  if (commands.length > NONE) {
    const options = commands.map((command) => `/${command.name}`);
    return { details: detailsOf(commands), label: COMMANDS, onChoose: handlers.command, options };
  }
  return { details: NO_DETAILS, label: MENTIONS, onChoose: handlers.mention, options: [] };
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
