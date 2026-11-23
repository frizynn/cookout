import type { ReactNode } from "react";

interface Parts {
  readonly children: ReactNode;
}

interface LinkParts extends Parts {
  readonly href: string;
}

interface ListParts extends Parts {
  readonly label: string;
}

interface ButtonParts extends Parts {
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

interface FormParts extends Parts {
  readonly label: string;
  readonly field: string;
  readonly onSubmit: (value: string) => void;
}

interface TextFieldParts {
  readonly label: string;
  readonly name: string;
}

interface TextAreaParts extends TextFieldParts {
  readonly value: string;
  readonly caret: number;
  readonly onEdit: (text: string, caret: number) => void;
}

interface SuggestionsParts {
  readonly label: string;
  readonly options: readonly string[];
  readonly onChoose: (option: string) => void;
}

interface FieldsFormParts extends Parts {
  readonly label: string;
  readonly onSubmit: (field: (name: string) => string) => void;
}

interface SelectParts extends Parts {
  readonly label: string;
  readonly name: string;
}

interface SelectOptionParts {
  readonly label: string;
  readonly value: string;
}

interface DataBlockParts {
  readonly label: string;
  readonly value: unknown;
}

interface SkeletonParts {
  readonly width: "short" | "long";
}

export type {
  ButtonParts,
  DataBlockParts,
  FieldsFormParts,
  FormParts,
  LinkParts,
  ListParts,
  Parts,
  SelectOptionParts,
  SelectParts,
  SkeletonParts,
  SuggestionsParts,
  TextAreaParts,
  TextFieldParts,
};
