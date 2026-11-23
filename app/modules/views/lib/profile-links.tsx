import { ProfileBase } from "./profile-base.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";

interface ProfileLinksProps {
  readonly route: Route;
  readonly children: ReactNode;
}

export function ProfileLinks(props: ProfileLinksProps): ReactNode {
  return <ProfileBase value={props.route}>{props.children}</ProfileBase>;
}
