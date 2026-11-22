import { z } from "zod";

/**
 * Every error response body: `{ error: { code, message, details? } }`.
 * `code` is a stable snake_case string callers can branch on; `message` is
 * for people; `details` is optional extra data (for example schema issues).
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
