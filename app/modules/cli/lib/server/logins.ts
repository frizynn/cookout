import { Effect, Equal, FileSystem, Option, Path, Random, Record as Rec, Schema, String as Str, pipe } from "effect";
import { cookoutUrl, home, xdgConfigHome } from "../../../config/server.ts";
import { baseUrlOf } from "../../../http/client.ts";

interface LoginFailure {
  readonly code: "cli_error" | "config_folder_missing" | "credentials_damaged" | "credentials_unsafe";
  readonly message: string;
}

type Needs = FileSystem.FileSystem | Path.Path;

const PRETTY = 2;
const PRIVATE_FOLDER = 0o700;
const PRIVATE_FILE = 0o600;
const PERMISSIONS = 0o1000;

const CredentialsSchema = Schema.Struct({
  logins: Schema.Record(Schema.String, Schema.Struct({ token: Schema.String })),
});

type Credentials = typeof CredentialsSchema.Type;

const decodeCredentials = Schema.decodeEffect(Schema.fromJsonString(CredentialsSchema));
const encodeCredentials = Schema.encodeEffect(Schema.fromJsonString(CredentialsSchema, { space: PRETTY }));
const NO_LOGINS: Credentials = { logins: {} };

interface CredentialsLocation {
  readonly file: string;
  readonly folder: string;
  readonly fs: FileSystem.FileSystem;
}

function failure(error: { readonly message: string }): LoginFailure {
  return { code: "cli_error", message: error.message };
}

const serverUrl: Effect.Effect<string> = Effect.map(Effect.orDie(cookoutUrl), baseUrlOf);

function setTo(value: string): Option.Option<string> {
  return Option.liftPredicate(value, Str.isNonEmpty);
}

const currentUser: Effect.Effect<Option.Option<number>> = Effect.sync(() =>
  Option.map(Option.fromNullishOr(process.getuid), (getuid) => getuid()),
);

const noConfigFolder: LoginFailure = {
  code: "config_folder_missing",
  message: "Set HOME or XDG_CONFIG_HOME so login has a folder to keep the Login in.",
};

const locate: Effect.Effect<Option.Option<CredentialsLocation>, never, Needs> = Effect.gen(function* findCredentials() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const xdg = yield* xdgConfigHome;
  const homeFolder = yield* home;
  const base = pipe(
    setTo(xdg),
    Option.orElse(() => Option.map(setTo(homeFolder), (folder) => path.join(folder, ".config"))),
  );
  return Option.map(base, (folder) => {
    const cookoutFolder = path.join(folder, "cookout");
    return { file: path.join(cookoutFolder, "credentials"), folder: cookoutFolder, fs };
  });
}).pipe(Effect.orDie);

function unsafe(file: string): LoginFailure {
  return {
    code: "credentials_unsafe",
    message: `The credentials file ${file} must be a file only you can read (mode 600), not a symlink. Run chmod 600 on it, or log in again after deleting it.`,
  };
}

function isPrivateFile({ mode, type, uid }: FileSystem.File.Info, user: Option.Option<number>): boolean {
  const ownedByUser = Option.isNone(user) || Equal.equals(uid, user);
  return type === "File" && mode % PERMISSIONS === PRIVATE_FILE && ownedByUser;
}

function readAt({ file, fs }: CredentialsLocation): Effect.Effect<Credentials, LoginFailure> {
  return Effect.gen(function* readCredentials() {
    const exists = yield* Effect.mapError(fs.exists(file), failure);
    if (!exists) {
      return NO_LOGINS;
    }
    const info = yield* Effect.mapError(fs.lstat(file), failure);
    const user = yield* currentUser;
    if (!isPrivateFile(info, user)) {
      return yield* Effect.fail(unsafe(file));
    }
    const text = yield* Effect.mapError(fs.readFileString(file), failure);
    return yield* Effect.mapError(decodeCredentials(text), () => ({
      code: "credentials_damaged" as const,
      message: `The credentials file ${file} is damaged. Delete it and log in again.`,
    }));
  });
}

function writeAt(
  { file, folder, fs }: CredentialsLocation,
  credentials: Credentials,
): Effect.Effect<void, LoginFailure> {
  return Effect.gen(function* writeCredentials() {
    const text = yield* Effect.orDie(encodeCredentials(credentials));
    const suffix = yield* Random.nextInt;
    const temporary = `${file}.${String(suffix)}.tmp`;
    yield* Effect.mapError(fs.makeDirectory(folder, { mode: PRIVATE_FOLDER, recursive: true }), failure);
    yield* Effect.mapError(fs.writeFileString(temporary, `${text}\n`, { flag: "wx", mode: PRIVATE_FILE }), failure);
    yield* Effect.mapError(fs.chmod(temporary, PRIVATE_FILE), failure);
    yield* Effect.mapError(fs.rename(temporary, file), failure);
  });
}

function loginFor(url: string): Effect.Effect<Option.Option<string>, LoginFailure, Needs> {
  return Effect.flatMap(
    locate,
    Option.match({
      onNone: () => Effect.succeedNone,
      onSome: (location) =>
        Effect.map(readAt(location), ({ logins }) => Option.map(Rec.get(logins, url), ({ token }) => token)),
    }),
  );
}

const located: Effect.Effect<CredentialsLocation, LoginFailure, Needs> = Effect.flatMap(locate, (found) =>
  Effect.mapError(Effect.fromOption(found), () => noConfigFolder),
);

function saveLogin({
  token,
  url,
}: {
  readonly token: string;
  readonly url: string;
}): Effect.Effect<void, LoginFailure, Needs> {
  return Effect.gen(function* keepLogin() {
    const location = yield* located;
    const { logins } = yield* readAt(location);
    yield* writeAt(location, { logins: Rec.set(logins, url, { token }) });
  });
}

function removeLogin(url: string): Effect.Effect<void, LoginFailure, Needs> {
  return Effect.gen(function* forgetLogin() {
    const location = yield* located;
    const { logins } = yield* readAt(location);
    yield* writeAt(location, { logins: Rec.remove(logins, url) });
  });
}

export { type LoginFailure, loginFor, removeLogin, saveLogin, serverUrl };
