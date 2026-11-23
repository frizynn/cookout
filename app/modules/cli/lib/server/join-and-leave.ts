import type { AgentSessionResponse, JoinRequest, LeaveResponse } from "../../../agent-sessions/index.ts";
import type { AgentSessionStateFile, AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { CallFailure, ClientWithAgentSessionState, JoinPlace } from "./adapters/sdk.ts";
import { Console, Effect, Option } from "effect";
import { answered, refused } from "./output.ts";
import { callClient, joinPlace, withClient, withIdentityTokenClient } from "./adapters/sdk.ts";
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

const asMissing: CallFailure = {
  code: "usage",
  message: "`cookout join` needs --as <name>, the token's own identity.",
};

function noAgentTool(as: IdentityName): CallFailure {
  return {
    code: "agent_tool_missing",
    message:
      "No agent tool runs this process, so there is no agent tool session to join in. Run " +
      `\`cookout join --as ${as} --print-env\` and run the \`export COOKOUT_SESSION=...\` line it prints instead.`,
  };
}

function noSessionId(agentTool: string, as: IdentityName): CallFailure {
  return {
    code: "agent_tool_session_missing",
    message:
      `${agentTool} gives no session ID to key a join by. Run \`cookout join --as ${as} --print-env\` and run ` +
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

function issue(flags: JoinFlags): Effect.Effect<AgentSessionResponse, CallFailure, AgentSessionStateNeeds> {
  return withIdentityTokenClient(callClient((client) => client.join(joinRequest(flags))));
}

function issueAndKeep(
  flags: JoinFlags,
  { file, url }: { readonly file: AgentSessionStateFile; readonly url: string },
): Effect.Effect<AgentSessionResponse, CallFailure, AgentSessionStateNeeds> {
  return Effect.gen(function* joinAs() {
    const stored = yield* file.read;
    if (Option.isSome(stored)) {
      return yield* Effect.fail(alreadyJoined(stored.value.identity));
    }
    const issued = yield* issue(flags);
    yield* file.write({ ...issued, identity: flags.as, url });
    return issued;
  });
}

function joinIn(
  { file, place, url }: JoinPlace,
  flags: JoinFlags,
): Effect.Effect<AgentSessionResponse, CallFailure, AgentSessionStateNeeds> {
  const { agentTool = "" } = place;
  if (agentTool === "") {
    return Effect.fail(noAgentTool(flags.as));
  }
  if (Option.isNone(file)) {
    return Effect.fail(noSessionId(agentTool, flags.as));
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

function join({ as, ...flags }: JoinOptions): Effect.Effect<AgentSessionResponse, CallFailure, AgentSessionStateNeeds> {
  if (Option.isNone(as)) {
    return Effect.fail(asMissing);
  }
  return Effect.flatMap(joinPlace, (place) => joinIn(place, { as: as.value, ...flags }));
}

function joinForEnvironment({
  as,
  ...flags
}: JoinOptions): Effect.Effect<AgentSessionResponse, CallFailure, AgentSessionStateNeeds> {
  if (Option.isNone(as)) {
    return Effect.fail(asMissing);
  }
  return issue({ as: as.value, ...flags });
}

function printExport({ agentSessionToken }: AgentSessionResponse): Effect.Effect<void> {
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
