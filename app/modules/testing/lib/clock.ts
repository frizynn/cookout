import { clockForwardPath } from "../../http/index.ts";
import { request } from "../../http/client.ts";

interface ClockForward {
  readonly clockUrl: string;
  readonly days: number;
}

async function moveClockForward({ clockUrl, days }: ClockForward): Promise<void> {
  const answer = await request({ baseUrl: clockUrl, body: { days }, method: "POST", path: clockForwardPath });
  if (!answer.ok) {
    throw new Error(`the dev cookout's clock did not move forward: ${String(answer.status)} ${answer.text}`);
  }
}

export { type ClockForward, moveClockForward };
