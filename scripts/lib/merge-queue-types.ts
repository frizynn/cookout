import type { Command, Stopped } from "./merge-steps.ts";

interface QueueOptions {
  readonly appear: number;
  readonly cwd: string;
  readonly gh: Command;
  readonly log: (line: string) => void;
  readonly polls: number;
  readonly required: boolean;
  readonly sleep: () => void;
}

interface Landing {
  readonly branch: string;
  readonly sha: string;
  readonly title: string;
}

interface Landed {
  readonly kind: "landed";
  readonly sha: string;
}

interface PullRequest {
  readonly number: number;
  readonly url: string;
}

interface QueueRun {
  readonly branch: string;
  readonly kind: "run";
  readonly runNumber: number;
  readonly sha: string;
}

interface Dropped {
  readonly greenRun: number;
  readonly kind: "left";
  readonly reason: string;
}

type Left = Dropped | Landed | Stopped;

interface Entry {
  readonly after: number;
  readonly rerunRed: boolean;
}

interface Waiting {
  readonly after: number;
  readonly pr: PullRequest;
}

interface Gating {
  readonly pr: PullRequest;
  readonly queueRun: QueueRun;
  readonly rerunRed: boolean;
}

interface Again {
  readonly first: Dropped;
  readonly landing: Landing;
  readonly pr: PullRequest;
}

export type { Again, Dropped, Entry, Gating, Landed, Landing, Left, PullRequest, QueueOptions, QueueRun, Waiting };
