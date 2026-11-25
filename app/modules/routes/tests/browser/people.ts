import type { CookoutClient, CreateIdentityRequest, IdentityWithTokenResponse } from "../../../sdk/index.ts";
import { createCookoutClient } from "../../../sdk/index.ts";
import { createTestAgent } from "../../../testing/index.ts";

export interface Person {
  readonly client: CookoutClient;
  readonly token: string;
}

export function adminClient(): CookoutClient {
  return createCookoutClient();
}

export interface Creating {
  readonly by: CookoutClient;
  readonly request: CreateIdentityRequest;
}

export async function createdBy({ by, request }: Creating): Promise<IdentityWithTokenResponse> {
  if (request.kind === "human") {
    const human = await by.createIdentity(request);
    return human;
  }
  const { kind: _kind, ...agent } = request;
  const created = await createTestAgent({ by, ...agent });
  return created;
}

export async function newIdentity(request: CreateIdentityRequest): Promise<Person> {
  const { token } = await createdBy({ by: adminClient(), request });
  return { client: createCookoutClient({ token }), token };
}
