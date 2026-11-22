/**
 * A moment on the wire, shared by the server, the SDK and the web: the
 * `IsoTime` brand and its check. Every timestamp the protocol carries
 * (`createdAt`, `expiresAt`, `heldUntil`, the health check's `time`) is one.
 */

declare const brand: unique symbol;

/** A moment as the wire writes it: ISO 8601 in UTC with milliseconds, such as `2026-01-01T00:00:00.000Z`. */
export type IsoTime = string & { readonly [brand]: "IsoTime" };

/** The rule every `IsoTime` follows, for the backend's Schemas. */
export const isoTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

/**
 * Whether `value` is written as the wire writes a moment; if so, it is an `IsoTime`.
 * @param value The string to check.
 * @returns Whether `value` is an `IsoTime`.
 */
export function isIsoTime(value: string): value is IsoTime {
  return isoTimePattern.test(value);
}
