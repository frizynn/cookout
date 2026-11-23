import { Array as Arr, Effect, Option, Predicate } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { ListOpenThreadsQuerySchema, ListOpenThreadsResponseSchema, cursorText } from "./open-threads-wire.ts";
import type { MessagesService, OpenThreadsQuery } from "./service.ts";
import type { OpenThreadsPageRequest, Storage } from "../../../storage/server.ts";
import { Caller } from "../../../identities/server.ts";
import type { ListOpenThreadsResponse } from "../../index.ts";
import { Messages } from "./service.ts";
import type { Route } from "../../../http/server.ts";
import { openThreadsPath } from "../../client.ts";
import { pageSize } from "../../index.ts";

type OpenThreadsService = Pick<MessagesService, "listOpenThreads">;

const ALL_ERRORS = { errors: "all" } as const;
const PATH_BASE = "http://cookout.invalid";

function cursorAfter({ hasMore, threads }: Pick<ListOpenThreadsResponse, "hasMore" | "threads">): string | null {
  const last = Arr.last(threads);
  if (!hasMore || Option.isNone(last)) {
    return null;
  }
  return cursorText({ id: last.value.message.id, lastActivityAt: last.value.lastActivityAt });
}

function pageRequest({ all, cursor, limit = pageSize.default }: OpenThreadsQuery): OpenThreadsPageRequest {
  const page = { all: all === "true", limit };
  if (Predicate.isUndefined(cursor)) {
    return page;
  }
  return { ...page, after: cursor };
}

function openThreadsOn(storage: Storage["Service"]): OpenThreadsService {
  return {
    listOpenThreads: (caller, query) =>
      Effect.map(storage.listOpenThreads(caller.name, pageRequest(query)), (stored) => ({
        ...stored,
        cursor: cursorAfter(stored),
      })),
  };
}

const openThreadsRoute: Route<Caller | Messages> = {
  handle: () =>
    Effect.gen(function* openThreadsRouteHandler() {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const search = HttpServerRequest.searchParamsFromURL(new URL(request.url, PATH_BASE));
      const query = yield* HttpServerRequest.schemaSearchParams(ListOpenThreadsQuerySchema, ALL_ERRORS).pipe(
        Effect.provideService(HttpServerRequest.ParsedSearchParams, search),
      );
      const caller = yield* Caller;
      const messages = yield* Messages;
      const page = yield* messages.listOpenThreads(caller, query);
      return yield* HttpServerResponse.schemaJson(ListOpenThreadsResponseSchema)(page);
    }),
  method: "GET",
  path: openThreadsPath,
};

export const openThreadRoutes: readonly Route<Caller | Messages>[] = [openThreadsRoute];

export { ListOpenThreadsResponseSchema } from "./open-threads-wire.ts";
export { openThreadsOn };
