import { field, list, parseJson, text } from "./json.ts";

interface Candidate {
  readonly image: string;
  readonly started: boolean;
  readonly updatedAt: string;
}

function candidates(machine: unknown): readonly Candidate[] {
  const image = text(field(field(machine, "config"), "image")) ?? "";
  if (image === "") {
    return [];
  }
  return [
    {
      image,
      started: text(field(machine, "state")) === "started",
      updatedAt: text(field(machine, "updated_at")) ?? "",
    },
  ];
}

function startedThenNewest(left: Candidate, right: Candidate): number {
  return Number(right.started) - Number(left.started) || right.updatedAt.localeCompare(left.updatedAt);
}

export function rollbackImage(machinesJson: string): string {
  const machines = list(parseJson(machinesJson)) ?? [];
  const [chosen = ""] = machines
    .flatMap((machine) => candidates(machine))
    .toSorted(startedThenNewest)
    .map((candidate) => candidate.image);
  return chosen;
}
