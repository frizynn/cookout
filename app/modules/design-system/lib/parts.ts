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

interface DataAreaParts extends TextFieldParts {
  readonly value: string;
  readonly onEdit: (text: string) => void;
}

interface TextAreaParts extends TextFieldParts {
  readonly value: string;
  readonly caret: number;
  readonly onEdit: (text: string, caret: number) => void;
  readonly choosing: boolean;
  readonly onPick: () => void;
  readonly onMove: (direction: "down" | "up") => void;
  readonly onClose: () => void;
}

interface SuggestionsParts {
  readonly label: string;
  readonly options: readonly string[];
  readonly details: Readonly<Partial<Record<string, string>>>;
  readonly highlighted: number;
  readonly onChoose: (option: string) => void;
}

interface PromptButtonsParts {
  readonly busy: boolean;
  readonly button: string;
  readonly busyButton: string;
  readonly onCancel: () => void;
}

interface PromptFormParts extends Parts, PromptButtonsParts {
  readonly label: string;
  readonly title: string;
  readonly description: string | null;
  readonly onSubmit: () => void;
}

interface PromptFieldParts {
  readonly label: string;
  readonly help: string | null;
  readonly error: string | null;
  readonly required: boolean;
}

interface FieldIds {
  readonly control: string;
  readonly help: string;
  readonly error: string;
  readonly describedBy: string;
}

interface FieldLabelParts {
  readonly label: string;
  readonly required: boolean;
  readonly ids: FieldIds;
}

interface FieldNotesParts {
  readonly help: string | null;
  readonly error: string | null;
  readonly ids: FieldIds;
}

interface InputFieldParts extends PromptFieldParts {
  readonly kind: "text" | "number" | "integer";
  readonly value: string;
  readonly onEdit: (value: string) => void;
}

interface PickFieldParts extends PromptFieldParts {
  readonly options: readonly string[];
  readonly value: string;
  readonly onEdit: (value: string) => void;
}

interface CheckFieldParts extends PromptFieldParts {
  readonly checked: boolean;
  readonly onEdit: (checked: boolean) => void;
}

interface AvatarParts {
  readonly name: string;
  readonly agent: boolean;
}

interface WorkspaceParts extends Parts {
  readonly sidebarOpen: boolean;
  readonly onToggleSidebar: () => void;
}

interface SidebarParts extends Parts {
  readonly label: string;
  readonly title: string;
  readonly open: boolean;
}

interface NavLinkParts {
  readonly href: string;
  readonly children?: ReactNode;
  readonly label: string;
  readonly active: boolean;
  readonly marked: boolean;
  readonly icon: "inbox" | "people" | "channel";
}

interface PillParts {
  readonly count: number;
  readonly label: string;
  readonly tone: "loud" | "quiet" | "unseen";
}

interface PaneHeaderParts {
  readonly title: string;
  readonly description: string | null;
}

interface SidePanelParts extends Parts {
  readonly label: string;
  readonly detail: string;
  readonly closeHref: string;
  readonly closeLabel: string;
}

interface ChoiceParts {
  readonly label: string;
  readonly value: string;
}

interface ChoiceGroupParts {
  readonly label: string;
  readonly choices: readonly ChoiceParts[];
  readonly value: string;
  readonly onChoose: (value: string) => void;
}

interface ToggleButtonParts extends Parts {
  readonly expanded: boolean;
  readonly onClick: () => void;
}

interface AuthorParts extends AvatarParts {
  readonly shown: string;
}

interface DataBlockParts {
  readonly label: string;
  readonly value: unknown;
}

interface CountParts {
  readonly count: number;
  readonly label: string;
  readonly tone: "plain" | "mention";
}

interface RowTitleParts extends Parts {
  readonly title: string;
  readonly marked: boolean;
}

interface SkeletonParts {
  readonly width: "short" | "long";
}

export type {
  AuthorParts,
  CheckFieldParts,
  FieldIds,
  FieldLabelParts,
  FieldNotesParts,
  InputFieldParts,
  PickFieldParts,
  PromptButtonsParts,
  PromptFieldParts,
  PromptFormParts,
  AvatarParts,
  ButtonParts,
  ChoiceGroupParts,
  NavLinkParts,
  PaneHeaderParts,
  PillParts,
  SidebarParts,
  SidePanelParts,
  ToggleButtonParts,
  WorkspaceParts,
  CountParts,
  DataAreaParts,
  DataBlockParts,
  FormParts,
  LinkParts,
  ListParts,
  Parts,
  RowTitleParts,
  SkeletonParts,
  SuggestionsParts,
  TextAreaParts,
  TextFieldParts,
};
