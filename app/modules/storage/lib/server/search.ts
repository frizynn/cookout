import type { ParsedQuery, SearchResult } from "../../../search/index.ts";
import type { Effect } from "effect";
import type { IsoTime } from "../../../time/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface SearchCursor {
  readonly createdAt: IsoTime;
  readonly id: MessageId;
}

interface SearchPageRequest {
  readonly after?: SearchCursor;
  readonly limit: number;
}

interface StoredSearchPage {
  readonly results: readonly SearchResult[];
  readonly hasMore: boolean;
}

interface SearchSection {
  readonly searchMessages: (query: ParsedQuery, page: SearchPageRequest) => Fails<StoredSearchPage>;
}

export type { SearchCursor, SearchPageRequest, SearchSection, StoredSearchPage };
