import type {
  BuiltInCommand,
  CallCommandResponse,
  CommandWithSecretResponse,
  ListCommandsResponse,
  RegisteredCommand,
} from "../../index.ts";
import {
  commandDescriptionLength,
  commandNamePattern,
  commandSecretPattern,
  commandUrlMaximumLength,
  isCommandName,
  isCommandSecret,
} from "../../index.ts";
import { identityNamePattern, isIdentityName } from "../../../identities/index.ts";
import { ChannelNameSchema } from "../../../channels/server.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { MessageIdSchema } from "../../../messages/server.ts";
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

const commandFields = {
  createdAt: IsoTimeSchema,
  description: Schema.optionalKey(DescriptionSchema),
  handler: HandlerNameSchema,
  name: CommandNameSchema,
  schema: JsonSchemaSchema,
};

const BuiltInCommandSchema = matchesWire<BuiltInCommand>()(
  Schema.Struct({ ...commandFields, builtIn: Schema.Literal(true) }),
);

const RegisteredCommandSchema = matchesWire<RegisteredCommand>()(
  Schema.Struct({ ...commandFields, url: Schema.String }),
);

const ListedCommandSchema = Schema.Union([RegisteredCommandSchema, BuiltInCommandSchema]);

export { RegisteredCommandSchema };

export const AddCommandRequestSchema = Schema.Struct({
  description: Schema.optionalKey(DescriptionSchema),
  name: CommandNameSchema,
  schema: JsonSchemaSchema,
  url: UrlSchema,
});

export const CommandWithSecretResponseSchema = matchesWire<CommandWithSecretResponse>()(
  Schema.Struct({ command: RegisteredCommandSchema, secret: SecretSchema }),
);

export const ListCommandsResponseSchema = matchesWire<ListCommandsResponse>()(
  Schema.Struct({ commands: Schema.Array(ListedCommandSchema) }),
);

export const CallCommandRequestSchema = Schema.Struct({ channel: ChannelNameSchema, data: Schema.Json });

export const CallCommandResponseSchema = matchesWire<CallCommandResponse>()(
  Schema.Struct({ messageId: MessageIdSchema, threadId: MessageIdSchema }),
);
