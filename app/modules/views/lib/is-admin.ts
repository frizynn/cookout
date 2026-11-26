import type { Identity } from "../../sdk/index.ts";

interface AdminOf {
  readonly identities: readonly Identity[];
  readonly me: string;
}

function isAdmin({ identities, me }: AdminOf): boolean {
  return identities.some((identity) => identity.name === me && identity.admin);
}

export { isAdmin };
