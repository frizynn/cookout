import type { ReactNode } from "react";
import { useTimeAgo } from "./use-time-ago.ts";

interface SeenAgoProps {
  readonly at: string;
}

export function SeenAgo(props: SeenAgoProps): ReactNode {
  return ` ${useTimeAgo(props.at)}`;
}
