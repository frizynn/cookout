import { Effect, String as Str } from "effect";
import { hostMaximumLength } from "../../../../logins/index.ts";
import { hostname } from "node:os";

const machineName: Effect.Effect<string> = Effect.sync(() => Str.takeLeft(hostname(), hostMaximumLength));

export { machineName };
