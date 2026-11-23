import { ListMessagesQuerySchema, MessageIdSchema, TopLevelMessageSchema } from "./wire.ts";
import type { ListOpenThreadsResponse, OpenThread } from "../../index.ts";
import { Schema, SchemaTransformation, String as Str } from "effect";
import { IsoTimeSchema } from "../../../time/server.ts";
import { matchesWire } from "../../../http/index.ts";

const SEPARATOR = "_";

const CursorPartsSchema = Schema.Struct({ id: MessageIdSchema, lastActivityAt: IsoTimeSchema });

type CursorParts = typeof CursorPartsSchema.Encoded;

function cursorText({ id, lastActivityAt }: CursorParts): string {
  return `${lastActivityAt}${SEPARATOR}${String(id)}`;
}

const OpenThreadsCursorSchema = Schema.String.pipe(
  Schema.decodeTo(
    CursorPartsSchema,
    SchemaTransformation.transform({
      decode: (text: string) => {
        const [lastActivityAt, id = ""] = Str.split(text, SEPARATOR);
        return { id: Number(id), lastActivityAt };
      },
      encode: cursorText,
    }),
  ),
);

const ListOpenThreadsQuerySchema = Schema.Struct({
  all: Schema.optionalKey(Schema.Literal("true")),
  cursor: Schema.optionalKey(OpenThreadsCursorSchema),
  limit: ListMessagesQuerySchema.fields.limit,
});

const OpenThreadSchema = matchesWire<OpenThread>()(
  Schema.Struct({ lastActivityAt: IsoTimeSchema, message: TopLevelMessageSchema }),
);

const ListOpenThreadsResponseSchema = matchesWire<ListOpenThreadsResponse>()(
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    hasMore: Schema.Boolean,
    threads: Schema.Array(OpenThreadSchema),
  }),
);

export { ListOpenThreadsQuerySchema, ListOpenThreadsResponseSchema, cursorText };
