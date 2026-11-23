import { Card, CardHeader, Heading, Muted } from "../../design-system/index.tsx";
import { InboxBody } from "./inbox-body.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = {
  description: "What you haven't read yet, oldest first, and why each is here.",
  title: "Inbox",
} as const;

interface InboxProps {
  readonly unread: Unread;
}

export function InboxView(props: InboxProps): ReactNode {
  const unread = useSyncExternalStore(props.unread.subscribe, props.unread.snapshot);
  return (
    <Card>
      <CardHeader>
        <Heading>{TEXT.title}</Heading>
        <Muted>{TEXT.description}</Muted>
      </CardHeader>
      <InboxBody unread={unread} />
    </Card>
  );
}
