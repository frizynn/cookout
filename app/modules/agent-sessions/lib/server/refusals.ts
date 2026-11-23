import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Refusal } from "../../../http/index.ts";

interface Live {
  readonly identity: IdentityName;
  readonly expiresAt: IsoTime;
}

interface WrongIdentity {
  readonly caller: IdentityName;
  readonly asked: IdentityName;
}

const BAD_REQUEST = 400;
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

function agentSessionLive({ expiresAt, identity }: Live): Refusal {
  return {
    code: "agent_session_live",
    details: { expiresAt },
    message: `Another session has joined as ${identity}; its agent session token expires at ${expiresAt} if unused. Run \`cookout leave\` there, or join with --force to revoke it.`,
    status: CONFLICT,
  };
}

function idleExpiryTooLong(maxIdleExpiry: string): Refusal {
  return {
    code: "idle_expiry_too_long",
    details: { maxIdleExpiry },
    message: `This cookout allows an idle expiry of at most ${maxIdleExpiry} (COOKOUT_MAX_IDLE_EXPIRY).`,
    status: BAD_REQUEST,
  };
}

const agentSessionRequired: Refusal = {
  code: "agent_session_required",
  message: "Leave revokes the agent session token it is sent with; this request was sent with another kind of token.",
  status: BAD_REQUEST,
};

export { agentSessionLive, agentSessionRequired, idleExpiryTooLong, notYourIdentity, onlyAgentsJoin };
