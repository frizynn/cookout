import type { InboxItemEvent } from "../../index.ts";
import { InboxItemSchema } from "../../../inbox/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

export const InboxItemEventSchema = matchesWire<InboxItemEvent>()(
  Schema.Struct({ item: InboxItemSchema, type: Schema.Literal("inbox-item") }),
);
