import type { Board, BoardClient } from "../../board/index.ts";
import type { CookoutClient, CreateIdentityRequest, EventStream, Token } from "../../sdk/index.ts";
import { createLive, watchAdapter } from "../../live/index.ts";
import type { Composer } from "../../composer/index.ts";
import { CookoutApp } from "../index.tsx";
import type { Live } from "../../live/index.ts";
import type { Session } from "../../session/index.ts";
import { createBoard } from "../../board/index.ts";
import { createComposer } from "../../composer/index.ts";
import { createCookoutClient } from "../../sdk/index.ts";
import { createSession } from "../../session/index.ts";
import { inject } from "vitest";
import { render } from "@testing-library/react";

type AppClient = BoardClient & Pick<CookoutClient, "listIdentities" | "whoami">;

interface BoardOpening {
  readonly hash: string;
  readonly board: Board;
  readonly composer?: Composer;
  readonly session: Session;
}

interface Opening {
  readonly hash: string;
  readonly client: AppClient;
  readonly pageSize?: number;
  readonly session?: Session;
  readonly live?: Live;
}

interface Watched {
  readonly live: Live;
  readonly stream: Promise<EventStream>;
}

interface NewIdentity {
  readonly client: CookoutClient;
  readonly token: Token;
}

export function anonymousClient(): CookoutClient {
  return createCookoutClient({ env: {}, url: inject("cookout").url });
}

export function clientWith(token: string): CookoutClient {
  return createCookoutClient({ env: {}, token, url: inject("cookout").url });
}

export function adminClient(): CookoutClient {
  return clientWith(inject("cookout").adminToken);
}

export function sessionOf(client: Pick<CookoutClient, "whoami">): Session {
  return createSession({ client, clientWithToken: clientWith });
}

export async function newIdentity(request: CreateIdentityRequest): Promise<NewIdentity> {
  const { token } = await adminClient().createIdentity(request);
  return { client: clientWith(token), token };
}

export function openBoard(opening: BoardOpening): () => void {
  globalThis.location.hash = opening.hash;
  const composer = opening.composer ?? createComposer({ client: adminClient() });
  return render(<CookoutApp board={opening.board} composer={composer} session={opening.session} />).unmount;
}

export function openAt(opening: Opening): () => void {
  const session = opening.session ?? sessionOf(opening.client);
  return openBoard({ board: createBoard(opening), composer: createComposer(opening), hash: opening.hash, session });
}

export function watched(client: CookoutClient): Watched {
  const { promise, resolve } = Promise.withResolvers<EventStream>();
  const live = createLive(
    watchAdapter({
      watch: async (options) => {
        const stream = await client.watch(options);
        resolve(stream);
        return stream;
      },
    }),
  );
  return { live, stream: promise };
}
