import type { Presence, PresenceResponse } from "../../index.ts";
import { IdentityNameSchema } from "../../../identities/server.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const LiveConnectionDetailSchema = Schema.Union([
  Schema.Struct({ host: Schema.optionalKey(Schema.String), via: Schema.Literal("watch") }),
  Schema.Struct({ via: Schema.Literal("web") }),
]);

export const PresenceSchema = matchesWire<Presence>()(
  Schema.Struct({
    connection: Schema.optionalKey(LiveConnectionDetailSchema),
    identity: IdentityNameSchema,
    lastSeenAt: Schema.optionalKey(IsoTimeSchema),
    online: Schema.Boolean,
  }),
);

export const PresenceResponseSchema = matchesWire<PresenceResponse>()(
  Schema.Struct({ presence: Schema.Array(PresenceSchema) }),
);
