/**
 * Commands on the wire, shared by the server, the SDK and the web: the
 * `CommandName` and `CommandSecret` brands and their checks, the command as
 * the server shows it, the request and answers of the command routes, their
 * paths, and the error codes they refuse with.
 */
import type { AgentIdentity, IdentityName, Owner } from "../identities/index.ts";
import type { JsonValue, MessageId } from "../messages/index.ts";
import type { IsoTime } from "../time/index.ts";
import { plainNamePattern } from "../identities/index.ts";

declare const brand: unique symbol;

type Brand<Name extends string> = string & { readonly [brand]: Name };

/** A command's name. It is also the name of the command's handler identity, so it follows the plain identity-name rule (no `/`). */
export type CommandName = Brand<"CommandName">;

/** The per-command secret the server signs webhook deliveries with (an HMAC of the body). Shown once, on add or rotate. */
export type CommandSecret = Brand<"CommandSecret">;

/** A JSON Schema, the rule a command's call data must follow. */
export type JsonSchema = Readonly<Record<string, JsonValue>>;

/** The rule every command name follows: the plain identity-name rule, for the backend's Schemas. */
export const commandNamePattern = plainNamePattern;

/**
 * Whether `value` follows the command-name rule; if so, it is a `CommandName`.
 * @param value The name to check.
 * @returns Whether `value` is a `CommandName`.
 */
export function isCommandName(value: string): value is CommandName {
  return commandNamePattern.test(value);
}

/** The rule every command secret the server issues follows. */
export const commandSecretPattern = /^hmac_[A-Za-z0-9_-]+$/u;

/**
 * Whether `value` looks like a command secret the server issued; if so, it is a `CommandSecret`.
 * @param value The secret to check.
 * @returns Whether `value` is a `CommandSecret`.
 */
export function isCommandSecret(value: string): value is CommandSecret {
  return commandSecretPattern.test(value);
}

/** The ID of one command call, sent with its webhook delivery and repeated on each retry, so a handler can drop repeats. */
export type CallId = Brand<"CallId">;

/**
 * Whether `value` looks like a call ID the server issued (`call_` and base64url characters); if so, it is a `CallId`.
 * @param value The ID to check.
 * @returns Whether `value` is a `CallId`.
 */
export function isCallId(value: string): value is CallId {
  return /^call_[A-Za-z0-9_-]+$/u.test(value);
}

/** The description rule, in UTF-16 code units as `String.length` counts them. */
export const commandDescriptionLength = { maximum: 500, minimum: 1 } as const;

/** The longest webhook URL the server takes. */
export const commandUrlMaximumLength = 2000;

/** A registered command as the server shows it. Its secret is never part of it. */
export interface Command {
  readonly name: CommandName;
  /** The `http` or `https` URL the server posts calls to. */
  readonly url: string;
  /** The JSON Schema a call's data must follow. */
  readonly schema: JsonSchema;
  /** 1-500 characters. */
  readonly description?: string;
  /** The agent identity the command's results post as. It has the command's name. */
  readonly handler: IdentityName;
  readonly createdAt: IsoTime;
}

/** The body of `POST /v1/commands`. The server checks the name, URL, schema and description. */
export interface AddCommandRequest {
  readonly name: string;
  readonly url: string;
  readonly schema: JsonSchema;
  readonly description?: string;
}

/** The answer to adding a command or rotating its secret. The secret is shown this once only. */
export interface CommandWithSecretResponse {
  readonly command: Command;
  readonly secret: CommandSecret;
}

/**
 * The answer to `GET /v1/commands`: every command, sorted by name, the registered ones and those the server handles
 * itself (`/spawn-agent`), so every client discovers both the same way. A command the server handles has an empty `url`.
 */
export interface ListCommandsResponse {
  readonly commands: readonly Command[];
}

/** The body of a command call. The server checks `data` against the command's schema. */
export interface CallCommandRequest {
  /** The channel the call message is posted in. */
  readonly channel: string;
  readonly data: JsonValue;
}

/** The answer to a command call (202): the call message, which is also the top-level message of its thread. */
export interface CallCommandResponse {
  readonly messageId: MessageId;
  readonly threadId: MessageId;
}

/**
 * The command the server handles itself (mattpocock/cookout#231, provisional name): `/spawn-agent` with
 * `{ name, task }` creates an agent the caller owns, described by the task, and starts a remote Claude Code session
 * that joins as it, through the routine `COOKOUT_ROUTINE_FIRE_URL` names. Its replies post as the agent `spawn-agent`.
 */
export const spawnAgentCommandName = "spawn-agent";

/** `GET /v1/commands` (any identity) and `POST /v1/commands` (admin). */
export const commandsPath = "/v1/commands";

/** `POST /v1/commands/:name/calls` (any identity): call the command `name`. */
export const commandCallsPath = "/v1/commands/:name/calls";

/** `POST /v1/commands/:name/secret` (admin): rotate the secret of the command `name`. */
export const commandSecretPath = "/v1/commands/:name/secret";

/**
 * The codes the command routes refuse with: a name in use (409), a name that is a human's (409), and a call to, or a
 * secret rotation of, a command that doesn't exist (404).
 */
export const commandErrorCodes = ["command_exists", "handler_not_agent", "command_not_found"] as const;

/**
 * The command's handler identity: an agent with the command's name, as it is stored when the command is added. A
 * handler made by `command add` is owned by the admin who ran it; one it reuses keeps its owner.
 * @param added The command whose handler identity to make, and the human who adds it.
 * @returns The handler identity, which posts the command's replies.
 */
export function handlerOf(added: { readonly command: Command; readonly owner: Owner }): AgentIdentity {
  const { command, owner } = added;
  return { admin: false, createdAt: command.createdAt, kind: "agent", name: command.handler, owner };
}
