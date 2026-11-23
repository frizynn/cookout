import type { Identity, IdentityName } from "../../../identities/index.ts";
import { identityKinds, isIdentityName, isOwner } from "../../../identities/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";

type FindIdentity = (name: IdentityName) => Identity | undefined;

const NOT_ADMIN = 0;
const ADMIN = 1;

const OwnerColumn = Schema.String.pipe(Schema.refine(isOwner));

const IdentityRow = Schema.Struct({
  admin: Schema.Literals([NOT_ADMIN, ADMIN]),
  created_at: IsoTimeSchema,
  kind: Schema.Literals(identityKinds),
  name: Schema.String.pipe(Schema.refine(isIdentityName)),
  owner: Schema.NullOr(OwnerColumn),
});

function toIdentity(row: typeof IdentityRow.Type): Identity {
  const fields = { admin: row.admin === ADMIN, createdAt: row.created_at, name: row.name };
  if (row.kind === "human") {
    return { ...fields, kind: "human" };
  }
  if (row.owner === null) {
    return { ...fields, kind: "agent" };
  }
  return { ...fields, kind: "agent", owner: row.owner };
}

export { type FindIdentity, IdentityRow, toIdentity };
