import { Effect, Layer } from "effect";
import { Command, Flag } from "effect/cli";
import { databasePath, host, port } from "../../../config/server.ts";
import { type Channels, channelRoutes, channelsLayer } from "../../../channels/server.ts";
import { httpServer, type Listen, type Route, serverUrl } from "../../../http/server.ts";
import {
  type Caller,
  FirstBoot,
  firstBoot,
  identitiesLayer,
  identityRoutes,
  requireToken,
} from "../../../identities/server.ts";
import type { Secrets } from "../../../secrets/server.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import { printLine } from "./output.ts";

export type ServeLayers = {
  readonly storage: (path: string) => Layer.Layer<Storage, StorageUnavailable>;
  readonly secrets: Layer.Layer<Secrets>;
};

const routes: ReadonlyArray<Route<Caller | Channels>> = [...identityRoutes, ...channelRoutes];

export const cookoutServer = (listen: Listen) =>
  httpServer(listen, routes, requireToken).pipe(
    Layer.provideMerge(firstBoot),
    Layer.provideMerge(Layer.mergeAll(identitiesLayer, channelsLayer)),
  );

const printAdminToken = Effect.gen(function* () {
  const { adminToken } = yield* FirstBoot;
  if (adminToken === undefined) return;
  yield* printLine({
    adminToken,
    identity: "admin",
    message: "First boot: this is the admin token. It is shown only this once; keep it safe.",
  });
});

const runServer = (layers: ServeLayers, listen: Listen, database: string) =>
  Effect.gen(function* () {
    const services = yield* Layer.build(
      cookoutServer(listen).pipe(Layer.provide(Layer.mergeAll(layers.storage(database), layers.secrets))),
    );
    yield* printAdminToken.pipe(Effect.provideContext(services));
    const url = yield* serverUrl.pipe(Effect.provideContext(services));
    yield* printLine({ listening: url, database });
    return yield* Effect.never;
  }).pipe(Effect.scoped);

export const serveCommand = (layers: ServeLayers) =>
  Command.make(
    "serve",
    {
      port: Flag.Int("port").pipe(Flag.withFallbackConfig(port), Flag.withDescription("The port to listen on (PORT).")),
      host: Flag.String("host").pipe(
        Flag.withFallbackConfig(host),
        Flag.withDescription("The address to listen on (COOKOUT_HOST)."),
      ),
      db: Flag.String("db").pipe(
        Flag.withFallbackConfig(databasePath),
        Flag.withDescription("The SQLite file (COOKOUT_DB)."),
      ),
    },
    (flags) => runServer(layers, { port: flags.port, host: flags.host }, flags.db),
  ).pipe(Command.withDescription("Start the cookout server on SQLite."));
