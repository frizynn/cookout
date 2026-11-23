import { Effect, Equal, FileSystem, Option, Path, Random, Schema, String as Str, pipe } from "effect";
import type { IdentityName, Token } from "../../../identities/index.ts";
import { home, stateDirectory, xdgStateHome } from "../../../config/server.ts";
import { identityNamePattern, isIdentityName, isToken, tokenPattern } from "../../../identities/index.ts";
import type { CookoutConnection } from "../../../config/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Secrets } from "../../../secrets/server.ts";

interface AgentSessionStateFailure {
  readonly code: "cli_error" | "agent_session_state_damaged" | "agent_session_state_unsafe" | "state_folder_missing";
  readonly message: string;
}

type Needs = FileSystem.FileSystem | Path.Path | Secrets;

interface AgentSessionStateFile {
  readonly read: Effect.Effect<Option.Option<AgentSessionState>, AgentSessionStateFailure>;
  readonly write: (state: AgentSessionState) => Effect.Effect<void, AgentSessionStateFailure>;
  readonly remove: Effect.Effect<void, AgentSessionStateFailure>;
}

interface AgentSessionStateLocation {
  readonly base: string;
  readonly file: string;
  readonly folder: string;
  readonly fs: FileSystem.FileSystem;
}

const KEY_START = 0;
const KEY_LENGTH = 32;
const PRETTY = 2;
const PRIVATE_FOLDER = 0o700;
const PRIVATE_FILE = 0o600;
const PERMISSIONS = 0o1000;

const currentUser: Effect.Effect<Option.Option<number>> = Effect.sync(() =>
  Option.map(Option.fromNullishOr(process.getuid), (getuid) => getuid()),
);

const AgentSessionStateSchema = Schema.Struct({
  agentSessionToken: Schema.String.check(Schema.isPattern(tokenPattern).abort()).pipe(Schema.refine(isToken)),
  expiresAt: IsoTimeSchema,
  identity: Schema.String.check(Schema.isPattern(identityNamePattern).abort()).pipe(Schema.refine(isIdentityName)),
  issuedAt: IsoTimeSchema,
  url: Schema.String,
});

interface AgentSessionState {
  readonly agentSessionToken: Token;
  readonly expiresAt: IsoTime;
  readonly identity: IdentityName;
  readonly issuedAt: IsoTime;
  readonly url: string;
}

const decodeAgentSessionState = Schema.decodeEffect(Schema.fromJsonString(AgentSessionStateSchema));
const encodeAgentSessionState = Schema.encodeEffect(Schema.fromJsonString(AgentSessionStateSchema, { space: PRETTY }));

function failure(error: { readonly message: string }): AgentSessionStateFailure {
  return { code: "cli_error", message: error.message };
}

function damaged(file: string): AgentSessionStateFailure {
  return {
    code: "agent_session_state_damaged",
    message: `The agent session state file ${file} is damaged. Delete it and join again.`,
  };
}

function setTo(value: string): Option.Option<string> {
  return Option.liftPredicate(value, Str.isNonEmpty);
}

function stateFolder(path: Path.Path): Effect.Effect<Option.Option<string>> {
  return Effect.gen(function* findStateFolder() {
    const explicit = yield* stateDirectory;
    const xdg = yield* xdgStateHome;
    const homeFolder = yield* home;
    return pipe(
      setTo(explicit),
      Option.orElse(() => Option.map(setTo(xdg), (folder) => path.join(folder, "cookout"))),
      Option.orElse(() => Option.map(setTo(homeFolder), (folder) => path.join(folder, ".local", "state", "cookout"))),
    );
  }).pipe(Effect.orDie);
}

function unsafeFolder(folder: string): AgentSessionStateFailure {
  return {
    code: "agent_session_state_unsafe",
    message: `The state folder ${folder} must be a folder only you can open (mode 700), not a symlink. Run chmod 700 on it, or set COOKOUT_STATE_DIR to a private folder.`,
  };
}

function isPrivateFolder({ mode, type, uid }: FileSystem.File.Info, user: Option.Option<number>): boolean {
  const ownedByUser = Option.isNone(user) || Equal.equals(uid, user);
  return type === "Directory" && mode % PERMISSIONS === PRIVATE_FOLDER && ownedByUser;
}

