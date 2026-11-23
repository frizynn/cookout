import type { FormParts } from "./parts.ts";
import type { ReactNode } from "react";
import { useCallback } from "react";

export function Form(parts: FormParts): ReactNode {
  const { field, onSubmit } = parts;
  const submitted = useCallback(
    (values: Readonly<FormData>) => {
      const value = values.get(field);
      if (typeof value === "string") {
        onSubmit(value);
      }
    },
    [field, onSubmit],
  );
  return (
    <form action={submitted} aria-label={parts.label} className="flex flex-col gap-3 p-4">
      {parts.children}
    </form>
  );
}
