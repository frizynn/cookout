import { Array as Arr, Effect, Option } from "effect";
import type { CallFailure, ClientWithAgentSessionState } from "./adapters/sdk.ts";
import type {
  Identity,
  IdentityResponse,
  ListIdentitiesQuery,
  ListIdentitiesResponse,
} from "../../../identities/index.ts";
import type { Presence, PresenceResponse } from "../../../events/index.ts";
import { callClient } from "./adapters/sdk.ts";
import { presenceName } from "../../../presence/index.ts";

type WithPresence = Identity & { readonly [presenceName]: Presence };

interface Answered {
  readonly opened: ClientWithAgentSessionState;
  readonly answer: IdentityResponse;
}

const readPresence = callClient((client) => client.presence());

function presenceOf(everyone: PresenceResponse, identity: Identity): Presence {
  const found = Arr.findFirst(everyone.presence, (each) => each.identity === identity.name);
  return Option.getOrElse(found, () => ({ identity: identity.name, online: false }));
}

function withPresence(everyone: PresenceResponse): (identity: Identity) => WithPresence {
  return (identity) => ({ ...identity, [presenceName]: presenceOf(everyone, identity) });
}

function identitiesWithPresence(
  query: ListIdentitiesQuery,
): (opened: ClientWithAgentSessionState) => Effect.Effect<ListIdentitiesResponse, CallFailure> {
  return (opened) =>
    Effect.gen(function* listWithPresence() {
      const listed = yield* callClient((client) => client.listIdentities(query))(opened);
      const everyone = yield* readPresence(opened);
      return { ...listed, identities: Arr.map(listed.identities, withPresence(everyone)) };
    });
}

function identityWithPresence({ answer, opened }: Answered): Effect.Effect<IdentityResponse, CallFailure> {
  return Effect.map(readPresence(opened), (everyone) => ({
    ...answer,
    identity: withPresence(everyone)(answer.identity),
  }));
}

export { identitiesWithPresence, identityWithPresence };
