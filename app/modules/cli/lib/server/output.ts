import { Console, Effect, Schema } from "effect";
import { CliOutput } from "effect/cli";

class CommandFailed extends Schema.TaggedError<CommandFailed>()("CommandFailed", {
  code: Schema.String,
}) {}

export const printLine = (line: Readonly<Record<string, unknown>>) => Console.log(JSON.stringify(line));

const printError = (code: string, message: string) => Console.error(JSON.stringify({ error: { code, message } }));

const presentInvalid = (event: CliOutput.Presenter.InvalidInvocation) =>
  Effect.gen(function* () {
    const formatter = yield* CliOutput.Formatter;
    yield* printError("usage", `${formatter.formatErrors(event.errors)}\n\n${formatter.formatHelpDoc(event.helpDoc)}`);
  });

export const jsonPresenter = CliOutput.layerPresenter({
  present: (event) =>
    event._tag === "InvalidInvocation" ? presentInvalid(event) : CliOutput.defaultPresenter.present(event),
});

export const usageFailed = Effect.fail(new CommandFailed({ code: "usage" }));

export const printAnswer = (answer: unknown) => Console.log(JSON.stringify(answer, null, 2));

export const refused = (error: { readonly code: string }) =>
  Console.error(JSON.stringify({ error })).pipe(Effect.andThen(Effect.fail(new CommandFailed({ code: error.code }))));
