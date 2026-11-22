import { z } from "zod";

/** `GET /v1/health`: no token, no request body. */
export const healthPath = "/v1/health";

/** The body of a 200 from `GET /v1/health`. A 503 uses the error shape. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  /** The server's clock, as an ISO 8601 UTC timestamp. */
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
