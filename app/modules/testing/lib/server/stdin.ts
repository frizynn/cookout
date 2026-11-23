import { Effect, Sink, Stdio, Stream } from "effect";

const encoder = new TextEncoder();

export function stdioWithStdin(text: string): Stdio.Stdio {
  return Stdio.make({
    args: Effect.succeed([]),
    stderr: () => Sink.drain,
    stdin: Stream.make(encoder.encode(text)),
    stdout: () => Sink.drain,
  });
}
