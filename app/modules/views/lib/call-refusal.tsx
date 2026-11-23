import { Alert, ItemList, ItemRow } from "../../design-system/index.tsx";
import type { CallState, SchemaProblem } from "../../board/index.ts";
import type { ReactNode } from "react";

const NONE = 0;

const TEXT = { problems: "Schema errors" } as const;

interface CallRefusalProps {
  readonly call: CallState;
}

function problemText(problem: SchemaProblem): string {
  return `${problem.path.join(".")}: ${problem.message}`;
}

export function CallRefusal(props: CallRefusalProps): ReactNode {
  const { call } = props;
  if (call.status !== "failed") {
    return null;
  }
  return (
    <Alert>
      {`Couldn't call /${call.command} (${call.code}): ${call.message}`}
      {call.problems.length > NONE && (
        <ItemList label={TEXT.problems}>
          {call.problems.map((problem) => (
            <ItemRow key={problemText(problem)}>{problemText(problem)}</ItemRow>
          ))}
        </ItemList>
      )}
    </Alert>
  );
}
