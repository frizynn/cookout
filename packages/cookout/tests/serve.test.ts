import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import { createCookoutClient } from "@ai-hero/cookout-client";
import { freshFolder, startServeProcess } from "./processes.ts";

const adminTokenLine = z.object({ adminToken: z.string(), identity: z.literal("admin") });

function adminTokensIn(lines: unknown[]): string[] {
  return lines.flatMap((line) => {
    const parsed = adminTokenLine.safeParse(line);
    return parsed.success ? [parsed.data.adminToken] : [];
  });
}

it("cookout serve prints the admin token on the first boot only", async () => {
  const databasePath = join(await freshFolder(), "cookout.db");

  const first = await startServeProcess(databasePath);
  const [adminToken, ...more] = adminTokensIn(first.lines);
  expect(more).toEqual([]);
  if (adminToken === undefined) throw new Error("The first boot printed no admin token.");
  await first.stop();

  const second = await startServeProcess(databasePath);
  expect(adminTokensIn(second.lines)).toEqual([]);
  expect(JSON.stringify(second.lines)).not.toContain(adminToken);

  const admin = createCookoutClient({ url: second.url, token: adminToken, env: {} });
  expect((await admin.whoami()).identity).toMatchObject({ name: "admin", admin: true });
});

it("the database never holds a token itself", async () => {
  const folder = await freshFolder();
  const server = await startServeProcess(join(folder, "cookout.db"));
  const [adminToken] = adminTokensIn(server.lines);
  if (adminToken === undefined) throw new Error("The first boot printed no admin token.");
  const admin = createCookoutClient({ url: server.url, token: adminToken, env: {} });
  const { token } = await admin.createIdentity({ name: "agent", owner: "matt" });
  await admin.rotateToken("agent");
  await server.stop();

  const files = await readdir(folder);
  expect(files).toContain("cookout.db");
  for (const file of files) {
    const bytes = await readFile(join(folder, file), "latin1");
    expect(bytes).not.toContain(adminToken);
    expect(bytes).not.toContain(token);
  }
});
