import { Caller, issueToken } from "./auth.ts";
import { DateTime, Effect, Predicate, Schema, String as Str } from "effect";
import type {
  HumanIdentity,
  Identity,
  IdentityKind,
  IdentityName,
  IdentityWithTokenResponse,
  Owner,
  TokenHash,
} from "../../index.ts";
import { IdentityNameSchema, OwnerSchema, SentDisplayNameSchema } from "./wire.ts";
import { firstAdminName, identityKinds } from "../../index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { isoTimeOf } from "../../../time/server.ts";

const humanHasNoOwner = Schema.makeFilter(
  (body: { readonly kind: IdentityKind; readonly owner?: Owner }) =>
    body.kind === "agent" || Predicate.isUndefined(body.owner) || { issue: "A human has no owner.", path: ["owner"] },
);

const humanNameIsPlain = Schema.makeFilter(
  (body: { readonly kind: IdentityKind; readonly name: IdentityName }) =>
    body.kind === "agent" || !Str.includes("/")(body.name) || { issue: "A human's name has no '/'.", path: ["name"] },
);

const CreateIdentityRequestSchema = Schema.Struct({
  displayName: Schema.optionalKey(SentDisplayNameSchema),
  kind: Schema.Literals(identityKinds),
  name: IdentityNameSchema,
  owner: Schema.optionalKey(OwnerSchema),
}).check(humanHasNoOwner, humanNameIsPlain);

type CreateIdentityBody = typeof CreateIdentityRequestSchema.Type;

type Refused = "name_taken" | "name_not_owned" | "owner_not_human";

const BAD_REQUEST = 400;
const CONFLICT = 409;
const FORBIDDEN = 403;

const agentCreatesNothing: Refusal = {
  code: "human_only",
  message: "Only a human can create an identity.",
  status: FORBIDDEN,
};

const createsForOthers: Refusal = {
  code: "admin_only",
  message: "Only an admin can create a human, or an agent owned by someone else. Leave out --owner to own it yourself.",
  status: FORBIDDEN,
};

function identityExists(name: string): Refusal {
  return { code: "identity_exists", message: `The name ${name} is taken.`, status: CONFLICT };
}

function ownerNotHuman(owner: Owner): Refusal {
  return {
    code: "owner_not_human",
    details: { owner },
    message: `An agent's owner is a human, and there is no human named ${owner}.`,
    status: BAD_REQUEST,
  };
}

function nameNotOwned({ name }: Identity): Refusal {
  return {
    code: "name_not_owned",
    message: `${name} is namespaced: only an agent owned by the human named before its '/' can have it.`,
    status: BAD_REQUEST,
  };
}

function createRefusal(result: Refused, identity: Identity): Refusal {
  if (result === "name_taken") {
    return identityExists(identity.name);
  }
  if (result === "owner_not_human" && identity.kind === "agent") {
    return ownerNotHuman(identity.owner);
  }
  return nameNotOwned(identity);
}

function newIdentity(caller: HumanIdentity, body: CreateIdentityBody, createdAt: Identity["createdAt"]): Identity {
  const { kind, name, owner = caller.name } = body;
  const fields = { admin: false, createdAt, name };
  if (kind === "human") {
    return { ...fields, kind };
  }
  return { ...fields, kind, owner };
}

function withDisplayName(identity: Identity, { displayName }: CreateIdentityBody): Identity {
  if (Predicate.isUndefined(displayName)) {
    return identity;
  }
  return { ...identity, displayName };
}

function requireMayCreate(caller: HumanIdentity, identity: Identity): Effect.Effect<void, Refusal> {
  if (caller.admin || (identity.kind === "agent" && identity.owner === caller.name)) {
    return Effect.void;
  }
  return Effect.fail(createsForOthers);
}

const humanCaller: Effect.Effect<HumanIdentity, Refusal, Caller> = Caller.pipe(
  Effect.filterOrFail(
    (caller): caller is HumanIdentity => caller.kind === "human",
    () => agentCreatesNothing,
  ),
);

function storedOrRefused(result: "created" | Refused, identity: Identity): Effect.Effect<void, Refusal> {
  if (result === "created") {
    return Effect.void;
  }
  return Effect.fail(createRefusal(result, identity));
}

function storeNew(identity: Identity, hash: TokenHash): Effect.Effect<void, Refusal | StorageUnavailable, Storage> {
  return Effect.flatMap(Storage, (storage) => storage.createIdentity(identity, hash)).pipe(
    Effect.flatMap((result) => storedOrRefused(result, identity)),
  );
}

function createIdentity(request: {
  readonly caller: HumanIdentity;
  readonly body: CreateIdentityBody;
}): Effect.Effect<IdentityWithTokenResponse, Refusal | StorageUnavailable, Storage | Secrets> {
  const { body, caller } = request;
  return Effect.gen(function* createRequestedIdentity() {
    const now = yield* DateTime.now;
    const identity = withDisplayName(newIdentity(caller, body, isoTimeOf(now)), body);
    yield* requireMayCreate(caller, identity);
    const { token, hash } = yield* issueToken;
    yield* storeNew(identity, hash);
    return { identity, token };
  });
}

const firstAdmin: Effect.Effect<Identity> = Effect.map(DateTime.now, (now) => ({
  admin: true,
  createdAt: isoTimeOf(now),
  kind: "human",
  name: firstAdminName,
}));

export { CreateIdentityRequestSchema, createIdentity, firstAdmin, humanCaller };
