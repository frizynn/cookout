import type { AgentSessionResponse, JoinRequest, LeaveResponse } from "../../../agent-sessions/index.ts";
import type { AgentSessionStateFile, AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { CallFailure, ClientWithAgentSessionState, CredentialSource, JoinPlace } from "./adapters/sdk.ts";
import { Console, Effect, Option } from "effect";
import { answered, refused } from "./output.ts";
import { callClient, joinPlace, withClient, withJoinClient } from "./adapters/sdk.ts";
import type { CommandFailed } from "./output.ts";
import type { IdentityName } from "../../../identities/index.ts";

interface JoinFlags {
  readonly as: IdentityName;
  readonly force: boolean;
  readonly idleExpiry: Option.Option<string>;
}

interface JoinOptions extends Omit<JoinFlags, "as"> {
  readonly as: Option.Option<IdentityName>;
}

interface Issued {
  readonly issued: AgentSessionResponse;
  readonly source: CredentialSource;
}

type JoinAnswer = Omit<AgentSessionResponse, "agentSessionToken"> & { readonly source: CredentialSource };

const asMissing: CallFailure = {
  code: "usage",
  message: "`cookout join` needs --as <name>: an agent you own, or the token's own agent.",
};

function noHarness(as: IdentityName): CallFailure {
  return {
    code: "agent_tool_missing",
    message:
      "No agent tool runs this process, so there is no agent tool session to join in. Run " +
      `\`cookout join --as ${as} --print-env\` and run the \`export COOKOUT_SESSION=...\` line it prints instead.`,
  };
}

function noSessionId(harness: string, as: IdentityName): CallFailure {
  return {
    code: "agent_tool_session_missing",
    message:
      `${harness} gives no session ID to key a join by. Run \`cookout join --as ${as} --print-env\` and run ` +
      "the `export COOKOUT_SESSION=...` line it prints instead.",
  };
}

function alreadyJoined(identity: IdentityName): CallFailure {
  return {
    code: "already_joined",
    message:
      `This agent tool session has already joined as ${identity}. Run \`cookout leave\` first, or ` +
      "`cookout join --as <name> --print-env` to act as another agent from one subagent or script.",
  };
}

function joinRequest({ as, force, idleExpiry }: JoinFlags): JoinRequest {
  const asked = Option.match(idleExpiry, { onNone: () => ({ as }), onSome: (expiry) => ({ as, idleExpiry: expiry }) });
  if (force) {
    return { ...asked, force };
  }
  return asked;
}

function issue(flags: JoinFlags): Effect.Effect<Issued, CallFailure, AgentSessionStateNeeds> {
  return withJoinClient((opened) =>
    Effect.map(callClient((client) => client.join(joinRequest(flags)))(opened), (issued) => ({
      issued,
      source: opened.source,
    })),
  );
}

function issueAndKeep(
  flags: JoinFlags,
  { file, url }: { readonly file: AgentSessionStateFile; readonly url: string },
): Effect.Effect<JoinAnswer, CallFailure, AgentSessionStateNeeds> {
  return Effect.gen(function* joinAs() {
    const stored = yield* file.read;
    if (Option.isSome(stored)) {
      return yield* Effect.fail(alreadyJoined(stored.value.identity));
    }
    const {
      issued: { agentSessionToken, ...answer },
      source,
    } = yield* issue(flags);
    yield* file.write({ ...answer, agentSessionToken, url });
    return { ...answer, source };
  });
}

function joinIn(
  { file, place, url }: JoinPlace,
  flags: JoinFlags,
): Effect.Effect<JoinAnswer, CallFailure, AgentSessionStateNeeds> {
  const { harness = "" } = place;
  if (harness === "") {
    return Effect.fail(noHarness(flags.as));
  }
  if (Option.isNone(file)) {
    return Effect.fail(noSessionId(harness, flags.as));
  }
  return issueAndKeep(flags, { file: file.value, url });
}

function leaveAndForget(opened: ClientWithAgentSessionState): Effect.Effect<LeaveResponse, CallFailure> {
  return Effect.gen(function* leaveAgentSession() {
    const left = yield* callClient((client) => client.leave())(opened);
    if (Option.isSome(opened.joined)) {
      yield* opened.joined.value.file.remove;
    }
    return left;
  });
}

function join({ as, ...flags }: JoinOptions): Effect.Effect<JoinAnswer, CallFailure, AgentSessionStateNeeds> {
  if (Option.isNone(as)) {
    return Effect.fail(asMissing);
  }
  return Effect.flatMap(joinPlace, (place) => joinIn(place, { as: as.value, ...flags }));
}

function joinForEnvironment({ as, ...flags }: JoinOptions): Effect.Effect<Issued, CallFailure, AgentSessionStateNeeds> {
  if (Option.isNone(as)) {
    return Effect.fail(asMissing);
  }
  return issue({ as: as.value, ...flags });
}

function printExport({ issued: { agentSessionToken } }: Issued): Effect.Effect<void> {
  return Console.log(`export COOKOUT_SESSION=${agentSessionToken}`);
}

function joinCommandRun({
  printEnv,
  ...options
}: JoinOptions & { readonly printEnv: boolean }): Effect.Effect<void, CommandFailed, AgentSessionStateNeeds> {
  if (printEnv) {
    return Effect.matchEffect(joinForEnvironment(options), { onFailure: refused, onSuccess: printExport });
  }
  return answered(join(options));
}

const leave: Effect.Effect<LeaveResponse, CallFailure, AgentSessionStateNeeds> = withClient(leaveAndForget);

export { joinCommandRun, leave };
