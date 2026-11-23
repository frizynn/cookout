import type { AgentIdentity, HumanIdentity, Identity, IdentityName } from "../../../identities/index.ts";
import { DateTime, Effect, Option, Predicate } from "effect";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import { identityDeactivated, joinNotOwned, notYourIdentity, onlyAgentsJoin } from "./refusals.ts";
import { isIdentityName, nameFitsOwner } from "../../../identities/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Secrets } from "../../../secrets/server.ts";
import { isoTimeOf } from "../../../time/server.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface Resolved {
  readonly identity: Identity;
  readonly created: boolean;
}

interface On {
  readonly publishIdentity: (identity: Identity) => Effect.Effect<void>;
  readonly secrets: Secrets["Service"];
  readonly storage: Storage["Service"];
}

interface Asked {
  readonly on: On;
  readonly caller: HumanIdentity;
  readonly name: IdentityName;
  readonly preview: boolean;
}

type Taken = (found: Identity) => Fails<Resolved>;

type CreateResult = Effect.Success<ReturnType<Storage["Service"]["createIdentity"]>>;

const CONFLICT = 409;

function createRefusals(name: IdentityName): Readonly<Record<Exclude<CreateResult, "created">, Refusal>> {
  return {
    name_not_owned: joinNotOwned(name),
    name_taken: { code: "identity_exists", message: `The name ${name} is taken.`, status: CONFLICT },
    owner_not_human: joinNotOwned(name),
  };
}

function ownedBy(caller: HumanIdentity, found: Identity): found is AgentIdentity {
  return found.kind === "agent" && found.owner === caller.name;
}

function joinOwned(found: AgentIdentity): Fails<Resolved> {
  if (found.deactivated === true) {
    return Effect.fail(identityDeactivated(found.name));
  }
  return Effect.succeed({ created: false, identity: found });
}

function previewed(identity: AgentIdentity): Fails<Resolved> {
  if (nameFitsOwner(identity)) {
    return Effect.succeed({ created: true, identity });
  }
  return Effect.fail(joinNotOwned(identity.name));
}

function createOwned(asked: Asked): Fails<Resolved> {
  const { caller, name, on } = asked;
  return Effect.gen(function* createOwnedAgent() {
    const now = yield* DateTime.now;
    const identity: AgentIdentity = {
      admin: false,
      createdAt: isoTimeOf(now),
      kind: "agent",
      name,
      owner: caller.name,
    };
    if (asked.preview) {
      return yield* previewed(identity);
    }
    const hash = yield* Effect.flatMap(on.secrets.newToken, on.secrets.hashToken);
    const result = yield* on.storage.createIdentity(identity, hash);
    if (result !== "created") {
      return yield* Effect.fail(createRefusals(name)[result]);
    }
    yield* on.publishIdentity(identity);
    return { created: true, identity };
  });
}

function joinOrCreate(asked: Asked, taken: Taken): Fails<Resolved> {
  return Effect.flatMap(asked.on.storage.findIdentityByName(asked.name), (found) => {
    if (Predicate.isUndefined(found)) {
      return createOwned(asked);
    }
    if (ownedBy(asked.caller, found)) {
      return joinOwned(found);
    }
    return taken(found);
  });
}

function refuseTaken(found: Identity): Fails<Resolved> {
  return Effect.fail(joinNotOwned(found.name));
}

function orInOwnNamespace(asked: Asked, namespaced: IdentityName): Taken {
  return (found) => {
    if (found.kind === "human") {
      return Effect.fail(onlyAgentsJoin(found.name));
    }
    return joinOrCreate({ ...asked, name: namespaced }, refuseTaken);
  };
}

function resolveAgent(asked: Asked): Fails<Resolved> {
  const namespaced = Option.liftPredicate(`${asked.caller.name}/${asked.name}`, isIdentityName);
  return Option.match(namespaced, {
    onNone: () => joinOrCreate(asked, refuseTaken),
    onSome: (name) => joinOrCreate(asked, orInOwnNamespace(asked, name)),
  });
}

interface Join {
  readonly on: On;
  readonly caller: Identity;
  readonly as: IdentityName;
}

function agentToJoin(join: Join): Fails<Resolved> {
  const { as, caller, on } = join;
  if (caller.kind === "human") {
    return resolveAgent({ caller, name: as, on, preview: false });
  }
  if (as !== caller.name) {
    return Effect.fail(notYourIdentity({ asked: as, caller: caller.name }));
  }
  return Effect.succeed({ created: false, identity: caller });
}

interface Preview {
  readonly on: On;
  readonly caller: HumanIdentity;
  readonly as: IdentityName;
}

function agentToPreview({ as, caller, on }: Preview): Fails<Resolved> {
  return resolveAgent({ caller, name: as, on, preview: true });
}

function agentToApprove({ as, caller, on }: Preview): Fails<Resolved> {
  return resolveAgent({ caller, name: as, on, preview: false });
}

export { agentToApprove, agentToJoin, agentToPreview };
