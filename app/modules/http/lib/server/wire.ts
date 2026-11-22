import { Schema } from "effect";
import type { ErrorResponse, HealthResponse } from "../../index.ts";
import { errorCodes, matchesWire } from "../../index.ts";

export const HealthResponseSchema = matchesWire<HealthResponse>()(
  Schema.Struct({
    status: Schema.Literal("ok"),
    time: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)),
  }),
);

export const ErrorResponseSchema = matchesWire<ErrorResponse>()(
  Schema.Struct({
    error: Schema.Struct({
      code: Schema.Literals(errorCodes),
      message: Schema.String,
      details: Schema.optionalKey(Schema.Unknown),
    }),
  }),
);
