import { Description, Title } from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

interface ConfirmTextParts {
  readonly title: string;
  readonly body: string;
}

export function ConfirmText(parts: ConfirmTextParts): ReactNode {
  return (
    <>
      <Title asChild>
        <h2 className="text-sm font-semibold text-foreground">{parts.title}</h2>
      </Title>
      <Description asChild>
        <p className="text-xs text-muted-foreground">{parts.body}</p>
      </Description>
    </>
  );
}
