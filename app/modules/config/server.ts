/**
 * Every environment variable the cookout reads, with its default. Nothing else
 * reads the environment, and every variable here has a line in `.env.example`
 * and a line in the README's Settings section (`pnpm hygiene` checks both).
 */
import { Config, Redacted, Schema } from "effect";

const SHORTEST_LEASE_SECONDS = 1;
const DEFAULT_LEASE_SECONDS = 60;
const SHORTEST_WEBHOOK_TIMEOUT_SECONDS = 1;
const DEFAULT_WEBHOOK_TIMEOUT_SECONDS = 5;
const SHORTEST_WEBHOOK_RETRY_DELAY_SECONDS = 0;
const DEFAULT_WEBHOOK_RETRY_DELAY_SECONDS = 10;
const SMALLEST_WEBHOOK_RETRY_FACTOR = 1;
const DEFAULT_WEBHOOK_RETRY_FACTOR = 2.3;
const SHORTEST_ADMIN_TOKEN = 32;

const isPublicUrl = Schema.makeFilter(
  (url: string) =>
    url === "" || URL.canParse(url) || "COOKOUT_PUBLIC_URL must be empty or a URL such as https://cookout.fly.dev.",
);

const adminTokenRule = `COOKOUT_ADMIN_TOKEN must be set to a token of at least ${String(SHORTEST_ADMIN_TOKEN)} characters, such as one made by \`openssl rand -hex 32\`. It becomes the admin identity's token.`;

const isStrongEnoughToken = Schema.makeFilter(
  (adminToken: string | undefined) => (adminToken ?? "").length >= SHORTEST_ADMIN_TOKEN || adminTokenRule,
);

/** `PORT`: the port `cookout serve` listens on. 0 picks a free port. */
export const port = Config.schema(Schema.Int.check(Schema.isBetween({ maximum: 65_535, minimum: 0 })), "PORT").pipe(
  Config.withDefault(3000),
);

/** `COOKOUT_HOST`: the address `cookout serve` listens on. */
export const host = Config.String("COOKOUT_HOST").pipe(Config.withDefault("0.0.0.0"));

/**
 * `COOKOUT_PUBLIC_URL`: the address the cookout is deployed at, such as
 * `https://cookout.fly.dev`. Its host is answered as well as the server's own
 * (Matt, 2026-11-23, mattpocock/cookout#56). Empty counts as unset.
 */
export const publicUrl = Config.schema(Schema.String.check(isPublicUrl), "COOKOUT_PUBLIC_URL").pipe(
  Config.withDefault(""),
);

/**
 * `COOKOUT_ADMIN_TOKEN`: the token of the `admin` identity, required by `cookout serve`. Every boot makes it the
 * admin's only token (Matt, 2026-11-23, mattpocock/cookout#85). Unset, empty or shorter than 32 characters, serve
 * refuses to start, and the message never shows the value.
 */
export const adminToken = Config.schema(
  Schema.UndefinedOr(Schema.String).check(isStrongEnoughToken),
  "COOKOUT_ADMIN_TOKEN",
).pipe(Config.map((value) => Redacted.make(value ?? "")));

/** `COOKOUT_DB`: the SQLite file `cookout serve` keeps its data in. */
export const databasePath = Config.String("COOKOUT_DB").pipe(Config.withDefault("cookout.db"));

/** `COOKOUT_LEASE_SECONDS`: how long a lease lasts after the last request that carried it. */
export const leaseSeconds = Config.schema(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(SHORTEST_LEASE_SECONDS)),
  "COOKOUT_LEASE_SECONDS",
).pipe(Config.withDefault(DEFAULT_LEASE_SECONDS));

/**
 * `COOKOUT_WEBHOOK_TIMEOUT_SECONDS`: how long the server waits for a command's handler to answer one webhook
 * delivery. The working default of 5 s is not settled yet (mattpocock/cookout#63).
 */
export const webhookTimeoutSeconds = Config.schema(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(SHORTEST_WEBHOOK_TIMEOUT_SECONDS)),
  "COOKOUT_WEBHOOK_TIMEOUT_SECONDS",
).pipe(Config.withDefault(DEFAULT_WEBHOOK_TIMEOUT_SECONDS));

/**
 * `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS`: how long the server waits before it first retries a webhook delivery that
 * got no `2xx`. Each later wait is `COOKOUT_WEBHOOK_RETRY_FACTOR` times the one before, for 5 retries. The working
 * defaults of 10 s and 2.3 wait about 10 s, 23 s, 53 s, 2 min and 5 min; they are not settled yet
 * (mattpocock/cookout#65).
 */
export const webhookRetryDelaySeconds = Config.schema(
  Schema.Finite.check(Schema.isGreaterThanOrEqualTo(SHORTEST_WEBHOOK_RETRY_DELAY_SECONDS)),
  "COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS",
).pipe(Config.withDefault(DEFAULT_WEBHOOK_RETRY_DELAY_SECONDS));

/** `COOKOUT_WEBHOOK_RETRY_FACTOR`: how many times longer each wait between webhook retries is than the one before. */
export const webhookRetryFactor = Config.schema(
  Schema.Finite.check(Schema.isGreaterThanOrEqualTo(SMALLEST_WEBHOOK_RETRY_FACTOR)),
  "COOKOUT_WEBHOOK_RETRY_FACTOR",
).pipe(Config.withDefault(DEFAULT_WEBHOOK_RETRY_FACTOR));

/** `COOKOUT_STATE_DIR`: where the CLI keeps the lease it took with `join`. Empty counts as unset. */
export const stateDirectory = Config.String("COOKOUT_STATE_DIR").pipe(Config.withDefault(""));

/** `XDG_STATE_HOME`: the CLI keeps its state in `cookout/` under it when `COOKOUT_STATE_DIR` is unset. */
export const xdgStateHome = Config.String("XDG_STATE_HOME").pipe(Config.withDefault(""));

/**
 * `HOME`: the CLI keeps its state in `~/.local/state/cookout` when neither of
 * the above is set. With none of the three, the CLI keeps no lease and `join`
 * is refused with `state_folder_missing`.
 */
export const home = Config.String("HOME").pipe(Config.withDefault(""));

/** `COOKOUT_URL`: the server every CLI verb but `serve` talks to. Empty counts as unset. */
export const cookoutUrl = Config.String("COOKOUT_URL").pipe(Config.withDefault(""));

/** `COOKOUT_TOKEN`: the bearer token every CLI verb but `serve` sends. Empty counts as unset. */
export const cookoutToken = Config.String("COOKOUT_TOKEN").pipe(Config.withDefault(""));

/** Why `cookout serve` refused `COOKOUT_ADMIN_TOKEN`, and how to set it. It never includes the value. */
export { adminTokenRule };
