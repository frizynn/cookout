import type { Board } from "../../board/index.ts";
import { LoginView } from "../../views/index.tsx";
import type { ReactNode } from "react";
import type { Route } from "./route.ts";
import type { Session } from "../../session/index.ts";
import { SignedInView } from "./signed-in-view.tsx";
import { useSyncExternalStore } from "react";

interface RouteViewProps {
  readonly board: Board;
  readonly route: Route;
  readonly session: Session;
}

export function RouteView(props: RouteViewProps): ReactNode {
  const { board, route, session } = props;
  const { status } = useSyncExternalStore(session.subscribe, session.snapshot);
  if (status !== "logged-in" || route.name === "login") {
    return <LoginView session={session} />;
  }
  return <SignedInView board={board} route={route} />;
}
