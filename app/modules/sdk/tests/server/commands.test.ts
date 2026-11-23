import { Array as Arr, Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { TestCookoutService } from "../../../testing/server.ts";
import { commandsPath } from "../../../commands/index.ts";

interface RawAnswer {
  readonly json: unknown;
  readonly status: number;
}

const BOOT = "2026-01-01T00:00:00.000Z";
const schema = { properties: { branch: { type: "string" } }, required: ["branch"], type: "object" };
const deploy = { name: "deploy", schema, url: "https://hooks.example.com/deploy" };

function postRawCommand(
  cookout: TestCookoutService,
  body: string,
): Effect.Effect<RawAnswer, never, HttpClient.HttpClient> {
  return HttpClientRequest.post(`${cookout.url}${commandsPath}`).pipe(
    HttpClientRequest.bearerToken(cookout.adminToken),
    HttpClientRequest.bodyText(body, "application/json"),
    HttpClient.execute,
    Effect.flatMap((response) => Effect.map(response.json, (json) => ({ json, status: response.status }))),
    Effect.orDie,
  );
}

it.effect("a command add by an identity that is not an admin is refused with 403", () =>
  Effect.gen(function* notAdmin() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const error = yield* refusal(() => ann.client.addCommand(deploy));
    const { commands } = yield* answer(cookout.client.listCommands);

    expect(error).toMatchObject({ code: "admin_only", status: 403 });
    expect(commands).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an admin adds a command: its secret is shown once, it is listed, and its handler is a flagged agent", () =>
  Effect.gen(function* addAndList() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const added = yield* answer(() => cookout.client.addCommand({ ...deploy, description: "Ship a branch" }));
    const listed = yield* answer(ann.client.listCommands);
    const { identities } = yield* answer(ann.client.listIdentities);
    const command = {
      createdAt: BOOT,
      description: "Ship a branch",
      handler: "deploy",
      name: "deploy",
      schema,
      url: deploy.url,
    };

    expect(added).toStrictEqual({ command, secret: "hmac_test_3" });
    expect(listed).toStrictEqual({ commands: [command] });
    expect(Arr.filter(identities, (identity) => "handler" in identity)).toStrictEqual([
      { admin: false, createdAt: BOOT, handler: true, kind: "agent", name: "deploy" },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a command whose name is an agent's reuses that agent as its handler", () =>
  Effect.gen(function* reuseAgent() {
    const cookout = yield* TestCookout;
    const bot = yield* cookout.createIdentity("deploy", { owner: "matt" });
    yield* answer(() => cookout.client.addCommand(deploy));
    const { identities } = yield* answer(cookout.client.listIdentities);
    const { identity } = yield* answer(bot.client.whoami);

    expect(identities).toContainEqual({ ...bot.identity, handler: true });
    expect(identity).toStrictEqual(bot.identity);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a command name in use, or a human's name, is refused with 409", () =>
  Effect.gen(function* nameTaken() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("ada", { kind: "human" });
    yield* answer(() => cookout.client.addCommand(deploy));
    const again = yield* refusal(() => cookout.client.addCommand(deploy));
    const human = yield* refusal(() => cookout.client.addCommand({ ...deploy, name: "ada" }));
    const { commands } = yield* answer(cookout.client.listCommands);

    expect([again, human]).toMatchObject([
      { code: "command_exists", status: 409 },
      { code: "handler_not_agent", status: 409 },
    ]);
    expect(Arr.map(commands, ({ name }) => name)).toStrictEqual(["deploy"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a command with a bad name, url or schema is refused with 400", () =>
  Effect.gen(function* badRequest() {
    const cookout = yield* TestCookout;
    const name = yield* refusal(() => cookout.client.addCommand({ ...deploy, name: "Deploy!" }));
    const url = yield* refusal(() => cookout.client.addCommand({ ...deploy, url: "ftp://example.com" }));
    const notObject = yield* postRawCommand(cookout, '{"name":"deploy","url":"https://example.com","schema":[]}');

    expect([name, url]).toMatchObject([
      { code: "invalid_request", details: [{ path: ["name"] }], status: 400 },
      { code: "invalid_request", details: [{ path: ["url"] }], status: 400 },
    ]);
    expect(notObject).toMatchObject({
      json: { error: { code: "invalid_request", details: [{ path: ["schema"] }] } },
      status: 400,
    });
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);
