/**
 * Every environment variable the end-to-end suite reads. Nothing else in the
 * suite reads the environment, and neither has a default: a run without them
 * fails at once, before it touches any server.
 */
import { Config, Schema } from "effect";

/** `COOKOUT_E2E_URL`: the cookout under test, such as `http://127.0.0.1:3000` or the deployed URL. */
export const e2eUrl = Config.NonEmptyString("COOKOUT_E2E_URL");

/** `COOKOUT_E2E_ADMIN_TOKEN`: an admin's token on that cookout, to create and delete the run's identities. */
export const e2eAdminToken = Config.schema(Schema.Redacted(Schema.NonEmptyString), "COOKOUT_E2E_ADMIN_TOKEN");
