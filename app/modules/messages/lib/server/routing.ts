import type { AgentIdentity, Identity, IdentityName } from "../../../identities/index.ts";
import { Array as Arr, Duration, Effect, Option, Predicate, Schema } from "effect";
import type { Channel, MessageRoute } from "../../../channels/index.ts";
import type { NewMessage, StorageUnavailable } from "../../../storage/server.ts";
import { checkAgentLimits, isActiveAgent } from "./limits.ts";
import type { Posted } from "./limits.ts";
import type { Refusal } from "../../../http/index.ts";
import { RouterCaller } from "../../../channels/server.ts";
import type { RouterCallerService } from "../../../channels/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import type { SecretsService } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { WebhookCommandSecret } from "../../../webhook-commands/index.ts";
import { isWebhookCommandSecret } from "../../../webhook-commands/index.ts";

interface Routing {
  readonly storage: Storage["Service"];
  readonly secrets: SecretsService;
  readonly router: RouterCallerService;
}

interface Asking extends Posted {
  readonly routing: Routing;
  readonly channel: Channel & { readonly router: string };
  readonly agents: readonly AgentIdentity[];
}

type Route = Option.Option<MessageRoute>;

const ROUTER_TIMEOUT_SECONDS = 5;
const ROUTER_TIMED_OUT = `the router didn't answer within ${String(ROUTER_TIMEOUT_SECONDS)} s`;
const ROUTER_PICKED_NO_ONE = "the router picked no agent";
const ROUTER_HAS_NO_SECRET = "the router has no secret";

const RouterAgentSchema = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  displayName: Schema.optionalKey(Schema.String),
  name: Schema.String,
});
const RouterBodySchema = Schema.Struct({
  agents: Schema.Array(RouterAgentSchema),
  author: Schema.String,
  channel: Schema.String,
  fallback: Schema.NullOr(Schema.String),
  text: Schema.String,
});
const encodeRouterBody = Schema.encodeEffect(Schema.fromJsonString(RouterBodySchema));

function listedAgent(agent: AgentIdentity): typeof RouterAgentSchema.Type {
  return {
    ...Option.match(Option.fromUndefinedOr(agent.description), {
      onNone: () => ({}),
      onSome: (description) => ({ description }),
    }),
    ...Option.match(Option.fromUndefinedOr(agent.displayName), {
      onNone: () => ({}),
      onSome: (displayName) => ({ displayName }),
    }),
    name: agent.name,
  };
}

function routerBody({ agents, author, channel, message }: Asking): Effect.Effect<string> {
  const fallback = Option.getOrNull(Option.fromUndefinedOr(channel.fallback));
  const body = { agents: Arr.map(agents, listedAgent), author: author.name, channel: channel.name, fallback };
  return Effect.orDie(encodeRouterBody({ ...body, text: message.text }));
}

function signingSecret(secret: string | undefined): Option.Option<WebhookCommandSecret> {
  return Option.filter(Option.fromUndefinedOr(secret), isWebhookCommandSecret);
}

function routerSecret({ channel, routing }: Asking): Effect.Effect<WebhookCommandSecret, string> {
  return routing.storage.findRouterSecret(channel.name).pipe(
    Effect.map(signingSecret),
    Effect.flatMap(Effect.fromOption(() => ROUTER_HAS_NO_SECRET)),
    Effect.mapError(() => ROUTER_HAS_NO_SECRET),
  );
}

function knownPicks(agents: readonly AgentIdentity[], picked: readonly string[]): readonly IdentityName[] {
  const chosen = Arr.flatMap(picked, (name) => Arr.filter(agents, (agent) => agent.name === name));
  return Arr.dedupe(Arr.map(chosen, ({ name }) => name));
}

function routerPicks(asking: Asking): Effect.Effect<readonly IdentityName[], string> {
  return Effect.gen(function* askRouter() {
    const secret = yield* routerSecret(asking);
    const body = yield* routerBody(asking);
    const signature = yield* asking.routing.secrets.signature(secret, body);
    const picks = yield* asking.routing.router.ask({ body, signature, url: asking.channel.router }).pipe(
      Effect.timeoutOrElse({
        duration: Duration.seconds(ROUTER_TIMEOUT_SECONDS),
        orElse: () => Effect.fail(ROUTER_TIMED_OUT),
      }),
    );
    const chosen = knownPicks(
      asking.agents,
      Arr.map(picks, ({ name }) => name),
    );
    if (Arr.isReadonlyArrayEmpty(chosen)) {
      return yield* Effect.fail(ROUTER_PICKED_NO_ONE);
    }
    return chosen;
  });
}

