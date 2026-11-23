import { Context, Effect, Layer } from "effect";
import { WebhookFake, webhookFake } from "../../../webhook-fake/server.ts";
import type { Scope } from "effect";

interface FakeRoutine {
  readonly fireUrl: string;
  readonly sessionUrl: string;
}

const sessionId = "session_dev_fake";
const sessionUrl = `https://sessions.example.com/code/${sessionId}`;
const firePath = "/v1/claude_code/routines/trig_dev_fake/fire";

const fakeRoutine: Effect.Effect<FakeRoutine, never, Scope.Scope> = Effect.gen(function* startFakeRoutine() {
  const built = yield* Layer.build(webhookFake);
  const fake = Context.get(built, WebhookFake);
  yield* fake.answerWith({
    claude_code_session_id: sessionId,
    claude_code_session_url: sessionUrl,
    type: "routine_fire",
  });
  return { fireUrl: `${fake.url}${firePath}`, sessionUrl };
});

export { fakeRoutine };
