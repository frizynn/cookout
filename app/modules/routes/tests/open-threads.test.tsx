import { closeIn, listShows, openThreadsShown, posted, postedOne, startersIn } from "./open-threads.ts";
import { expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

it("a row links to its thread with its starter and first line, and Close in it drops the row", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { channel, poster, reader } = await startersIn("open-close");
  const first = await postedOne({ by: poster, channel, text: "Close me.\nThe second line." });
  await posted({ by: reader, channel, texts: ["Keep me."] });
  openAt({ client: reader, hash: "#/threads/all" });

  await expect(openThreadsShown(channel)).resolves.toContain(
    `#/channels/${channel}/threads/${String(first.id)} quiet for under a minute${channel}-ada` +
      `started a thread in#${channel}Close me.Close`,
  );

  fireEvent.click(closeIn("Close me."));

  await listShows({ channel, texts: ["Keep me."] });
  const { parent } = await poster.getThread(first.id);

  expect(parent.closedBy).toBe(`${channel}-grace`);
});

it("load more appends the next page of open threads", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channel, reader } = await startersIn("open-more");
  await posted({ by: reader, channel, texts: ["One.", "Two.", "Three."] });
  openAt({ client: reader, hash: "#/threads", pageSize: 2 });
  await listShows({ channel, texts: ["One.", "Two."] });
  fireEvent.click(inPane().getByRole("button", { name: "Load more" }));

  await listShows({ channel, texts: ["One.", "Two.", "Three."] });

  expect(inPane().queryByRole("button", { name: /^Load/u })).toBeNull();
});

it("an empty list says there are no open threads", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { reader } = await startersIn("open-empty");
  openAt({ client: reader, hash: "#/threads" });

  await expect(inPane().findByText("No open threads.")).resolves.toHaveProperty("tagName", "P");
});