function fallbackRoute(storage: Storage["Service"], channel: Channel, error: string): Effect.Effect<Route> {
  return Option.match(Option.fromUndefinedOr(channel.fallback), {
    onNone: () => Effect.succeedNone,
    onSome: (fallback) =>
      storage.findIdentityByName(fallback).pipe(
        Effect.map((found) =>
          Option.map(Option.liftPredicate(found, isActiveAgent), ({ name }) => ({
            by: "fallback" as const,
            error,
            to: [name],
          })),
        ),
        Effect.orElseSucceed(() => Option.none()),
      ),
  });
}

function ownerRoute(routing: Routing, owner: IdentityName, author: Identity): Effect.Effect<Route, StorageUnavailable> {
  return Effect.map(routing.storage.findIdentityByName(owner), (found) =>
    Option.map(
      Option.filter(Option.liftPredicate(found, isActiveAgent), ({ name }) => name !== author.name),
      ({ name }) => ({ by: "channel-owner" as const, to: [name] }),
    ),
  );
}

function hasRouter(channel: Channel): channel is Channel & { readonly router: string } {
  return Predicate.isNotUndefined(channel.router);
}

function routerRoute(
  routing: Routing,
  channel: Channel & { readonly router: string },
  posted: Posted,
): Effect.Effect<Route, StorageUnavailable> {
  return Effect.gen(function* route() {
    const everyone = yield* routing.storage.listIdentities();
    const agents = Arr.filter(everyone, isActiveAgent);
    return yield* routerPicks({ ...posted, agents, channel, routing }).pipe(
      Effect.map((to): Route => Option.some({ by: "router", to })),
      Effect.catch((error) => fallbackRoute(routing.storage, channel, error)),
    );
  });
}

function routeIn(routing: Routing, channel: Channel, posted: Posted): Effect.Effect<Route, StorageUnavailable> {
  if (Predicate.isNotUndefined(channel.owner)) {
    return ownerRoute(routing, channel.owner, posted.author);
  }
  if (hasRouter(channel)) {
    return routerRoute(routing, channel, posted);
  }
  return Effect.succeedNone;
}

function needsRoute({ author, message }: Posted): boolean {
  return author.kind === "human" && Predicate.isUndefined(message.replyTo);
}

function isActive(identity: Identity | undefined): boolean {
  return Predicate.isNotUndefined(identity) && identity.deactivated !== true;
}

function knownMentions(
  storage: Storage["Service"],
  message: NewMessage,
): Effect.Effect<readonly IdentityName[], StorageUnavailable> {
  return Effect.filter(message.mentions, (name) => Effect.map(storage.findIdentityByName(name), isActive));
}

function routedMessage(routing: Routing, posted: Posted): Effect.Effect<NewMessage, StorageUnavailable> {
  const { message } = posted;
  if (!needsRoute(posted)) {
    return Effect.succeed(message);
  }
  return Effect.gen(function* routeMessage() {
    const known = yield* knownMentions(routing.storage, message);
    const channel = yield* routing.storage.findChannel(message.channel);
    if (Arr.isReadonlyArrayNonEmpty(known) || Predicate.isUndefined(channel)) {
      return message;
    }
    const route = yield* routeIn(routing, channel, posted);
    return Option.match(route, { onNone: () => message, onSome: (found) => ({ ...message, route: found }) });
  });
}

interface Drafted extends Posted {
  readonly routing: Routing;
  readonly routes: boolean;
}

function checkedDraft({
  routes,
  routing,
  ...posted
}: Drafted): Effect.Effect<NewMessage, Refusal | StorageUnavailable> {
  const checked = checkAgentLimits({ ...posted, storage: routing.storage });
  if (!routes) {
    return Effect.as(checked, posted.message);
  }
  return Effect.andThen(checked, routedMessage(routing, posted));
}

type RoutingNeeds = RouterCaller | Secrets | Storage;

const openRouting: Effect.Effect<Routing, never, RoutingNeeds> = Effect.gen(function* openRoutingOf() {
  return { router: yield* RouterCaller, secrets: yield* Secrets, storage: yield* Storage };
});

export { type Routing, type RoutingNeeds, checkedDraft, openRouting };
