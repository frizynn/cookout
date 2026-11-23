import type { CookoutClient, CreateIdentityRequest } from "../../../sdk/index.ts";
import { createCookoutClient } from "../../../sdk/index.ts";

export interface Person {
  readonly client: CookoutClient;
  readonly token: string;
}

export function adminClient(): CookoutClient {
  return createCookoutClient();
}

export async function newIdentity(request: CreateIdentityRequest): Promise<Person> {
  const { token } = await adminClient().createIdentity(request);
  return { client: createCookoutClient({ token }), token };
}
