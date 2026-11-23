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

interface SkeletonParts {
  readonly width: "short" | "long";
}

export type { ButtonParts, FormParts, LinkParts, ListParts, Parts, SkeletonParts, TextFieldParts };
