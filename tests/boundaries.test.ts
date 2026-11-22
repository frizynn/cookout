// Proves the boundary rules in .dependency-cruiser.cjs hold, the way a
// contributor would hit them: drop a file into a real package, run the same
// `depcruise` command `pnpm check` runs, and read the violations it reports.
import { afterEach, describe, expect, it } from "vitest";
import { probeImports, removeProbes } from "./probe.ts";

afterEach(removeProbes);

describe("SQLite drivers", () => {
  it.each(["server", "client", "web", "protocol", "storage-memory", "cookout"])(
    "refuses node:sqlite and better-sqlite3 in %s",
    async (pkg) => {
      const result = await probeImports(pkg, "src/probe.ts", [
        "node:sqlite",
        "better-sqlite3",
      ]);
      expect(result.exitCode).not.toBe(0);
      expect(result.violations).toEqual([
        { rule: "sqlite-only-in-storage-sqlite", to: "better-sqlite3" },
        { rule: "sqlite-only-in-storage-sqlite", to: "node:sqlite" },
      ]);
    },
  );

  it("allows node:sqlite and better-sqlite3 in storage-sqlite", async () => {
    const result = await probeImports("storage-sqlite", "src/probe.ts", [
      "node:sqlite",
      "better-sqlite3",
    ]);
    expect(result.violations).toEqual([]);
    expect(result.exitCode).toBe(0);
  });
});

describe("storage adapters", () => {
  it.each(["server", "client", "web"])(
    "refuses a storage package in %s",
    async (pkg) => {
      const result = await probeImports(pkg, "src/probe.ts", [
        "@ai-hero/cookout-storage-sqlite",
        "@ai-hero/cookout-storage-memory",
      ]);
      expect(result.exitCode).not.toBe(0);
      // `to` is a path or the bare name, depending on whether the package
      // is already a dependency, so compare the rules only.
      expect(result.violations.map((v) => v.rule)).toEqual([
        "no-storage-outside-start-up",
        "no-storage-outside-start-up",
      ]);
    },
  );

  it.each(["server", "client", "web"])(
    "allows a storage package in a test file in %s",
    async (pkg) => {
      const result = await probeImports(pkg, "tests/probe.test.ts", [
        "@ai-hero/cookout-storage-memory",
      ]);
      expect(result.violations).toEqual([]);
      expect(result.exitCode).toBe(0);
    },
  );

  it("allows storage packages in the server's start-up entry point", async () => {
    const result = await probeImports("server", "src/start.ts", [
      "@ai-hero/cookout-storage-sqlite",
    ]);
    expect(result.violations).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("allows storage packages in the published cookout package", async () => {
    const result = await probeImports("cookout", "src/probe.ts", [
      "@ai-hero/cookout-storage-sqlite",
    ]);
    expect(result.violations).toEqual([]);
    expect(result.exitCode).toBe(0);
  });
});

describe("server", () => {
  it.each(["client", "web"])("refuses the server in %s", async (pkg) => {
    const result = await probeImports(pkg, "src/probe.ts", [
      "@ai-hero/cookout-server",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.violations.map((v) => v.rule)).toEqual([
      "no-server-in-client-or-web",
    ]);
  });

  it.each(["client", "web"])(
    "refuses the server in a test file in %s",
    async (pkg) => {
      const result = await probeImports(pkg, "tests/probe.test.ts", [
        "@ai-hero/cookout-server",
      ]);
      expect(result.exitCode).not.toBe(0);
      expect(result.violations.map((v) => v.rule)).toEqual([
        "no-server-in-client-or-web",
      ]);
    },
  );

  it("refuses the server in client by relative path too", async () => {
    const result = await probeImports("client", "src/probe.ts", [
      "../../server/src/index.ts",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.violations.map((v) => v.rule)).toEqual([
      "import-packages-by-name",
      "no-server-in-client-or-web",
    ]);
  });
});

describe("entry points", () => {
  it("refuses a relative import of another package's internal file", async () => {
    await probeImports("protocol", "src/internal.ts", []);
    const result = await probeImports("server", "src/probe.ts", [
      "../../protocol/src/internal.ts",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.violations).toEqual([
      {
        rule: "only-through-entry-points",
        to: "packages/protocol/src/internal.ts",
      },
    ]);
  });

  it("refuses a deep import of another package by name", async () => {
    await probeImports("protocol", "src/internal.ts", []);
    const result = await probeImports("server", "src/probe.ts", [
      "@ai-hero/cookout-protocol/src/internal.ts",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.violations.map((v) => v.rule)).toEqual([
      "only-through-entry-points",
    ]);
  });

  it("refuses a relative import of another package's entry file", async () => {
    const result = await probeImports("server", "src/probe.ts", [
      "../../protocol/src/index.ts",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.violations).toEqual([
      { rule: "import-packages-by-name", to: "packages/protocol/src/index.ts" },
    ]);
  });

  it("refuses a test importing its own package's internals", async () => {
    await probeImports("server", "src/internal.ts", []);
    const result = await probeImports("server", "tests/probe.test.ts", [
      "../src/internal.ts",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.violations).toEqual([
      { rule: "tests-through-entry-points", to: "packages/server/src/internal.ts" },
    ]);
  });

  it("allows a package's own files to import each other", async () => {
    await probeImports("server", "src/internal.ts", []);
    const result = await probeImports("server", "src/probe.ts", [
      "./internal.ts",
    ]);
    expect(result.violations).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("allows another package through its name", async () => {
    const result = await probeImports("server", "src/probe.ts", [
      "@ai-hero/cookout-protocol",
    ]);
    expect(result.violations).toEqual([]);
    expect(result.exitCode).toBe(0);
  });
});

describe("cycles", () => {
  it("refuses a cycle inside a package", async () => {
    await probeImports("server", "src/a.ts", ["./b.ts"]);
    const result = await probeImports("server", "src/b.ts", ["./a.ts"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.violations.map((v) => v.rule)).toContain("no-cycles");
  });
});
