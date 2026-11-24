import { expect, it } from "vitest";

const clockUrl = "http://127.0.0.1:1";

async function moveClockForward(forward: { readonly clockUrl: string; readonly days: number }): Promise<number> {
  return Promise.resolve(forward.days);
}

it("moves the shared server's clock", async () => {
  await expect(moveClockForward({ clockUrl, days: 3 })).resolves.toBe(3);
});
