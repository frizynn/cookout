import type { ClientWithAgentSessionState, CredentialSource } from "./adapters/sdk.ts";
import { DateTime, Effect, Option } from "effect";
import { callClient, withClient } from "./adapters/sdk.ts";
import { Command } from "effect/cli";
import type { IdentityResponse } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import { answered } from "./output.ts";

interface WhoamiAnswer extends IdentityResponse {
  readonly joinedAt?: IsoTime;
  readonly source: CredentialSource;
  readonly summary: string;
}

const MILLISECONDS_IN_A_MINUTE = 60_000;
const SHORTEST_SHOWN_MINUTES = 1;
const MINUTES_IN_AN_HOUR = 60;
const HOURS_SHOWN_BEFORE_DAYS = 48;
const HOURS_IN_A_DAY = 24;

function ago(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / MILLISECONDS_IN_A_MINUTE);
  const hours = Math.floor(minutes / MINUTES_IN_AN_HOUR);
  if (minutes < SHORTEST_SHOWN_MINUTES) {
    return "just now";
  }
  if (minutes < MINUTES_IN_AN_HOUR) {
    return `${String(minutes)} min ago`;
  }
  if (hours < HOURS_SHOWN_BEFORE_DAYS) {
    return `${String(hours)} h ago`;
  }
  return `${String(Math.floor(hours / HOURS_IN_A_DAY))} d ago`;
}

function joinedAnswer(answer: IdentityResponse, joinedAt: IsoTime): Effect.Effect<WhoamiAnswer> {
  return Effect.map(DateTime.now, (now) => {
    const since = DateTime.toEpochMillis(now) - DateTime.toEpochMillis(DateTime.makeUnsafe(joinedAt));
    const summary = `${answer.identity.name} (agent session token, joined ${ago(since)})`;
    return { ...answer, joinedAt, source: "agent session token", summary };
  });
}

function whoamiAnswer(
  { joined, source }: ClientWithAgentSessionState,
  answer: IdentityResponse,
): Effect.Effect<WhoamiAnswer> {
  if (Option.isSome(joined)) {
    return joinedAnswer(answer, joined.value.state.issuedAt);
  }
  return Effect.succeed({ ...answer, source, summary: `${answer.identity.name} (${source})` });
}

const whoami = withClient((opened) =>
  Effect.flatMap(callClient((client) => client.whoami())(opened), (answer) => whoamiAnswer(opened, answer)),
);

const whoamiCommand = Command.make("whoami", {}, () => answered(whoami)).pipe(
  Command.withDescription(
    "Show the identity behind the credential this CLI sends, and where it came from: COOKOUT_TOKEN, COOKOUT_SESSION, " +
      "the agent session token this agent tool session joined (and when), or login.",
  ),
);

export { whoamiCommand };
