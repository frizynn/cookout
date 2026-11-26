import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useId } from "react";
import { LineFormSave } from "./line-form-save.tsx";
import { SECONDARY_BUTTON } from "./button-look.ts";
import { useFocusOnOpen } from "./focus-on-open.ts";

interface LineFormParts {
  readonly label: string;
  readonly field: string;
  readonly value: string;
  readonly saving: boolean;
  readonly onEdit: (text: string) => void;
  readonly onSubmit: () => void;
  readonly submit?: string;
  readonly submitLast?: boolean;
  readonly focused?: boolean | undefined;
  readonly onCancel?: (() => void) | undefined;
  readonly children?: ReactNode;
}

const SAVE = "Save";
const CANCEL = "Cancel";

export function LineForm(parts: LineFormParts): ReactNode {
  const { onEdit, onSubmit } = parts;
  const handleCancel = parts.onCancel;
  const id = useId();
  const submit = parts.submit ?? SAVE;
  const box = useFocusOnOpen<HTMLInputElement>(parts.focused === true);
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onEdit(event.currentTarget.value);
    },
    [onEdit],
  );
  const submitted = useCallback(() => {
    onSubmit();
  }, [onSubmit]);
  return (
    <form action={submitted} aria-label={parts.label} className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground max-md:text-[13px]" htmlFor={id}>
        {parts.field}
      </label>
      <span className="flex gap-2">
        <input
          autoComplete="off"
          className="h-8 min-w-0 flex-1 rounded-md border bg-surface px-3 text-sm text-foreground outline-none focus:border-muted-foreground max-md:h-11 max-md:rounded-[10px]"
          id={id}
          onChange={handleChange}
          ref={box}
          spellCheck={false}
          type="text"
          value={parts.value}
        />
        {parts.submitLast !== true && <LineFormSave below={false} saving={parts.saving} submit={submit} />}
        {typeof handleCancel === "function" && (
          <button className={SECONDARY_BUTTON} onClick={handleCancel} type="button">
            {CANCEL}
          </button>
        )}
      </span>
      {parts.children}
      {parts.submitLast === true && <LineFormSave below saving={parts.saving} submit={submit} />}
    </form>
  );
}
