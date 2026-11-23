import { PeopleView, ProfileView } from "../../views/index.tsx";
import type { Identities } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import type { Layout } from "../../layout/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";

interface PeoplePanesProps {
  readonly identities: Identities;
  readonly layout: Layout;
  readonly me: IdentityName;
  readonly route: Extract<Route, { readonly name: "people" | "profile" }>;
}

function openOf(route: PeoplePanesProps["route"]): IdentityName | null {
  if (route.name === "profile") {
    return route.identity;
  }
  return null;
}

export function PeoplePanes(props: PeoplePanesProps): ReactNode {
  const { identities, route } = props;
  const open = openOf(route);
  return (
    <>
      <PeopleView identities={identities} layout={props.layout} me={props.me} open={open} />
      {open !== null && <ProfileView identities={identities} me={props.me} name={open} />}
    </>
  );
}
