import { Card, CardHeader, Heading, Muted } from "../../design-system/index.tsx";
import type { ReactNode } from "react";

interface NotBuiltProps {
  readonly title: string;
  readonly description: string;
}

export function NotBuiltView(props: NotBuiltProps): ReactNode {
  return (
    <Card>
      <CardHeader>
        <Heading>{props.title}</Heading>
        <Muted>{props.description}</Muted>
      </CardHeader>
    </Card>
  );
}
