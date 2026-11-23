import type { Command, Identity } from "../../sdk/index.ts";

const MOST_SUGGESTIONS = 8;
const NOTHING = 0;
const AT_SIGN = 1;
const ONE = 1;
const STEPS = { down: ONE, up: -ONE } as const;

const typedMention = /(?<![\w.@-])@[a-z0-9-]*$/u;
const typedCommand = /^\/[a-z0-9-]*$/u;

function suggestionsFor(identities: readonly Identity[], text: string, caret: number): readonly Identity[] {
  const found = typedMention.exec(text.slice(NOTHING, caret));
  if (found === null) {
    return [];
  }
  const [mention] = found;
  const prefix = mention.slice(AT_SIGN);
  return identities.filter((identity) => identity.name.startsWith(prefix)).slice(NOTHING, MOST_SUGGESTIONS);
}

function commandsFor(commands: readonly Command[], text: string): readonly Command[] {
  if (!typedCommand.test(text)) {
    return [];
  }
  const prefix = text.slice(ONE);
  return commands.filter((command) => command.name.startsWith(prefix)).slice(NOTHING, MOST_SUGGESTIONS);
}

interface DraftSnapshot {
  readonly text: string;
  readonly caret: number;
  readonly suggestions: readonly Identity[];
  readonly commands: readonly Command[];
  readonly command: Command | null;
  readonly highlighted: number;
}

interface Sources {
  readonly identities: () => readonly Identity[];
  readonly commands: () => readonly Command[];
}

const EMPTY = { caret: NOTHING, command: null, commands: [], highlighted: NOTHING, suggestions: [], text: "" };

type Typed = Pick<DraftSnapshot, "caret" | "text">;

function written(sources: Sources, previous: DraftSnapshot, typed: Typed): DraftSnapshot {
  const { caret, text } = typed;
  const commands = commandsFor(sources.commands(), text);
  const suggestions = suggestionsFor(sources.identities(), text, caret);
  return { caret, command: previous.command, commands, highlighted: NOTHING, suggestions, text };
}

function mentioned(sources: Sources, snapshot: DraftSnapshot, name: string): DraftSnapshot {
  const before = snapshot.text.slice(NOTHING, snapshot.caret).replace(typedMention, "");
  const mention = `@${name} `;
  const text = before + mention + snapshot.text.slice(snapshot.caret);
  return written(sources, snapshot, { caret: before.length + mention.length, text });
}

function picked(snapshot: DraftSnapshot, commands: readonly Command[]): DraftSnapshot {
  let result = snapshot;
  for (const command of commands) {
    result = { ...EMPTY, command };
  }
  return result;
}

function chosen(sources: Sources, snapshot: DraftSnapshot): DraftSnapshot {
  const at = snapshot.highlighted;
  let result = picked(snapshot, snapshot.commands.slice(at, at + ONE));
  for (const identity of snapshot.suggestions.slice(at, at + ONE)) {
    result = mentioned(sources, snapshot, identity.name);
  }
  return result;
}

function highlightMoved(snapshot: DraftSnapshot, direction: "down" | "up"): DraftSnapshot {
  const count = Math.max(ONE, snapshot.suggestions.length + snapshot.commands.length);
  return { ...snapshot, highlighted: (snapshot.highlighted + STEPS[direction] + count) % count };
}

function dismissed(snapshot: DraftSnapshot): DraftSnapshot {
  return { ...snapshot, commands: [], highlighted: NOTHING, suggestions: [] };
}

interface Changes {
  readonly written: (previous: DraftSnapshot, typed: Typed) => DraftSnapshot;
  readonly mentioned: (snapshot: DraftSnapshot, name: string) => DraftSnapshot;
  readonly picked: (snapshot: DraftSnapshot, commands: readonly Command[]) => DraftSnapshot;
  readonly chosen: (snapshot: DraftSnapshot) => DraftSnapshot;
  readonly highlightMoved: (snapshot: DraftSnapshot, direction: "down" | "up") => DraftSnapshot;
  readonly dismissed: (snapshot: DraftSnapshot) => DraftSnapshot;
}

function changesFor(sources: Sources): Changes {
  return {
    chosen: (snapshot) => chosen(sources, snapshot),
    dismissed,
    highlightMoved,
    mentioned: (snapshot, name) => mentioned(sources, snapshot, name),
    picked,
    written: (previous, typed) => written(sources, previous, typed),
  };
}

export { type DraftSnapshot, type Sources, EMPTY, changesFor };
