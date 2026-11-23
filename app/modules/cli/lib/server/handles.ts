import { Array as Arr, Effect } from "effect";
import type { CallFailure, ClientWithAgentSessionState } from "./adapters/sdk.ts";
import type {
  DeactivateIdentityResponse,
  Identity,
  IdentityResponse,
  ListIdentitiesQuery,
  ListIdentitiesResponse,
} from "../../../identities/index.ts";
import { callClient, withClient } from "./adapters/sdk.ts";
import { deactivationWarning, handledCommands } from "../../../identities/client.ts";
import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import { identitiesWithPresence } from "./presence.ts";
import { printWarning } from "./output.ts";

type WithHandles = Identity & { readonly handles?: readonly string[] };

type Run<Value> = (opened: ClientWithAgentSessionState) => Effect.Effect<Value, CallFailure>;

const NONE = 0;

function withHandles(identity: Identity): WithHandles {
  const handles = handledCommands(identity);
  if (handles.length === NONE) {
    return identity;
  }
  return { ...identity, handles };
}

function oneWithHandles(run: Run<IdentityResponse>): Run<IdentityResponse> {
  return (opened) => Effect.map(run(opened), (answer) => ({ ...answer, identity: withHandles(answer.identity) }));
}

function listWithHandles(run: Run<ListIdentitiesResponse>): Run<ListIdentitiesResponse> {
  return (opened) =>
    Effect.map(run(opened), (answer) => ({ ...answer, identities: Arr.map(answer.identities, withHandles) }));
}

function warnIfHandler(name: string): Run<void> {
  return (opened) =>
    callClient((client) => client.getIdentity(name))(opened).pipe(
      Effect.map(({ identity }) => deactivationWarning(identity)),
      Effect.flatMap((warning) => Effect.when(printWarning(warning), Effect.succeed(warning.length > NONE))),
      Effect.ignore,
    );
}

function deactivateWarningHandler(name: string): Run<DeactivateIdentityResponse> {
  return (opened) =>
    Effect.andThen(warnIfHandler(name)(opened), callClient((client) => client.deactivateIdentity(name))(opened));
}

function identityAnswer(name: string): Effect.Effect<IdentityResponse, CallFailure, AgentSessionStateNeeds> {
  return withClient(oneWithHandles(callClient((client) => client.getIdentity(name))));
}

function identitiesAnswer(
  query: ListIdentitiesQuery,
): Effect.Effect<ListIdentitiesResponse, CallFailure, AgentSessionStateNeeds> {
  return withClient(listWithHandles(identitiesWithPresence(query)));
}

function deactivation(name: string): Effect.Effect<DeactivateIdentityResponse, CallFailure, AgentSessionStateNeeds> {
  return withClient(deactivateWarningHandler(name));
}

export { deactivation, identitiesAnswer, identityAnswer };
