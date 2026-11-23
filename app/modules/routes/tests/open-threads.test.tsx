import {
  closeIn,
  involvedIn,
  listShows,
  openLive,
  openThreadsShown,
  posted,
  postedOne,
  startersIn,
  twoThreadsIn,
} from "./open-threads.ts";
import { expect, it } from "vitest";
import { inPane, inSidebar } from "./regions.ts";
import { fireEvent } from "@testing-library/react";
import { openAt } from "./render.tsx";

it("the page lists the reader's open threads stalest first; one the reader isn't in shows only under All", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { channel, reader, readerName } = await involvedIn("open-list");
  openAt({ client: reader, hash: "#/threads" });

  await listShows({ channel, texts: [`@${readerName} can you look?`, "My own question.", "Deploy at noon?"] });

  expect([
    inPane().getByRole("link", { name: "Involving me" }).getAttribute("aria-current"),
    inSidebar().getByRole("link", { name: "Open threads" }).getAttribute("aria-current"),
  ]).toStrictEqual(["page", "page"]);

  fireEvent.click(inPane().getByRole("link", { name: "All" }));

  await listShows({
    channel,
    texts: [`@${readerName} can you look?`, "Nobody asked you.", "My own question.", "Deploy at noon?"],
  });
});

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

it("a close by another identity drops a row live, and a reopen brings it back at the end", {
  timeout: 8000,
}, async () => {
  expect.hasAssertions();

  const { channel, first, poster, reader } = await twoThreadsIn("open-live");
  const close = await openLive({ client: reader, hash: "#/threads" });
  await listShows({ channel, texts: ["First.", "Second."] });
  await poster.closeThread(first.id);

  await listShows({ channel, texts: ["Second."] });

  await poster.reopenThread(first.id);

  await listShows({ channel, texts: ["Second.", "First."] });

  await close();
});

it("a reply by another identity moves its thread to the end of the list live", { timeout: 8000 }, async () => {
  expect.hasAssertions();

  const { channel, first, poster, reader } = await twoThreadsIn("open-live-reply");
  const close = await openLive({ client: reader, hash: "#/threads" });
  await listShows({ channel, texts: ["First.", "Second."] });
  await poster.createMessage({ channel, replyTo: first.id, text: "Bump." });

  await listShows({ channel, texts: ["Second.", "First."] });

  await close();
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
