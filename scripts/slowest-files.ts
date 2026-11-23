import { TIMINGS_DIR, readTimings, saveFullList, slowestSummary } from "./lib/slowest-files.ts";

const ARGUMENTS_START = 2;
const [label = "", runner = "", file = "", base = ""] = process.argv.slice(ARGUMENTS_START);

if (label === "" || file === "" || (runner !== "vitest" && runner !== "playwright")) {
  console.error("usage: node scripts/slowest-files.ts <label> <vitest|playwright> <report.json> <base>");
  process.exitCode = 1;
} else {
  const timings = readTimings({ base, file, runner });
  saveFullList({ dir: TIMINGS_DIR, label, timings });
  console.log(slowestSummary({ label, timings }));
}
