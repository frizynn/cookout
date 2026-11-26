import type { CalendarDay, CalendarMonth, CalendarWeek } from "../../format/index.ts";
import type { KeyboardEvent, ReactNode } from "react";
import type { FieldIds } from "./prompt-parts.ts";

type PickerKind = "date" | "time";

interface PickerTriggerParts {
  readonly ids: FieldIds;
  readonly kind: PickerKind;
  readonly text: string | null;
  readonly placeholder: string;
  readonly spoken: string;
  readonly invalid: boolean;
}

interface PickerPopoverParts extends PickerTriggerParts {
  readonly label: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
}

interface CalendarParts {
  readonly selected: string;
  readonly today: string;
  readonly onPick: (day: string) => void;
}

interface CalendarStepsParts {
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

interface CalendarHeaderParts extends CalendarStepsParts {
  readonly title: string;
  readonly label: string;
}

interface CalendarMarks {
  readonly selected: string;
  readonly today: string;
  readonly focused: string;
  readonly onPick: (day: string) => void;
  readonly onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

interface CalendarWeeksParts {
  readonly month: CalendarMonth;
  readonly marks: CalendarMarks;
}

interface CalendarWeekParts {
  readonly week: CalendarWeek;
  readonly marks: CalendarMarks;
}

interface CalendarCellParts {
  readonly day: CalendarDay;
  readonly marks: CalendarMarks;
}

interface TimeListParts {
  readonly selected: string;
  readonly onPick: (time: string) => void;
}

interface TimeOptionParts {
  readonly time: string;
  readonly selected: boolean;
  readonly first: boolean;
  readonly onPick: (time: string) => void;
  readonly onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export type {
  CalendarCellParts,
  CalendarHeaderParts,
  CalendarMarks,
  CalendarParts,
  CalendarStepsParts,
  CalendarWeekParts,
  CalendarWeeksParts,
  PickerKind,
  PickerPopoverParts,
  PickerTriggerParts,
  TimeListParts,
  TimeOptionParts,
};
