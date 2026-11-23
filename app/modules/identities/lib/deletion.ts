export interface IdentityMessageCountResponse {
  readonly messages: number;
}

export const identityPath = "/v1/identities/:name";

export const identityMessageCountPath = "/v1/identities/:name/message-count";

export const identityDeletionErrorCodes = ["has_messages", "owns_agents"] as const;
