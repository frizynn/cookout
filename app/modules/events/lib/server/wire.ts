import type { InboxItemEvent, MessageEvent, ReadPositionEvent } from "../../index.ts";
import { InboxItemSchema, ReadPositionSchema } from "../../../inbox/server.ts";
import { MessageSchema } from "../../../messages/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

export const InboxItemEventSchema = matchesWire<InboxItemEvent>()(
  Schema.Struct({ item: InboxItemSchema, type: Schema.Literal("inbox-item") }),
);

export const ReadPositionEventSchema = matchesWire<ReadPositionEvent>()(
  Schema.Struct({ readPosition: ReadPositionSchema, type: Schema.Literal("read-position") }),
);

export const MessageEventSchema = matchesWire<MessageEvent>()(
  Schema.Struct({ message: MessageSchema, type: Schema.Literal("message") }),
);
