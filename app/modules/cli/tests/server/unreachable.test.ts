import {
  TestCookout,
  answer,
  commandLineServices,
  runCookout,
  serverAnswering,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const UNKNOWN_HOST = "http://cookout.invalid";
const CHECK_SETTINGS = "(check COOKOUT_URL, or HTTPS_PROXY if you are behind a proxy)";

const closedPortUrl = Effect.scoped(serverAnswering({ text: "closed once the scope ends" }));

it.effect("a refused port gives unreachable, naming the URL and the refused connection", () =>
  Effect.gen(function* refusedPort() {
    const url = yield* closedPortUrl;
    const result = yield* runCookout({ args: ["whoami"], env: { COOKOUT_TOKEN: "any", COOKOUT_URL: url } });

    expect(result).toMatchObject({ exitCode: 1, stderrJson: { error: { code: "unreachable" } } });
    expect(result.stderr).toMatch(/ECONNREFUSED/u);
    expect(result.stderr).toContain(`cannot reach ${url}: `);
    expect(result.stderr).toContain(CHECK_SETTINGS);
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("an unknown host gives unreachable, naming the URL and the failed lookup", () =>
  Effect.gen(function* unknownHost() {
    const result = yield* runCookout({ args: ["whoami"], env: { COOKOUT_TOKEN: "any", COOKOUT_URL: UNKNOWN_HOST } });

    expect(result).toMatchObject({ exitCode: 1, stderrJson: { error: { code: "unreachable" } } });
    expect(result.stderr).toContain(`cannot reach ${UNKNOWN_HOST}: getaddrinfo `);
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("with HTTP_PROXY set, the CLI sends its request to the proxy, which answers for a host it can't see", () =>
  Effect.gen(function* throughProxy() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const body = yield* answer(() => ann.client.whoami());
    const proxy = yield* serverAnswering({ body });
    const env = { COOKOUT_TOKEN: ann.token, COOKOUT_URL: UNKNOWN_HOST };

    const viaProxy = yield* runCookout({ args: ["whoami"], env: { ...env, HTTP_PROXY: proxy } });
    const viaLowercase = yield* runCookout({ args: ["whoami"], env: { ...env, http_proxy: proxy } });

    expect([viaProxy, viaLowercase]).toMatchObject([
      { exitCode: 0, stdoutJson: { identity: { name: "ann" } } },
      { exitCode: 0, stdoutJson: { identity: { name: "ann" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("a host NO_PROXY names is reached directly, past HTTP_PROXY", () =>
  Effect.gen(function* bypassProxy() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const deadProxy = yield* closedPortUrl;
    const env = { COOKOUT_TOKEN: ann.token, COOKOUT_URL: cookout.url, HTTP_PROXY: deadProxy, NO_PROXY: "127.0.0.1" };

    const direct = yield* runCookout({ args: ["whoami"], env });

    expect(direct).toMatchObject({ exitCode: 0, stdoutJson: { identity: { name: "ann" } } });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("with HTTPS_PROXY set, an https:// server is reached through it, and a dead proxy gives unreachable", () =>
  Effect.gen(function* deadHttpsProxy() {
    const deadProxy = yield* closedPortUrl;
    const env = { COOKOUT_TOKEN: "any", COOKOUT_URL: "https://cookout.invalid", HTTPS_PROXY: deadProxy };

    const result = yield* runCookout({ args: ["whoami"], env });

    expect(result).toMatchObject({ exitCode: 1, stderrJson: { error: { code: "unreachable" } } });
    expect(result.stderr).toMatch(/ECONNREFUSED/u);
  }).pipe(Effect.provide(commandLineServices)),
);
