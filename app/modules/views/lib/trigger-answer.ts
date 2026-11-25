import type { TriggerFailure } from "../../sdk/index.ts";

type Answer = Pick<TriggerFailure, "error" | "status">;

function answerTextOf({ error, status }: Answer): string | undefined {
  if (typeof status !== "number") {
    return error;
  }
  const code = `HTTP ${String(status)}`;
  if (typeof error === "string") {
    return `${code}: ${error}`;
  }
  return code;
}

export { answerTextOf };
