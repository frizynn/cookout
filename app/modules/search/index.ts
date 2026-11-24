/**
 * Search, shared by the server, the SDK and the web: the one rule for what a
 * word is, the parser that reads a query as typed, the answer of the search
 * route, its path and the error codes it refuses with. The storage Layers match
 * with the same word rule, so what the web highlights is what the server found.
 */
import type { Message } from "../messages/index.ts";

const WORD = /[\p{L}\p{N}]+/gu;
const MARKS = /\p{M}/gu;
const NO_MARKS = "";
const NO_WORDS = 0;

/**
 * The words of `text`: each run of letters and digits, lower-cased and without accents, in order. Everything else
 * (spaces, Markdown punctuation, `@`, `#`) separates words, so `**Café**` is the word `cafe`.
 * @param text The text to split.
 * @returns Its words, as search compares them.
 */
export function wordsOf(text: string): readonly string[] {
  const plain = text.normalize("NFD").replaceAll(MARKS, NO_MARKS).toLowerCase();
  return plain.match(WORD) ?? [];
}

/** A query as the server reads it. Every word must match a word of the message that equals it or starts with it. */
export interface ParsedQuery {
  readonly words: readonly string[];
}

/**
 * Reads a query as typed. For now a query is only words.
 * @param query The query as typed.
 * @returns The query's words.
 */
export function parseQuery(query: string): ParsedQuery {
  return { words: wordsOf(query) };
}

/**
 * Whether a parsed query asks for nothing, which the server refuses as `empty_query`.
 * @param parsed The parsed query.
 * @returns Whether it has no words.
 */
export function isEmptyQuery(parsed: ParsedQuery): boolean {
  return parsed.words.length === NO_WORDS;
}

/** A message's text and the query it is matched against. */
export interface Matching {
  readonly text: string;
  readonly query: ParsedQuery;
}

/**
 * Whether the text holds every word of the query, each as a word of its own or the start of one.
 * @param matching The text and the parsed query.
 * @returns Whether the text matches.
 */
export function matchesQuery(matching: Matching): boolean {
  const words = wordsOf(matching.text);
  return matching.query.words.every((asked) => words.some((word) => word.startsWith(asked)));
}

/** One search result: the message as a channel listing or thread shows it, and whether its thread is Closed. */
export interface SearchResult {
  readonly message: Message;
  readonly threadClosed: boolean;
}

/** A page of search results, newest first; `cursor` is null on the last page. */
export interface SearchResponse {
  readonly results: readonly SearchResult[];
  readonly hasMore: boolean;
  readonly cursor: string | null;
}

/** `GET /v1/search?q=<query>&cursor=<cursor>&limit=<n>`: a page of the messages matching a query, in every channel. */
export const searchPath = "/v1/search";

/** The codes the search route refuses with. */
export const searchErrorCodes = ["empty_query"] as const;
