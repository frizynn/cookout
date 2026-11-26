interface OptionRowChoice {
  readonly name: string;
  readonly label: string;
  readonly hint?: string;
  readonly mark?: string;
}

interface OptionRowsParts {
  readonly label: string;
  readonly choices: readonly OptionRowChoice[];
  readonly value: string;
  readonly onChoose: (value: string) => void;
}

interface OptionRowParts {
  readonly choice: OptionRowChoice;
  readonly name: string;
  readonly chosen: boolean;
  readonly onChoose: (value: string) => void;
}

interface ChoiceFieldParts {
  readonly label: string;
  readonly help: string | null;
  readonly choices: readonly { readonly label: string; readonly value: string }[];
  readonly value: string;
  readonly onChoose: (value: string) => void;
}

export type { ChoiceFieldParts, OptionRowChoice, OptionRowParts, OptionRowsParts };
