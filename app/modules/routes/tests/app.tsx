import type { Board, BoardOptions } from "../../board/index.ts";
import type { CookoutClient, CreateIdentityRequest, Token } from "../../sdk/index.ts";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { expect, inject, onTestFinished } from "vitest";
import type { Composer } from "../../composer/index.ts";
import { CookoutApp } from "../index.tsx";
import type { Layout } from "../../layout/index.ts";
import type { Session } from "../../session/index.ts";
import type { Unread } from "../../unread/index.ts";
import { createBoard } from "../../board/index.ts";
import { createComposer } from "../../composer/index.ts";
import { createCookoutClient } from "../../sdk/index.ts";
import { createLayout } from "../../layout/index.ts";
import { createSession } from "../../session/index.ts";
import { createUnread } from "../../unread/index.ts";

const NONE = 0;
const ONE = 1;

type AppClient = BoardOptions["client"] &
  Pick<
    CookoutClient,
    | "inbox"
    | "inboxHistory"
    | "listIdentities"
    | "readPositions"
    | "makeAdmin"
    | "removeAdmin"
    | "setDisplayName"
    | "whoami"
  >;

interface BoardOpening {
  readonly hash: string;
  readonly board: Board;
  readonly composer?: Composer;
  readonly layout?: Layout;
  readonly session: Session;
  readonly unread?: Unread;
}

interface Opening {
  readonly hash: string;
  readonly client: AppClient;
  readonly pageSize?: number;
  readonly session?: Session;
  readonly live?: NonNullable<BoardOptions["live"]>;
}

interface Tracked {
  readonly client: CookoutClient;
  readonly settled: () => Promise<void>;
}

interface NewIdentity {
  readonly client: CookoutClient;
  readonly token: Token;
  readonly rotateToken: () => Promise<void>;
}

function tracked(client: CookoutClient): Tracked {
  let pending = NONE;
  const trackedClient = new Proxy(client, {
    get: (target, key): unknown => {
      const value: unknown = Reflect.get(target, key);
      if (typeof value !== "function") {
        return value;
      }
      return async (...args: readonly unknown[]): Promise<unknown> => {
        pending += ONE;
        try {
          const answer: unknown = await Reflect.apply(value, target, args);
          return answer;
        } finally {
          pending -= ONE;
        }
      };
    },
  });
  return {
    client: trackedClient,
    settled: async () => {
      await waitFor(() => {
        expect(pending).toBe(NONE);
      });
    },
  };
}

function articleText(article: () => HTMLElement): string {
  const copy = article().cloneNode(true);
  if (!(copy instanceof HTMLElement)) {
    return "";
  }
  for (const hidden of copy.querySelectorAll("time")) {
    hidden.remove();
  }
  for (const action of within(copy).queryAllByRole("link", { name: "Reply" })) {
    action.remove();
  }
  return copy.textContent;
}

export async function alertSaying(start: string): Promise<HTMLElement> {
  const said = await waitFor(() => {
    for (const alert of screen.getAllByRole("alert")) {
      if (alert.textContent.startsWith(start)) {
        return alert;
      }
    }
    throw new Error(`No alert says ${start}`);
  });
  return said;
}

export async function streamOf(label: string): Promise<readonly string[]> {
  const list = await screen.findByRole("list", { name: label });
  const shown: string[] = [];
  for (const item of within(list).queryAllByRole("listitem")) {
    for (const line of within(item).queryAllByRole("separator")) {
      shown.push(`[${String(line.getAttribute("aria-label"))}]`);
    }
    shown.push(articleText(() => within(item).getByRole("article")));
  }
  return shown;
}

export async function messagesIn(label: string): Promise<readonly string[]> {
  const shown = await streamOf(label);
  return shown.filter((row) => !row.startsWith("["));
}

export async function parentShown(): Promise<string> {
  await screen.findByRole("article", { name: "Parent message" });
  return articleText(() => screen.getByRole("article", { name: "Parent message" }));
}

export function sidebar(): HTMLElement {
  return screen.getByRole("navigation", { name: "Sidebar" });
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
  const { client, settled } = tracked(clientWith(token));
  return {
    client,
    rotateToken: async () => {
      await settled();
      await adminClient().rotateToken(request.name);
    },
    token,
  };
}

export function browserLayout(): Layout {
  return createLayout({ root: globalThis.document.documentElement, storage: globalThis.localStorage });
}

export function openBoard(opening: BoardOpening): () => void {
  globalThis.location.hash = opening.hash;
  const composer = opening.composer ?? createComposer({ client: adminClient(), commands: opening.board.commands });
  const unread = opening.unread ?? createUnread({ client: adminClient() });
  const layout = opening.layout ?? browserLayout();
  onTestFinished(cleanup);
  return render(
    <CookoutApp board={opening.board} composer={composer} layout={layout} session={opening.session} unread={unread} />,
  ).unmount;
}

export function openAt(opening: Opening): () => void {
  const session = opening.session ?? sessionOf(opening.client);
  const board = createBoard(opening);
  return openBoard({
    board,
    composer: createComposer({ ...opening, commands: board.commands }),
    hash: opening.hash,
    session,
    unread: createUnread(opening),
  });
}
