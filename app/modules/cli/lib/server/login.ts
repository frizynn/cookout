import type { CallFailure, CredentialSource } from "./adapters/sdk.ts";
import { Command, Flag } from "effect/cli";
import { Effect, Stdio, String as Str, Stream } from "effect";
import { callClient, toFailure, withClient } from "./adapters/sdk.ts";
import { removeLogin, saveLogin } from "./logins.ts";
import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { CommandFailed } from "./output.ts";
import type { IdentityResponse } from "../../../identities/index.ts";
import { answered } from "./output.ts";
import { baseUrlOf } from "../../../http/client.ts";
import { cookoutUrl } from "../../../config/server.ts";
import { createCookoutClient } from "../../../sdk/index.ts";

type LoginNeeds = AgentSessionStateNeeds | Stdio.Stdio;

interface LoggedIn extends IdentityResponse {
  readonly url: string;
}

interface LoggedOut {
  readonly loggedOut: boolean;
  readonly message?: string;
  readonly url: string;
}

interface WhoamiAnswer extends IdentityResponse {
  readonly source: CredentialSource;
}

const NOTHING = {};

const noToken: CallFailure = {
  code: "usage",
  message: "Give the token on stdin, such as `cookout login --token < token.txt`, or paste it and press Ctrl-D.",
};

const browserNotYet: CallFailure = {
  code: "usage",
  message: "Approving a Login in the browser isn't built yet. Run `cookout login --token` and give a token on stdin.",
};

const serverUrl = Effect.map(Effect.orDie(cookoutUrl), baseUrlOf);

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
  const removed = yield* removeLogin(url);
  if (!removed) {
    return { loggedOut: false, message: `There is no Login for ${url}.`, url };
  }
  return { loggedOut: true, url };
});

function logInWith(token: boolean): Effect.Effect<LoggedIn, CallFailure, LoginNeeds> {
  if (token) {
    return logIn;
  }
  return Effect.fail(browserNotYet);
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
    "Keep a human identity's token as the Login for COOKOUT_URL, in $XDG_CONFIG_HOME/cookout/credentials (default " +
      "~/.config/cookout/credentials, mode 600). With no COOKOUT_TOKEN and no agent tool, every command then acts as " +
      "that person. An agent's token is refused.",
  ),
);

const logoutCommand = Command.make("logout", {}, () => answered(logOut)).pipe(
  Command.withDescription("Remove the Login for COOKOUT_URL from this machine."),
);

const whoami = withClient((opened) =>
  Effect.map(
    callClient((client) => client.whoami())(opened),
    (answer): WhoamiAnswer => ({ ...answer, source: opened.source }),
  ),
);

const whoamiCommand = Command.make("whoami", {}, () => answered(whoami)).pipe(
  Command.withDescription(
    "Show the identity behind the token this CLI sends, and where the token came from: COOKOUT_TOKEN or login.",
  ),
);

export { loginCommand, logoutCommand, whoamiCommand };
