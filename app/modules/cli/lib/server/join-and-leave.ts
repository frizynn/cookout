import type { AgentSessionResponse, JoinRequest, LeaveResponse } from "../../../agent-sessions/index.ts";
import type { CallFailure, ClientWithAgentSessionState } from "./adapters/sdk.ts";
import { Effect, Option } from "effect";
import { callClient, withClient, withIdentityTokenClient } from "./adapters/sdk.ts";
import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { IdentityName } from "../../../identities/index.ts";

interface JoinFlags {
  readonly as: IdentityName;
  readonly force: boolean;
  readonly idleExpiry: Option.Option<string>;
}

interface JoinOptions extends Omit<JoinFlags, "as"> {
  readonly as: Option.Option<IdentityName>;
}

const asMissing: CallFailure = {
  code: "usage",
  message: "`cookout join` needs --as <name>, the token's own identity.",
};

function joinRequest({ as, force, idleExpiry }: JoinFlags): JoinRequest {
  const asked = Option.match(idleExpiry, { onNone: () => ({ as }), onSome: (expiry) => ({ as, idleExpiry: expiry }) });
  if (force) {
    return { ...asked, force };
  }
  return asked;
}

function joinAndSave(
  flags: JoinFlags,
): (opened: ClientWithAgentSessionState) => Effect.Effect<AgentSessionResponse, CallFailure> {
  return (opened) =>
    Effect.gen(function* joinAs() {
      const issued = yield* callClient((client) => client.join(joinRequest(flags)))(opened);
      yield* opened.file.write({ ...issued, identity: flags.as, url: opened.connection.url });
      return issued;
    });
}

function leaveAndForget(opened: ClientWithAgentSessionState): Effect.Effect<LeaveResponse, CallFailure> {
  return Effect.gen(function* leaveAgentSession() {
    const left = yield* callClient((client) => client.leave())(opened);
    yield* opened.file.remove;
    return left;
  });
}

function join({ as, ...flags }: JoinOptions): Effect.Effect<AgentSessionResponse, CallFailure, AgentSessionStateNeeds> {
  if (Option.isNone(as)) {
    return Effect.fail(asMissing);
  }
  return withIdentityTokenClient(joinAndSave({ as: as.value, ...flags }));
}

const leave: Effect.Effect<LeaveResponse, CallFailure, AgentSessionStateNeeds> = withClient(leaveAndForget);

export { join, leave };
