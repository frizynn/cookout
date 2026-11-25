import type { CommandName, CommandSecret } from "../../../webhook-commands/index.ts";
import { fixtureOwnerName, identityName } from "./identities.ts";
import { isCommandName, isCommandSecret } from "../../../webhook-commands/index.ts";
import type { AgentIdentity } from "../../../identities/index.ts";
import { Option } from "effect";
import type { StoredCommand } from "../../../storage/server.ts";
import { fixtureTime } from "./time.ts";

interface CommandFixtureOptions {
  readonly description?: string;
  readonly secret?: string;
}

function commandName(value: string): CommandName {
  return Option.getOrThrow(Option.liftPredicate(value, isCommandName));
}

function secretOf(value: string): CommandSecret {
  return Option.getOrThrow(Option.liftPredicate(value, isCommandSecret));
}

function handlerFixture(name: string): AgentIdentity {
  return { admin: false, createdAt: fixtureTime, kind: "agent", name: identityName(name), owner: fixtureOwnerName };
}

function commandFixture(name: string, ...options: readonly CommandFixtureOptions[]): StoredCommand {
  const [{ description, secret = `hmac_${name}` } = {}] = options;
  const command = {
    createdAt: fixtureTime,
    handler: identityName(name),
    name: commandName(name),
    schema: { type: "object" },
    url: `https://hooks.example.com/${name}`,
  };
  if (typeof description === "string") {
    return { command: { ...command, description }, secret: secretOf(secret) };
  }
  return { command, secret: secretOf(secret) };
}

export { type CommandFixtureOptions, commandFixture, commandName, handlerFixture };
