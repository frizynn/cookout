import { Effect } from "effect";
import { Command } from "effect/cli";
import type { CookoutClient } from "../../../sdk/index.ts";
import { callServer } from "./adapters/sdk.ts";
import { printAnswer, refused } from "./output.ts";

const answer = <A>(call: (client: CookoutClient) => Promise<A>) =>
  callServer(call).pipe(Effect.flatMap(printAnswer), Effect.catch(refused));

export const whoamiCommand = Command.make("whoami", {}, () => answer((client) => client.whoami())).pipe(
  Command.withDescription("Show the identity behind COOKOUT_TOKEN."),
);
