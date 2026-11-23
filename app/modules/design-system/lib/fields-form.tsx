import type { FieldsFormParts } from "./parts.ts";
import type { ReactNode } from "react";
import { useCallback } from "react";

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function textOf(values: Readonly<FormData>, field: string): string {
  return values
    .getAll(field)
    .filter((value) => isText(value))
    .join("");
}

export function FieldsForm(parts: FieldsFormParts): ReactNode {
  const { onSubmit } = parts;
  const submitted = useCallback(
    (values: Readonly<FormData>) => {
      onSubmit((field) => textOf(values, field));
    },
    [onSubmit],
  );
  return (
    <form action={submitted} aria-label={parts.label} className="flex flex-col gap-3 p-4">
      {parts.children}
    </form>
  );
}
