import type { CallFailure, Session } from "./adapters/sdk.ts";
import { Effect, Option } from "effect";
import type { JoinRequest, LeaseResponse, LeaveResponse } from "../../../leases/index.ts";
import { callClient, withSession } from "./adapters/sdk.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { LeaseStateNeeds } from "./lease-state.ts";

interface JoinFlags {
  readonly as: IdentityName;
  readonly force: boolean;
}

interface JoinOptions {
  readonly as: Option.Option<IdentityName>;
  readonly force: boolean;
}

const asMissing: CallFailure = {
  code: "usage",
  message: "`cookout join` needs --as <name>, the token's own identity.",
};

function joinRequest({ as, force }: JoinFlags): JoinRequest {
  if (force) {
    return { as, force };
  }
  return { as };
}

function joinAndSave(flags: JoinFlags): (session: Session) => Effect.Effect<LeaseResponse, CallFailure> {
  return (session) =>
    Effect.gen(function* joinAs() {
      const lease = yield* callClient((client) => client.join(joinRequest(flags)))(session);
      const state = { ...lease, identity: flags.as, url: session.url };
      yield* session.file.write(state);
      return lease;
    });
}

function leaveAndForget(session: Session): Effect.Effect<LeaveResponse, CallFailure> {
  return Effect.gen(function* leaveLease() {
    const left = yield* callClient((client) => client.leave())(session);
    yield* session.file.remove;
    return left;
  });
}

function join({ as, force }: JoinOptions): Effect.Effect<LeaseResponse, CallFailure, LeaseStateNeeds> {
  if (Option.isNone(as)) {
    return Effect.fail(asMissing);
  }
  return withSession(joinAndSave({ as: as.value, force }));
}

const leave: Effect.Effect<LeaveResponse, CallFailure, LeaseStateNeeds> = withSession(leaveAndForget);

export { join, leave };
