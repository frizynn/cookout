import { Effect, String as Str } from "effect";
import type { Harness, Identity } from "../../index.ts";
import { harnessHeader, isHarness } from "../../index.ts";
import type { Option } from "effect";
import type { Refusal } from "../../../http/index.ts";
import { agentSessionPath } from "../../../agent-sessions/index.ts";

interface RequestTarget {
  readonly method: string;
  readonly url: string;
}

interface HarnessRequest {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly identity: Identity;
  readonly target: RequestTarget;
}

const badHarness: Refusal = {
  code: "invalid_request",
  message: `The ${harnessHeader} header must be 1-40 lowercase letters, digits or -, such as claude-code.`,
  status: 400,
};

function agentAsHuman(identity: Identity, tool: Harness): Refusal {
  return {
    code: "agent_as_human",
    details: { harness: tool, identity: identity.name },
    message: `${identity.name} is a human identity, and this request came from ${tool}, an agent tool. Give the agent its own agent identity and token, or set COOKOUT_ALLOW_HUMAN=1 if you mean to act as this human from it.`,
    status: 403,
  };
}

function isJoinRoute({ method, url }: RequestTarget): boolean {
  const [path] = Str.split("?")(url);
  return method === "POST" && path === agentSessionPath;
}

function humanFromHarness(
  identity: Identity,
  tool: Harness,
  target: RequestTarget,
): Effect.Effect<Option.Option<Harness>, Refusal> {
  if (isJoinRoute(target)) {
    return Effect.succeedNone;
  }
  return Effect.fail(agentAsHuman(identity, tool));
}

export function harnessOf(request: HarnessRequest): Effect.Effect<Option.Option<Harness>, Refusal> {
  const { headers, identity, target } = request;
  const sent = headers[harnessHeader] ?? "";
  if (sent === "") {
    return Effect.succeedNone;
  }
  if (!isHarness(sent)) {
    return Effect.fail(badHarness);
  }
  if (identity.kind === "agent") {
    return Effect.succeedSome(sent);
  }
  return humanFromHarness(identity, sent, target);
}
