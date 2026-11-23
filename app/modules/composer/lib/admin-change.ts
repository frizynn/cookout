import type { CookoutClient, Identity, IdentityName, IdentityResponse, Refusal } from "../../sdk/index.ts";
import { refusalOf } from "../../sdk/index.ts";

type AdminChange =
  | { readonly status: "idle" }
  | { readonly status: "changing"; readonly name: IdentityName }
  | (Refusal & { readonly status: "failed"; readonly name: IdentityName });

type AdminClient = Pick<CookoutClient, "makeAdmin" | "removeAdmin">;

interface AdminList {
  readonly client: AdminClient;
  readonly identities: () => readonly Identity[];
  readonly publish: (identities: readonly Identity[]) => void;
}

interface AdminChanges {
  readonly adminChange: () => AdminChange;
  readonly setAdmin: (name: IdentityName, admin: boolean) => void;
}

async function send(client: AdminClient, name: IdentityName, admin: boolean): Promise<IdentityResponse> {
  if (admin) {
    const made = await client.makeAdmin(name);
    return made;
  }
  const removed = await client.removeAdmin(name);
  return removed;
}

function withIdentity(identities: readonly Identity[], answered: Identity): readonly Identity[] {
  return identities.map((each) => {
    if (each.name === answered.name) {
      return answered;
    }
    return each;
  });
}

function createAdminChanges(list: AdminList): AdminChanges {
  let change: AdminChange = { status: "idle" };
  let queue = Promise.resolve();

  async function changeAfter(previous: Promise<void>, name: IdentityName, admin: boolean): Promise<void> {
    await previous;
    change = { name, status: "changing" };
    list.publish(list.identities());
    try {
      const { identity } = await send(list.client, name, admin);
      change = { status: "idle" };
      list.publish(withIdentity(list.identities(), identity));
    } catch (error: unknown) {
      change = { ...refusalOf(error), name, status: "failed" };
      list.publish(list.identities());
    }
  }

  return {
    adminChange: () => change,
    setAdmin: (name, admin) => {
      queue = changeAfter(queue, name, admin);
    },
  };
}

export { type AdminChange, type AdminChanges, type AdminClient, createAdminChanges };
