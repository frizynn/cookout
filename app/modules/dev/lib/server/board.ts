import { Array as Arr, Effect } from "effect";
import type {
  CookoutClient,
  CreateIdentityRequest,
  IdentityWithTokenResponse,
  Message,
  MessageId,
  PostMessageRequest,
} from "../../../sdk/index.ts";
import { CookoutError, createCookoutClient } from "../../../sdk/index.ts";

interface SeedFailure {
  readonly code: string;
  readonly message: string;
}

interface BoardConnection {
  readonly token: string;
  readonly url: string;
}

interface SeededIdentity {
  readonly client: CookoutClient;
  readonly created: IdentityWithTokenResponse;
}

interface SeededBoard {
  readonly channels: readonly string[];
  readonly identities: readonly IdentityWithTokenResponse[];
  readonly thread: MessageId;
}

interface Cast {
  readonly ada: SeededIdentity;
  readonly grace: SeededIdentity;
  readonly releaseBot: SeededIdentity;
  readonly triageAgent: SeededIdentity;
}

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const channelNames = ["deploys", "general"] as const;

function failureOf(error: unknown): SeedFailure {
  if (error instanceof CookoutError) {
    return { code: error.code, message: error.message };
  }
  return { code: "seed_failed", message: String(error) };
}

function call<Answer>(request: () => Promise<Answer>): Effect.Effect<Answer, SeedFailure> {
  return Effect.tryPromise({ catch: failureOf, try: request });
}

function clientAt(url: string, token: string): CookoutClient {
  return createCookoutClient({ env: {}, token, url });
}

function post(author: SeededIdentity, request: PostMessageRequest): Effect.Effect<Message, SeedFailure> {
  return Effect.map(
    call(() => author.client.createMessage(request)),
    ({ message }) => message,
  );
}

function createIdentity(
  url: string,
  admin: CookoutClient,
  request: CreateIdentityRequest,
): Effect.Effect<SeededIdentity, SeedFailure> {
  return Effect.map(
    call(() => admin.createIdentity(request)),
    (created) => ({ client: clientAt(url, created.token), created }),
  );
}

function createCast({ token, url }: BoardConnection): Effect.Effect<Cast, SeedFailure> {
  const admin = clientAt(url, token);
  return Effect.all(
    {
      ada: createIdentity(url, admin, { name: "ada" }),
      grace: createIdentity(url, admin, { name: "grace" }),
      releaseBot: createIdentity(url, admin, { name: "release-bot", owner: "ada" }),
      triageAgent: createIdentity(url, admin, { name: "triage-agent", owner: "grace" }),
    },
    ONE_AT_A_TIME,
  );
}

function postConversation(cast: Cast): Effect.Effect<MessageId, SeedFailure> {
  return Effect.gen(function* conversation() {
    yield* call(() => cast.ada.client.createChannel({ description: "Anything and everything.", name: "general" }));
    yield* call(() => cast.releaseBot.client.createChannel({ description: "Release announcements.", name: "deploys" }));
    const opening = yield* post(cast.ada, {
      channel: "general",
      text: "Morning! Who is looking at the flaky login test?",
    });
    const thread = { channel: "general", replyTo: opening.id } as const;
    yield* post(cast.triageAgent, { ...thread, text: "I am. It fails about one run in ten on CI." });
    const question = yield* post(cast.grace, { ...thread, text: "@triage-agent can you post the failing run?" });
    yield* post(cast.grace, { channel: "general", text: "Lunch at 12:30." });
    yield* post(cast.ada, { channel: "general", replyTo: question.id, text: "Thanks, both of you." });
    yield* post(cast.releaseBot, { channel: "deploys", data: { version: "1.4.2" }, text: "Deployed 1.4.2." });
    return opening.id;
  });
}

function seedBoard(connection: BoardConnection): Effect.Effect<SeededBoard, SeedFailure> {
  return Effect.gen(function* seed() {
    const cast = yield* createCast(connection);
    const thread = yield* postConversation(cast);
    const identities = Arr.map([cast.ada, cast.grace, cast.releaseBot, cast.triageAgent], ({ created }) => created);
    return { channels: channelNames, identities, thread };
  });
}

export { type BoardConnection, type SeedFailure, seedBoard };
