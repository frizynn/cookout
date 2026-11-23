import type { Command, CommandWithSecretResponse, ListCommandsResponse } from "../../index.ts";
import {
  commandDescriptionLength,
  commandNamePattern,
  commandSecretPattern,
  commandUrlMaximumLength,
  isCommandName,
  isCommandSecret,
} from "../../index.ts";
import { identityNamePattern, isIdentityName } from "../../../identities/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

function isWebUrl(value: string): boolean {
  return URL.canParse(value) && WEB_PROTOCOLS.has(new URL(value).protocol);
}

const CommandNameSchema = Schema.String.check(
  Schema.isPattern(commandNamePattern, { message: "Use 1-64 lowercase letters, digits or '-'." }).abort(),
).pipe(Schema.refine(isCommandName, { identifier: "CommandName" }));

const HandlerNameSchema = Schema.String.check(Schema.isPattern(identityNamePattern).abort()).pipe(
  Schema.refine(isIdentityName, { identifier: "IdentityName" }),
);

const UrlSchema = Schema.String.check(
  Schema.isMaxLength(commandUrlMaximumLength).abort(),
  Schema.makeFilter(isWebUrl, { message: "Use an http or https URL." }),
);

const JsonSchemaSchema = Schema.Record(Schema.String, Schema.Json);

const DescriptionSchema = Schema.String.check(
  Schema.isBetweenLength(commandDescriptionLength.minimum, commandDescriptionLength.maximum),
);

const SecretSchema = Schema.String.check(Schema.isPattern(commandSecretPattern)).pipe(
  Schema.refine(isCommandSecret, { identifier: "CommandSecret" }),
);

const CommandSchema = matchesWire<Command>()(
  Schema.Struct({
    createdAt: IsoTimeSchema,
    description: Schema.optionalKey(DescriptionSchema),
    handler: HandlerNameSchema,
    name: CommandNameSchema,
    schema: JsonSchemaSchema,
    url: Schema.String,
  }),
);

export const AddCommandRequestSchema = Schema.Struct({
  description: Schema.optionalKey(DescriptionSchema),
  name: CommandNameSchema,
  schema: JsonSchemaSchema,
  url: UrlSchema,
});

export const CommandWithSecretResponseSchema = matchesWire<CommandWithSecretResponse>()(
  Schema.Struct({ command: CommandSchema, secret: SecretSchema }),
);

export const ListCommandsResponseSchema = matchesWire<ListCommandsResponse>()(
  Schema.Struct({ commands: Schema.Array(CommandSchema) }),
);