function checkFolder(fs: FileSystem.FileSystem, folder: string): Effect.Effect<boolean, AgentSessionStateFailure> {
  return Effect.gen(function* checkStateFolder() {
    const exists = yield* Effect.mapError(fs.exists(folder), failure);
    if (!exists) {
      return false;
    }
    const info = yield* Effect.mapError(fs.lstat(folder), failure);
    const user = yield* currentUser;
    if (!isPrivateFolder(info, user)) {
      return yield* Effect.fail(unsafeFolder(folder));
    }
    return true;
  });
}

function checkFolders({
  base,
  folder,
  fs,
}: AgentSessionStateLocation): Effect.Effect<boolean, AgentSessionStateFailure> {
  return Effect.flatMap(checkFolder(fs, base), (baseExists) => {
    if (!baseExists) {
      return Effect.succeed(false);
    }
    return checkFolder(fs, folder);
  });
}

function readFrom(
  location: AgentSessionStateLocation,
): Effect.Effect<Option.Option<AgentSessionState>, AgentSessionStateFailure> {
  const { file, fs } = location;
  return Effect.gen(function* readAgentSessionState() {
    const folderExists = yield* checkFolders(location);
    const exists = yield* Effect.mapError(fs.exists(file), failure);
    if (!folderExists || !exists) {
      return Option.none();
    }
    const text = yield* Effect.mapError(fs.readFileString(file), failure);
    const state = yield* Effect.mapError(decodeAgentSessionState(text), () => damaged(file));
    return Option.some(state);
  });
}

function writeTo(
  location: AgentSessionStateLocation,
): (state: AgentSessionState) => Effect.Effect<void, AgentSessionStateFailure> {
  const { file, folder, fs } = location;
  return (state) =>
    Effect.gen(function* writeAgentSessionState() {
      const text = yield* Effect.orDie(encodeAgentSessionState(state));
      const suffix = yield* Random.nextInt;
      const temporary = `${file}.${String(suffix)}.tmp`;
      yield* Effect.mapError(fs.makeDirectory(folder, { mode: PRIVATE_FOLDER, recursive: true }), failure);
      yield* checkFolders(location);
      yield* Effect.mapError(fs.writeFileString(temporary, `${text}\n`, { flag: "wx", mode: PRIVATE_FILE }), failure);
      yield* Effect.mapError(fs.chmod(temporary, PRIVATE_FILE), failure);
      yield* Effect.mapError(fs.rename(temporary, file), failure);
    });
}

function locationOf({
  token = "",
  url,
}: CookoutConnection): Effect.Effect<Option.Option<AgentSessionStateLocation>, never, Needs> {
  return Effect.gen(function* findAgentSessionState() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const secrets = yield* Secrets;
    const found = yield* stateFolder(path);
    const digest = yield* secrets.digest(`${url}\n${token}`);
    const name = `${Str.slice(KEY_START, KEY_LENGTH)(digest)}.json`;
    return Option.map(found, (base) => {
      const folder = path.join(base, "agent-sessions");
      return { base, file: path.join(folder, name), folder, fs };
    });
  });
}

function fileAt(location: AgentSessionStateLocation): AgentSessionStateFile {
  return {
    read: readFrom(location),
    remove: Effect.mapError(location.fs.remove(location.file, { force: true }), failure),
    write: writeTo(location),
  };
}

const noStateFolder: AgentSessionStateFile = {
  read: Effect.succeedNone,
  remove: Effect.void,
  write: () =>
    Effect.fail({
      code: "state_folder_missing",
      message: "Set HOME, XDG_STATE_HOME or COOKOUT_STATE_DIR so join has a folder to keep its agent session token in.",
    }),
};

function agentSessionStateFile(connection: CookoutConnection): Effect.Effect<AgentSessionStateFile, never, Needs> {
  return Effect.map(locationOf(connection), Option.match({ onNone: () => noStateFolder, onSome: fileAt }));
}

export {
  type AgentSessionState,
  type AgentSessionStateFailure,
  type AgentSessionStateFile,
  type Needs as AgentSessionStateNeeds,
  agentSessionStateFile,
};
