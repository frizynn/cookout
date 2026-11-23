import { Command, Flag } from "effect/cli";
import { Effect, Option, Stdio, String as Str, Stream } from "effect";
import { logInByBrowser, revokedOnServer } from "./browser-login.ts";
import { loginFor, removeLogin, saveLogin, serverUrl } from "./logins.ts";
import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { CallFailure } from "./adapters/sdk.ts";
import type { CommandFailed } from "./output.ts";
import type { LoggedIn } from "./browser-login.ts";
import { answered } from "./output.ts";
import { createCookoutClient } from "../../../sdk/index.ts";
import { toFailure } from "./adapters/sdk.ts";

type LoginNeeds = AgentSessionStateNeeds | Stdio.Stdio;

interface LoggedOut {
  readonly loggedOut: boolean;
  readonly message?: string;
  readonly revoked?: boolean;
  readonly url: string;
}

const NOTHING = {};

const noToken: CallFailure = {
  code: "usage",
  message: "Give the token on stdin, such as `cookout login --token < token.txt`, or paste it and press Ctrl-D.",
};

const tokenFromStdin: Effect.Effect<string, CallFailure, Stdio.Stdio> = Effect.gen(function* readToken() {
  const stdio = yield* Stdio.Stdio;
  const text = yield* stdio.stdin.pipe(Stream.decodeText, Stream.mkString, Effect.mapError(toFailure));
  const token = Str.trim(text);
  if (token === "") {
    return yield* Effect.fail(noToken);
  }
  return token;
});

function humanOnly(name: string): CallFailure {
  return {
    code: "human_only",
    message: `${name} is an agent. A Login is a person's: log in with a human identity's token, and give an agent its token through COOKOUT_TOKEN.`,
  };
}

const logIn: Effect.Effect<LoggedIn, CallFailure, LoginNeeds> = Effect.gen(function* keepLogin() {
  const url = yield* serverUrl;
  const token = yield* tokenFromStdin;
  const client = yield* Effect.try({ catch: toFailure, try: () => createCookoutClient({ env: NOTHING, token, url }) });
  const { identity } = yield* Effect.tryPromise({ catch: toFailure, try: () => client.whoami() });
  if (identity.kind !== "human") {
    return yield* Effect.fail(humanOnly(identity.name));
  }
  yield* saveLogin({ token, url });
  return { identity, url };
});

const logOut: Effect.Effect<LoggedOut, CallFailure, AgentSessionStateNeeds> = Effect.gen(function* forgetLogin() {
  const url = yield* serverUrl;
  const saved = yield* loginFor(url);
  if (Option.isNone(saved)) {
    return { loggedOut: false, message: `There is no Login for ${url}.`, url };
  }
  const revoked = yield* revokedOnServer({ token: saved.value, url });
  yield* removeLogin(url);
  return { loggedOut: true, revoked, url };
});

function logInWith(token: boolean): Effect.Effect<LoggedIn, CallFailure, LoginNeeds> {
  if (token) {
    return logIn;
  }
  return Effect.flatMap(serverUrl, logInByBrowser);
}

const tokenFlag = Flag.Boolean("token").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Read a human identity's token from stdin, never from the command line."),
);

type LoginCommand = Command.Command<"login", { readonly token: boolean }, object, CommandFailed, LoginNeeds>;

const loginCommand: LoginCommand = Command.make("login", { token: tokenFlag }, ({ token }) =>
  answered(logInWith(token)),
).pipe(
  Command.withDescription(
    "Log this machine in to COOKOUT_URL: print a link and a code, and wait while a person approves it in the web UI. " +
      "With --token, keep a human identity's token instead. The Login is kept in $XDG_CONFIG_HOME/cookout/credentials (default " +
      "~/.config/cookout/credentials, mode 600). With no COOKOUT_TOKEN and no agent tool, every command then acts as " +
      "that person; inside an agent tool, join uses it to join an agent the person owns. An agent's token is refused.",
  ),
);

const logoutCommand = Command.make("logout", {}, () => answered(logOut)).pipe(
  Command.withDescription(
    "Remove the Login for COOKOUT_URL from this machine, and revoke it on the server if it came from a browser login.",
  ),
);

export { loginCommand, logoutCommand };
