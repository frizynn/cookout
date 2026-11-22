/**
 * Every environment variable the cookout reads, with its default. Nothing else
 * reads the environment, and every variable here has a line in `.env.example`.
 */
import { Config, Schema } from "effect";

/** `PORT`: the port `cookout serve` listens on. 0 picks a free port. */
export const port = Config.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 65535 })), "PORT").pipe(
  Config.withDefault(3000),
);

/** `COOKOUT_HOST`: the address `cookout serve` listens on. */
export const host = Config.String("COOKOUT_HOST").pipe(Config.withDefault("0.0.0.0"));

/** `COOKOUT_DB`: the SQLite file `cookout serve` keeps its data in. */
export const databasePath = Config.String("COOKOUT_DB").pipe(Config.withDefault("cookout.db"));
