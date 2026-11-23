import { createContext, useContext } from "react";
import type { IdentityName } from "../../sdk/index.ts";
import type { Route } from "../../paths/index.ts";
import { profileHref } from "../../paths/index.ts";

const PEOPLE: Route = { name: "people" };

const ProfileBase = createContext<Route>(PEOPLE);

function useProfileHref(): (name: IdentityName) => string {
  const route = useContext(ProfileBase);
  return (identity) => profileHref({ identity, route });
}

export { ProfileBase, useProfileHref };
