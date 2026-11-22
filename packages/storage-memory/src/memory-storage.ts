import type {
  Channel,
  Identity,
  MessageId,
  NewMessage,
  Reply,
  StorageAdapter,
  TokenLookup,
  TopLevelMessage,
} from "@ai-hero/cookout-protocol";

/** A message as kept here: a reply has `replyTo` (always a top-level message). */
type StoredMessage = NewMessage & { id: MessageId };

/** A store that lives in this process only. Everything is lost on close. */
export function createMemoryStorage(): StorageAdapter {
  let lastMessageId = 0;
  let closed = false;
  const identities = new Map<string, Identity>();
  const channels = new Map<string, Channel>();
  /** Every message by ID. IDs only grow, so insertion order is ID order. */
  const messages = new Map<MessageId, StoredMessage>();
  /** Top-level message ID to its replies' IDs, in order. */
  const repliesOf = new Map<MessageId, MessageId[]>();
  /** Channel name to its top-level message IDs, in order. */
  const topLevelIn = new Map<string, MessageId[]>();

  /** Copies, so callers can't change what is stored. */
  function asTopLevel(stored: StoredMessage): TopLevelMessage {
    const { replyTo: _none, ...fields } = structuredClone(stored);
    const replies = repliesOf.get(stored.id) ?? [];
    return { ...fields, replyCount: replies.length, latestReplyId: replies.at(-1) ?? null };
  }

  function asReply(stored: StoredMessage & { replyTo: MessageId }): Reply {
    return structuredClone(stored);
  }

  function stored(id: MessageId): StoredMessage {
    const found = messages.get(id);
    if (found === undefined) throw new Error(`Message ${id} is indexed but not stored.`);
    return found;
  }
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
      if (identity === undefined) return { status: "not_found" };
      if (identity.admin && [...identities.values()].filter((found) => found.admin).length === 1) {
        return { status: "last_admin" };
      }
      revokeTokensOf(name);
      identities.delete(name);
      return { status: "deleted", identity: copy(identity) };
    },
    async createChannel(channel) {
      assertOpen();
      if (channels.has(channel.name)) return "name_taken";
      channels.set(channel.name, { ...channel });
      topLevelIn.set(channel.name, []);
      return "created";
    },
    async listChannels() {
      assertOpen();
      return [...channels.values()].sort((a, b) => (a.name < b.name ? -1 : 1)).map((channel) => ({ ...channel }));
    },
    async findChannel(name) {
      assertOpen();
      const channel = channels.get(name);
      return channel === undefined ? undefined : { ...channel };
    },
    async appendMessage(message) {
      assertOpen();
      const topLevel = topLevelIn.get(message.channel);
      if (topLevel === undefined) return { status: "channel_not_found" };
      let parentId: MessageId | undefined;
      if (message.replyTo !== undefined) {
        const repliedTo = messages.get(message.replyTo);
        if (repliedTo === undefined) return { status: "reply_to_not_found" };
        if (repliedTo.channel !== message.channel) return { status: "reply_in_other_channel" };
        parentId = repliedTo.replyTo ?? repliedTo.id;
      }
      lastMessageId += 1;
      const id = lastMessageId;
      const { replyTo: _asked, ...fields } = structuredClone(message);
      if (parentId === undefined) {
        const record: StoredMessage = { ...fields, id };
        messages.set(id, record);
        topLevel.push(id);
        return { status: "appended", message: asTopLevel(record) };
      }
      const record = { ...fields, id, replyTo: parentId };
      messages.set(id, record);
      const replies = repliesOf.get(parentId) ?? [];
      replies.push(id);
      repliesOf.set(parentId, replies);
      return { status: "appended", message: asReply(record) };
    },
    async listChannelMessages(channel, page) {
      assertOpen();
      const topLevel = topLevelIn.get(channel);
      if (topLevel === undefined) return undefined;
      const before = page.before;
      const older = before === undefined ? topLevel : topLevel.filter((id) => id < before);
      const ids = older.slice(Math.max(0, older.length - page.limit));
      return { messages: ids.map((id) => asTopLevel(stored(id))), hasMore: older.length > ids.length };
    },
    async getThread(messageId) {
      assertOpen();
      const found = messages.get(messageId);
      if (found === undefined) return undefined;
      const parent = stored(found.replyTo ?? found.id);
      const replies = (repliesOf.get(parent.id) ?? []).map((id) => {
        const reply = stored(id);
        if (reply.replyTo === undefined) throw new Error(`Reply ${id} has no replyTo.`);
        return asReply({ ...reply, replyTo: reply.replyTo });
      });
      return { parent: asTopLevel(parent), replies };
    },
    async checkHealth(): Promise<void> {
      assertOpen();
    },
    async close(): Promise<void> {
      closed = true;
    },
  };
}
