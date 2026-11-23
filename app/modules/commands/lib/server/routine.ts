import { Context, Duration, Effect, Layer, Redacted, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse, HttpIncomingMessage } from "effect/http";

interface Routine {
  readonly fireUrl: string;
  readonly token: Redacted.Redacted;
  readonly timeoutSeconds: number;
}

interface Firing {
  readonly routine: Routine;
  readonly text: string;
}

const ROUTINE_BETA = "experimental-cc-routine-2026-04-01";
const ANTHROPIC_VERSION = "2023-06-01";

const FireResponseSchema = Schema.Struct({ claude_code_session_url: Schema.String });

function fireRequest({ routine, text }: Firing): HttpClientRequest.HttpClientRequest {
  return HttpClientRequest.post(routine.fireUrl).pipe(
    HttpClientRequest.setHeader("authorization", `Bearer ${Redacted.value(routine.token)}`),
    HttpClientRequest.setHeader("anthropic-beta", ROUTINE_BETA),
    HttpClientRequest.setHeader("anthropic-version", ANTHROPIC_VERSION),
    HttpClientRequest.bodyJsonUnsafe({ text }),
  );
}

function sessionUrlOf(response: HttpClientResponse.HttpClientResponse): Effect.Effect<string, string> {
  return HttpIncomingMessage.schemaBodyJson(FireResponseSchema)(response).pipe(
    Effect.mapBoth({
      onFailure: () => "the routine's answer named no session",
      onSuccess: (body) => body.claude_code_session_url,
    }),
  );
}

interface RoutineFireService {
  readonly fire: (firing: Firing) => Effect.Effect<string, string>;
}

class RoutineFire extends Context.Service<RoutineFire, RoutineFireService>()(
  "@ai-hero/cookout/commands/lib/server/routine/RoutineFire",
) {}

function fireWith(client: HttpClient.HttpClient, firing: Firing): Effect.Effect<string, string> {
  const { timeoutSeconds } = firing.routine;
  return Effect.gen(function* fire() {
    const response = yield* client.execute(fireRequest(firing)).pipe(
      Effect.timeout(Duration.seconds(timeoutSeconds)),
      Effect.mapError(() => `the routine couldn't be reached within ${timeoutSeconds} s`),
    );
    const ok = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.mapError(() => `the routine answered ${response.status}`),
    );
    return yield* sessionUrlOf(ok);
  });
}

const routineFireLayer: Layer.Layer<RoutineFire> = Layer.effect(
  RoutineFire,
  Effect.map(HttpClient.HttpClient, (client) => RoutineFire.of({ fire: (firing) => fireWith(client, firing) })),
).pipe(Layer.provide(FetchHttpClient.layer));

export { type Routine, RoutineFire, routineFireLayer };
