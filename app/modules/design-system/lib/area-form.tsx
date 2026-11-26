import { useCallback, useId } from "react";
import { AreaBox } from "./area-box.tsx";
import { LineFormSave } from "./line-form-save.tsx";
import type { ReactNode } from "react";

interface AreaFormParts {
  readonly label: string;
  readonly field: string;
  readonly value: string;
  readonly limit: number;
  readonly saving: boolean;
  readonly onEdit: (text: string) => void;
  readonly onSubmit: () => void;
  readonly children?: ReactNode;
}

const SAVE = "Save";

export function AreaForm(parts: AreaFormParts): ReactNode {
  const { onEdit, onSubmit } = parts;
  const id = useId();
  const submitted = useCallback(() => {
    onSubmit();
  }, [onSubmit]);
  return (
    <form action={submitted} aria-label={parts.label} className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground max-md:text-[13px]" htmlFor={id}>
        {parts.field}
      </label>
      <span className="flex items-start gap-2">
        <AreaBox labelled={id} limit={parts.limit} onEdit={onEdit} value={parts.value} />
        <LineFormSave below={false} saving={parts.saving} submit={SAVE} />
      </span>
      {parts.children}
    </form>
  );
}
