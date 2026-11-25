import type {
  CookoutClient,
  CreateIdentityRequest,
  IdentityResponse,
  IdentityWithTokenResponse,
} from "../../sdk/index.ts";

interface Creating<Request> {
  readonly by: CookoutClient;
  readonly admin: CookoutClient;
  readonly request: Request;
}

export async function createIdentityAsBefore({
  admin,
  by,
  request,
}: Creating<CreateIdentityRequest>): Promise<IdentityWithTokenResponse> {
  if (request.kind === "human" || typeof request.displayName === "string") {
    return by.createIdentity(request);
  }
  const { identity, token } = await by.createIdentity({ ...request, displayName: request.name });
  const cleared = await admin.setDisplayName(identity.name, null);
  return { ...cleared, token };
}

export async function createAgentForOwnerAsBefore({ admin, by, request }: Creating<string>): Promise<IdentityResponse> {
  const { identity } = await by.createAgentForOwner({ displayName: request, name: request });
  return admin.setDisplayName(identity.name, null);
}
