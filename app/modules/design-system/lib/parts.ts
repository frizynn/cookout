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
}

interface SuggestionsParts {
  readonly label: string;
  readonly options: readonly string[];
  readonly highlighted: number;
  readonly onChoose: (option: string) => void;
}

interface AvatarParts {
  readonly name: string;
  readonly agent: boolean;
  readonly size?: "large" | "small";
}

interface TagParts {
  readonly label: string;
}

interface ChipParts extends Parts {
  readonly pressed: boolean;
  readonly onClick: () => void;
}

interface FilterFieldParts {
  readonly label: string;
  readonly value: string;
  readonly onEdit: (text: string) => void;
}

interface IdentityRowParts {
  readonly href: string;
  readonly name: string;
  readonly agent: boolean;
  readonly active: boolean;
  readonly detail: string;
  readonly note: string | null;
  readonly children?: ReactNode;
}

interface ProfileParts extends Parts {
  readonly name: string;
  readonly agent: boolean;
}

interface ProfileNameParts {
  readonly name: string;
  readonly children?: ReactNode;
}

interface DateTextParts {
  readonly time: string;
}

interface IdentityLinkParts {
  readonly href: string;
  readonly name: string;
  readonly agent: boolean;
  readonly active: boolean;
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
  readonly sans?: boolean;
  readonly children?: ReactNode;
}

interface PressButtonParts extends Parts {
  readonly pressed: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
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
  IdentityLinkParts,
  ChipParts,
  DateTextParts,
  FilterFieldParts,
  IdentityRowParts,
  ProfileNameParts,
  ProfileParts,
  TagParts,
  AuthorParts,
  AvatarParts,
  ButtonParts,
  ChoiceGroupParts,
  NavLinkParts,
  PaneHeaderParts,
  PressButtonParts,
  PillParts,
  SidebarParts,
  SidePanelParts,
  ToggleButtonParts,
  WorkspaceParts,
  CountParts,
  DataAreaParts,
  DataBlockParts,
  FieldsFormParts,
  FormParts,
  LinkParts,
  ListParts,
  Parts,
  RowTitleParts,
  SelectOptionParts,
  SelectParts,
  SkeletonParts,
  SuggestionsParts,
  TextAreaParts,
  TextFieldParts,
};
