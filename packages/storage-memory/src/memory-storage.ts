import type { Identity, MessageId, StorageAdapter, TokenLookup } from "@ai-hero/cookout-protocol";

/** A store that lives in this process only. Everything is lost on close. */
export function createMemoryStorage(): StorageAdapter {
  let lastMessageId = 0;
  let closed = false;
  const identities = new Map<string, Identity>();
  /** Token hash to the identity name it was issued to. */
  const activeTokens = new Map<string, string>();
  const revokedTokens = new Set<string>();

  function assertOpen(): void {
    if (closed) throw new Error("The in-memory store is closed.");
  }

  /** Copies, so callers can't change what is stored. */
  function copy(identity: Identity): Identity {
    return { ...identity };
  }

  function revokeTokensOf(name: string): void {
    for (const [hash, owner] of activeTokens) {
      if (owner === name) {
        activeTokens.delete(hash);
        revokedTokens.add(hash);
      }
    }
  }

  function add(identity: Identity, tokenHash: string): void {
    identities.set(identity.name, copy(identity));
    activeTokens.set(tokenHash, identity.name);
  }

  return {
    async nextMessageId(): Promise<MessageId> {
      assertOpen();
      lastMessageId += 1;
      return lastMessageId;
    },
    async createIdentity(identity, tokenHash) {
      assertOpen();
      if (identities.has(identity.name)) return "name_taken";
      add(identity, tokenHash);
      return "created";
    },
    async createIdentityIfNoneExist(identity, tokenHash) {
      assertOpen();
      if (identities.size > 0) return false;
      add(identity, tokenHash);
      return true;
    },
    async listIdentities() {
      assertOpen();
      return [...identities.values()].sort((a, b) => (a.name < b.name ? -1 : 1)).map(copy);
    },
    async findIdentityByTokenHash(tokenHash): Promise<TokenLookup> {
      assertOpen();
      const name = activeTokens.get(tokenHash);
      const identity = name === undefined ? undefined : identities.get(name);
      if (identity !== undefined) return { status: "active", identity: copy(identity) };
      if (revokedTokens.has(tokenHash)) return { status: "revoked" };
      return { status: "unknown" };
    },
    async replaceToken(name, tokenHash) {
      assertOpen();
      const identity = identities.get(name);
      if (identity === undefined) return undefined;
      revokeTokensOf(name);
      activeTokens.set(tokenHash, name);
      return copy(identity);
    },
    async deleteIdentity(name) {
      assertOpen();
      const identity = identities.get(name);
      if (identity === undefined) return undefined;
      revokeTokensOf(name);
      identities.delete(name);
      return copy(identity);
    },
    async checkHealth(): Promise<void> {
      assertOpen();
    },
    async close(): Promise<void> {
      closed = true;
    },
  };
}
