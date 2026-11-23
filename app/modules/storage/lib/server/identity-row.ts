import type { DisplayName, Identity, IdentityName } from "../../../identities/index.ts";
import { isDisplayName, isIdentityName, isOwner } from "../../../identities/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";

type FindIdentity = (name: IdentityName) => Identity | undefined;

const NOT_ADMIN = 0;
const ADMIN = 1;

const OwnerColumn = Schema.String.pipe(Schema.refine(isOwner));

const DisplayNameColumn = Schema.String.pipe(Schema.refine(isDisplayName));

const sharedColumns = {
  admin: Schema.Literals([NOT_ADMIN, ADMIN]),
  created_at: IsoTimeSchema,
  display_name: Schema.NullOr(DisplayNameColumn),
  name: Schema.String.pipe(Schema.refine(isIdentityName)),
};

const HumanRow = Schema.Struct({ ...sharedColumns, kind: Schema.Literal("human"), owner: Schema.Null });

const AgentRow = Schema.Struct({ ...sharedColumns, kind: Schema.Literal("agent"), owner: OwnerColumn });

const IdentityRow = Schema.Union([HumanRow, AgentRow]);

function displayNameOf(row: typeof IdentityRow.Type): { readonly displayName?: DisplayName } {
  if (row.display_name === null) {
    return {};
  }
  return { displayName: row.display_name };
}

function toIdentity(row: typeof IdentityRow.Type): Identity {
  const fields = { admin: row.admin === ADMIN, createdAt: row.created_at, name: row.name, ...displayNameOf(row) };
  if (row.kind === "human") {
    return { ...fields, kind: "human" };
  }
  return { ...fields, kind: "agent", owner: row.owner };
}

export { AgentRow, type FindIdentity, IdentityRow, toIdentity };
