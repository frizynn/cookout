import { CookoutError, parseEvent } from "../index.ts";
import { expect, it } from "vitest";

const readPosition = { channel: "general", messageId: 3, thread: 1 };

function thrownBy(parse: () => unknown): unknown {
  try {
    parse();
  } catch (error: unknown) {
    return error;
  }
  return "nothing";
}

it("parseEvent checks an event from the stream against the protocol", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const good = parseEvent({
    data: JSON.stringify({ readPosition, type: "read-position" }),
    event: "read-position",
  });
  const unknown = parseEvent({ data: "{}", event: "from-a-newer-server" });
  const bad = thrownBy(() => parseEvent({ data: JSON.stringify({ type: "message" }), event: "message" }));

  expect([good, unknown]).toStrictEqual([{ readPosition, type: "read-position" }, null]);
  expect(bad).toBeInstanceOf(CookoutError);
  expect(bad).toMatchObject({ code: "bad_response" });
});
