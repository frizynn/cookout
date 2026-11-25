import { choiceLines, chooseReleaseCommit, mainAhead, releaseChoice } from "../lib/release-commit.ts";
import { expect, it } from "vitest";
import type { Outcome } from "../lib/tools.ts";

const [NEWEST, RUNNING, RED, GREEN, OLDER] = ["aaaa1111", "bbbb2222", "cccc3333", "dddd4444", "eeee5555"];
const URL = "https://github.com/o/r/actions/runs/";

interface Stub {
  readonly conclusion: string;
  readonly sha: string;
  readonly status: string;
}

function run({ conclusion, sha, status }: Stub): {
  readonly conclusion: string;
  readonly headSha: string;
  readonly status: string;
  readonly url: string;
} {
  return { conclusion, headSha: sha, status, url: `${URL}${sha}` };
}

function done(sha: string, conclusion: string): ReturnType<typeof run> {
  return run({ conclusion, sha, status: "completed" });
}

function v1History(args: readonly string[]): Outcome<string> {
  if (args.includes("rev-list")) {
    return { ok: true, value: `${RED}\n${GREEN}\n` };
  }
  return { ok: true, value: "" };
}

it("picks the newest green v1 commit over a newer red one and a newer one still running", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const choice = chooseReleaseCommit({
    commits: [NEWEST, RUNNING, RED, GREEN, OLDER],
    runs: [
      done(NEWEST, "cancelled"),
      run({ conclusion: "", sha: RUNNING, status: "in_progress" }),
      done(RED, "failure"),
      done(GREEN, "failure"),
      done(GREEN, "success"),
      done(OLDER, "success"),
    ],
  });

  expect(choiceLines(choice)).toStrictEqual([
    `skipped ${NEWEST}: its Check runs were all cancelled (${URL}${NEWEST})`,
    `skipped ${RUNNING}: its Check run is still running (${URL}${RUNNING})`,
    `skipped ${RED}: its Check run is red (${URL}${RED})`,
    `chose ${GREEN}: its Check run is green (${URL}${GREEN})`,
  ]);
  expect(choice.chosen).toStrictEqual({ sha: GREEN, url: `${URL}${GREEN}` });
});

it("picks nothing, and says so, when no v1 commit has a green Check run", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const choice = chooseReleaseCommit({ commits: [NEWEST, RED], runs: [done(RED, "failure")] });

  expect(choiceLines(choice)).toStrictEqual([
    `skipped ${NEWEST}: it has no Check push run`,
    `skipped ${RED}: its Check run is red (${URL}${RED})`,
    "chose nothing: none of the newest 2 v1 commits has a green Check run",
  ]);
  expect(choice.chosen).toBeNull();
});

it("refuses to release when main has commits v1 lacks, naming them", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const refused: Outcome<string> = mainAhead({ ahead: ["1234abcd Version Packages", "5678ef01 a hotfix"], sha: GREEN });

  expect([refused, mainAhead({ ahead: [], sha: GREEN })]).toStrictEqual([
    {
      ok: false,
      reason: `main has 2 commits ${GREEN} lacks, so it can't fast-forward to it. Merge them into v1 first:\n1234abcd Version Packages\n5678ef01 a hotfix`,
    },
    { ok: true, value: GREEN },
  ]);
});

it("chooses through the gh and git seams, refusing when gh can't list the Check runs", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const listing = JSON.stringify([done(GREEN, "success")]);
  const chosen = releaseChoice({
    gh: () => ({ ok: true, value: listing }),
    git: v1History,
  });
  const offline = releaseChoice({
    gh: () => ({ ok: false, reason: "gh run list failed: offline" }),
    git: () => ({ ok: true, value: GREEN }),
  });

  expect([chosen, offline]).toStrictEqual([
    {
      lines: [`skipped ${RED}: it has no Check push run`, `chose ${GREEN}: its Check run is green (${URL}${GREEN})`],
      outcome: { ok: true, value: GREEN },
    },
    { lines: [], outcome: { ok: false, reason: "gh run list failed: offline" } },
  ]);
});
