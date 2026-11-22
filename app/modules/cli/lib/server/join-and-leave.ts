import type { CallFailure, ClientWithLeaseState } from "./adapters/sdk.ts";
import { Effect, Option } from "effect";
import type { JoinRequest, LeaseResponse, LeaveResponse } from "../../../leases/index.ts";
import { callClient, withClient } from "./adapters/sdk.ts";
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

function joinAndSave(flags: JoinFlags): (opened: ClientWithLeaseState) => Effect.Effect<LeaseResponse, CallFailure> {
  return (opened) =>
    Effect.gen(function* joinAs() {
      const lease = yield* callClient((client) => client.join(joinRequest(flags)))(opened);
      const state = { ...lease, identity: flags.as, url: opened.connection.url };
      yield* opened.file.write(state);
      return lease;
    });
}

function leaveAndForget(opened: ClientWithLeaseState): Effect.Effect<LeaveResponse, CallFailure> {
  return Effect.gen(function* leaveLease() {
    const left = yield* callClient((client) => client.leave())(opened);
    yield* opened.file.remove;
    return left;
  });
}

function join({ as, force }: JoinOptions): Effect.Effect<LeaseResponse, CallFailure, LeaseStateNeeds> {
  if (Option.isNone(as)) {
    return Effect.fail(asMissing);
  }
  return withClient(joinAndSave({ as: as.value, force }));
}

const leave: Effect.Effect<LeaveResponse, CallFailure, LeaseStateNeeds> = withClient(leaveAndForget);

export { join, leave };
