import { spawnSync } from "node:child_process";

const UNKNOWN = "unknown";
const OK = 0;

export function buildCommit(given: string): string {
  if (given !== "") {
    return given;
  }
  const head = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" });
  const commit = head.stdout.trim();
  if (head.status !== OK || commit === "") {
    return UNKNOWN;
  }
  return commit;
}
