/**
 * Moments on the backend: the one Schema that decodes an `IsoTime`, for
 * every request, response, stored row and file with a moment in it, and the
 * one way the backend writes a `DateTime` as one.
 */
import { DateTime, Option, Schema } from "effect";
import { isIsoTime, isoTimePattern } from "./index.ts";
import type { IsoTime } from "./index.ts";

const isoTimeRule = Schema.isPattern(isoTimePattern).abort();

/** Decodes an `IsoTime`: a string in the wire's ISO 8601 form. */
export const IsoTimeSchema = Schema.String.check(isoTimeRule).pipe(Schema.refine(isIsoTime, { identifier: "IsoTime" }));

/**
 * `moment` as the wire writes it.
 * @param moment The moment to write.
 * @returns The moment as an `IsoTime`.
 */
export function isoTimeOf(moment: DateTime.DateTime): IsoTime {
  return Option.getOrThrow(Option.liftPredicate(DateTime.formatIso(moment), isIsoTime));
}
