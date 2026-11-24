import { availableParallelism, loadavg } from "node:os";

interface Reading {
  readonly cores: number;
  readonly load: number;
}

interface LoadReport {
  readonly line: string;
  readonly warning: string;
}

const LAST_MINUTE = 0;
const DECIMALS = 2;

function osReading(): Reading {
  const [load = LAST_MINUTE] = loadavg();
  return { cores: availableParallelism(), load };
}

function loadReport(read: () => Reading): LoadReport {
  const { cores, load } = read();
  const shown = load.toFixed(DECIMALS);
  const line = `check: load average ${shown} over the last minute, on ${cores} cores.`;
  if (load <= cores) {
    return { line, warning: "" };
  }
  return {
    line,
    warning: `check: WARNING: the load average (${shown}) is above the core count (${cores}), so browser tests may time out at random. A timeout in a file you didn't touch is likely load, not your change.`,
  };
}

export type { Reading };
export { loadReport, osReading };
