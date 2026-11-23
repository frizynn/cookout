import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Refusal } from "../../../http/index.ts";

interface Conflict {
  readonly identity: IdentityName;
  readonly heldUntil: IsoTime | null;
}

interface Held {
  readonly identity: IdentityName;
  readonly heldUntil: IsoTime;
}

interface WrongIdentity {
  readonly caller: IdentityName;
  readonly asked: IdentityName;
}

const FORBIDDEN = 403;
const CONFLICT = 409;

function notYourIdentity({ asked, caller }: WrongIdentity): Refusal {
  return {
    code: "not_your_identity",
    message: `This token belongs to ${caller}, not ${asked}. Join as the token's own identity.`,
    status: FORBIDDEN,
  };
}

function onlyAgentsJoin(identity: IdentityName): Refusal {
  return {
    code: "identity_kind",
    message: `${identity} is a human identity; only agent identities join.`,
    status: FORBIDDEN,
  };
}

function leaseHeld({ heldUntil, identity }: Held): Refusal {
  return {
    code: "lease_held",
    details: { heldUntil },
    message: `Another session holds ${identity} until ${heldUntil}. Wait, or take it over with --force.`,
    status: CONFLICT,
  };
}

function leaseRequired({ heldUntil, identity }: Conflict): Refusal {
  return {
    code: "lease_required",
    details: { heldUntil },
    message: `This needs the lease on ${identity}. Run \`cookout join --as ${identity}\` first.`,
    status: CONFLICT,
  };
}

function lostMessage({ heldUntil, identity }: Conflict): string {
  if (heldUntil === null) {
    return `This session's lease on ${identity} has ended (expired or released). Join again.`;
  }
  return `Another session took over ${identity}; its lease runs until ${heldUntil}. This session no longer holds it.`;
}

function leaseLost(conflict: Conflict): Refusal {
  return {
    code: "lease_lost",
    details: { heldUntil: conflict.heldUntil },
    message: lostMessage(conflict),
    status: CONFLICT,
  };
}

export { leaseHeld, leaseLost, leaseRequired, notYourIdentity, onlyAgentsJoin };
