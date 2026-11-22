import type { ErrorResponse, HealthResponse } from "../../index.ts";
import { Schema } from "effect";
import { matchesWire } from "../../index.ts";

const SHORTEST_CODE = 1;
const isoTime = Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
const IsoTimeSchema = Schema.String.check(isoTime);
const ErrorCodeSchema = Schema.String.check(Schema.isMinLength(SHORTEST_CODE));
const ErrorBodySchema = Schema.Struct({
  code: ErrorCodeSchema,
  details: Schema.optionalKey(Schema.Unknown),
  message: Schema.String,
});

export const HealthResponseSchema = matchesWire<HealthResponse>()(
  Schema.Struct({ status: Schema.Literal("ok"), time: IsoTimeSchema }),
);

export const ErrorResponseSchema = matchesWire<ErrorResponse>()(Schema.Struct({ error: ErrorBodySchema }));
