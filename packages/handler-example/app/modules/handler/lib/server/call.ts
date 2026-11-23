import type { MessageId } from "@ai-hero/cookout/sdk";
import { Schema } from "effect";

const LOWEST_ID = 1;

function isThreadId(value: number): value is MessageId {
  return value >= LOWEST_ID;
}

const CommandCallSchema = Schema.Struct({
  callId: Schema.String,
  command: Schema.String,
  data: Schema.Unknown,
  threadId: Schema.Int.pipe(Schema.refine(isThreadId, { identifier: "MessageId" })),
  token: Schema.String,
});

type CommandCall = typeof CommandCallSchema.Type;

export { type CommandCall, CommandCallSchema };
