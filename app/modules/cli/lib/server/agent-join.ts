import type {
  AgentJoinCollectedResponse,
  AgentJoinRequestStartedResponse,
  AgentSessionResponse,
} from "../../../agent-sessions/index.ts";
import { Console, Duration, Effect, Function, Option } from "effect";
import type { CallFailure } from "./adapters/sdk.ts";
import type { CookoutClient } from "../../../sdk/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import { createCookoutClient } from "../../../sdk/index.ts";
import { machineName } from "./adapters/machine.ts";
import { toFailure } from "./adapters/sdk.ts";

type ApprovedJoin = Extract<AgentJoinCollectedResponse, { readonly status: "approved" }>;

interface JoinAsked {
  readonly url: string;
  readonly as: IdentityName;
  readonly idleExpiry: Option.Option<string>;
}

const NOTHING = {};
const POLL_SECONDS = 2;
const pollEvery = Duration.seconds(POLL_SECONDS);

const expired: CallFailure = {
  code: "agent_join_request_expired",
  message: "The agent join request expired before anyone approved it. Run `cookout join` again.",
};

const failExpired = Function.constant(Effect.fail(expired));

function isApproved(collected: AgentJoinCollectedResponse): collected is ApprovedJoin {
  return collected.status === "approved";
}

function isGone(failure: CallFailure): boolean {
  return failure.code === "agent_join_request_not_found";
}

function approvalOf(
  client: CookoutClient,
  requestId: AgentJoinRequestStartedResponse["requestId"],
): Effect.Effect<ApprovedJoin, CallFailure> {
  const collect = Effect.tryPromise({ catch: toFailure, try: () => client.collectAgentJoin(requestId) }).pipe(
    Effect.catchIf(isGone, failExpired),
  );
  const pollAgain = Effect.andThen(
    Effect.sleep(pollEvery),
    Effect.suspend(() => approvalOf(client, requestId)),
  );
  return Effect.filterOrElse(collect, isApproved, Function.constant(pollAgain));
}

function approvalPrompt(url: string, { approvalPath, expiresAt, userCode }: AgentJoinRequestStartedResponse): string {
  return (
    `No Login here, so a person approves this join. Open ${url}${approvalPath}, check it shows the code ` +
    `${userCode}, then approve. The link lasts until ${expiresAt}.`
  );
}

function joinByBrowser({ as, idleExpiry, url }: JoinAsked): Effect.Effect<AgentSessionResponse, CallFailure> {
  return Effect.gen(function* approveJoinInBrowser() {
    const client = yield* Effect.try({ catch: toFailure, try: () => createCookoutClient({ env: NOTHING, url }) });
    const host = yield* machineName;
    const request = Option.match(idleExpiry, {
      onNone: () => ({ as, host }),
      onSome: (asked) => ({ as, host, idleExpiry: asked }),
    });
    const started = yield* Effect.tryPromise({ catch: toFailure, try: () => client.startAgentJoin(request) });
    yield* Console.error(approvalPrompt(url, started));
    const { agentSession } = yield* approvalOf(client, started.requestId);
    return agentSession;
  });
}

export { joinByBrowser };
