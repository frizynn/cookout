/**
 * Every environment variable the cookout reads, with its default. Nothing else
 * reads the environment, and every variable here has a line in `.env.example`.
 */
import { Config, Schema } from "effect";

const SHORTEST_LEASE_SECONDS = 1;
const DEFAULT_LEASE_SECONDS = 60;

/** `PORT`: the port `cookout serve` listens on. 0 picks a free port. */
export const port = Config.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 65535 })), "PORT").pipe(
  Config.withDefault(3000),
);

/** `COOKOUT_HOST`: the address `cookout serve` listens on. */
export const host = Config.String("COOKOUT_HOST").pipe(Config.withDefault("0.0.0.0"));

/** `COOKOUT_DB`: the SQLite file `cookout serve` keeps its data in. */
export const databasePath = Config.String("COOKOUT_DB").pipe(Config.withDefault("cookout.db"));

/** `COOKOUT_LEASE_SECONDS`: how long a lease lasts after the last request that carried it. */
export const leaseSeconds = Config.schema(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(SHORTEST_LEASE_SECONDS)),
  "COOKOUT_LEASE_SECONDS",
).pipe(Config.withDefault(DEFAULT_LEASE_SECONDS));

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
