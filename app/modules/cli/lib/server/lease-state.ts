import { Effect, FileSystem, Option, Path, Schema, String as Str } from "effect";
import { home, stateDirectory, xdgStateHome } from "../../../config/server.ts";
import { identityNamePattern, isIdentityName } from "../../../identities/index.ts";
import { isLeaseId, leaseIdPattern } from "../../../leases/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { LeaseId } from "../../../leases/index.ts";
import { Secrets } from "../../../secrets/server.ts";

interface LeaseStateFailure {
  readonly code: "cli_error" | "lease_state_damaged";
  readonly message: string;
}

type Needs = FileSystem.FileSystem | Path.Path | Secrets;

interface LeaseStateFile {
  readonly read: Effect.Effect<Option.Option<LeaseState>, LeaseStateFailure>;
  readonly write: (state: LeaseState) => Effect.Effect<void, LeaseStateFailure>;
  readonly remove: Effect.Effect<void, LeaseStateFailure>;
}

interface Session {
  readonly url: string;
  readonly token: string;
}

interface LeaseStateLocation {
  readonly file: string;
  readonly folder: string;
  readonly fs: FileSystem.FileSystem;
}

const KEY_START = 0;
const KEY_LENGTH = 32;
const PRETTY = 2;
const PRIVATE_FOLDER = 0o700;
const PRIVATE_FILE = 0o600;

const LeaseStateSchema = Schema.Struct({
  expiresAt: IsoTimeSchema,
  identity: Schema.String.check(Schema.isPattern(identityNamePattern).abort()).pipe(Schema.refine(isIdentityName)),
  leaseId: Schema.String.check(Schema.isPattern(leaseIdPattern).abort()).pipe(Schema.refine(isLeaseId)),
  url: Schema.String,
});

interface LeaseState {
  readonly expiresAt: IsoTime;
  readonly identity: IdentityName;
  readonly leaseId: LeaseId;
  readonly url: string;
}

const decodeLeaseState = Schema.decodeEffect(Schema.fromJsonString(LeaseStateSchema));
const encodeLeaseState = Schema.encodeEffect(Schema.fromJsonString(LeaseStateSchema, { space: PRETTY }));

function failure(error: { readonly message: string }): LeaseStateFailure {
  return { code: "cli_error", message: error.message };
}

function damaged(file: string): LeaseStateFailure {
  return { code: "lease_state_damaged", message: `The lease state file ${file} is damaged. Delete it and join again.` };
}

function stateFolder(path: Path.Path): Effect.Effect<string> {
  return Effect.gen(function* findStateFolder() {
    const explicit = yield* stateDirectory;
    if (explicit !== "") {
      return explicit;
    }
    const xdg = yield* xdgStateHome;
    if (xdg !== "") {
      return path.join(xdg, "cookout");
    }
    const homeFolder = yield* home;
    return path.join(homeFolder, ".local", "state", "cookout");
  }).pipe(Effect.orDie);
}

function readFrom({ file, fs }: LeaseStateLocation): Effect.Effect<Option.Option<LeaseState>, LeaseStateFailure> {
  return Effect.gen(function* readLeaseState() {
    const exists = yield* Effect.mapError(fs.exists(file), failure);
    if (!exists) {
      return Option.none();
    }
    const text = yield* Effect.mapError(fs.readFileString(file), failure);
    const state = yield* Effect.mapError(decodeLeaseState(text), () => damaged(file));
    return Option.some(state);
  });
}

function writeTo({
  file,
  folder,
  fs,
}: LeaseStateLocation): (state: LeaseState) => Effect.Effect<void, LeaseStateFailure> {
  return (state) =>
    Effect.gen(function* writeLeaseState() {
      const text = yield* Effect.orDie(encodeLeaseState(state));
      const temporary = `${file}.tmp`;
      yield* fs.makeDirectory(folder, { mode: PRIVATE_FOLDER, recursive: true });
      yield* fs.writeFileString(temporary, `${text}\n`, { mode: PRIVATE_FILE });
      yield* fs.rename(temporary, file);
    }).pipe(Effect.mapError(failure));
}

function locationOf(session: Session): Effect.Effect<LeaseStateLocation, never, Needs> {
  return Effect.gen(function* findLeaseState() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const secrets = yield* Secrets;
    const base = yield* stateFolder(path);
    const digest = yield* secrets.digest(`${session.url}\n${session.token}`);
    const folder = path.join(base, "leases");
    const file = path.join(folder, `${Str.slice(KEY_START, KEY_LENGTH)(digest)}.json`);
    return { file, folder, fs };
  });
}

function leaseStateFile(session: Session): Effect.Effect<LeaseStateFile, never, Needs> {
  return Effect.map(locationOf(session), (location) => ({
    read: readFrom(location),
    remove: Effect.mapError(location.fs.remove(location.file, { force: true }), failure),
    write: writeTo(location),
  }));
}

export { type LeaseState, type LeaseStateFile, type Needs as LeaseStateNeeds, leaseStateFile };
