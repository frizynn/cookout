import { expect, it } from "vitest";
import { inPane, inSidebar } from "./regions.ts";
import { listShows, openLive, posted, postedOne, startersIn, twoThreadsIn } from "./open-threads.ts";
import type { CookoutClient } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";
import { anonymousClient } from "./identities.ts";
import { createLive } from "../../live/index.ts";
import { fireEvent } from "@testing-library/react";
import { openAt } from "./render.tsx";

const NONE = 0;
const ONE = 1;

type Link = ReturnType<Live["link"]>;

interface Cuttable {
  readonly live: Live;
  readonly report: (link: Link) => void;
}

function cuttable(): Cuttable {
  const reports: ((link: Link) => void)[] = [];
  const live = createLive({
    open: (_onEvent, onLink) => {
      reports.push(onLink);
    },
  });
  return {
    live,
    report: (link) => {
      for (const onLink of reports) {
        onLink(link);
      }
    },
  };
}

function refusedAfter(reader: CookoutClient, pages: number): CookoutClient {
  let asked = NONE;
  return {
    ...reader,
    listOpenThreads: async (query) => {
      asked += ONE;
      if (asked > pages) {
        const refused = await anonymousClient().listOpenThreads(query);
        return refused;
      }
      const page = await reader.listOpenThreads(query);
      return page;
    },
  };
}

it("a list the server refuses says so, and a close elsewhere leaves it as it is", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channel, poster, reader, readerName } = await startersIn("open-refused");
  const asked = await postedOne({ by: reader, channel, text: "Refused?" });
  const close = await openLive({ client: refusedAfter(reader, NONE), hash: "#/threads" });
  await inPane().findByText(/^Couldn't load the open threads \(/u);
  await poster.closeThread(asked.id);
  await poster.createMessage({ channel, text: `@${readerName} after the close` });
  await inSidebar().findByRole("link", { name: /^Inbox.*1 for you/u });

  expect(inPane().getByText(/^Couldn't load the open threads \(/u).textContent).toContain("(token_missing)");

  await close();
});

it("a refused Load more says so and keeps the threads shown", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channel, reader } = await startersIn("open-more-refused");
  await posted({ by: reader, channel, texts: ["One.", "Two."] });
  openAt({ client: refusedAfter(reader, ONE), hash: "#/threads", pageSize: 1 });
  await listShows({ channel, texts: ["One."] });
  fireEvent.click(inPane().getByRole("button", { name: "Load more" }));

  await expect(inPane().findByText(/^Couldn't load more \(/u)).resolves.toHaveProperty("tagName", "DIV");

  await listShows({ channel, texts: ["One."] });
});

it("a reply while more pages remain takes its thread out until Load more reaches it", { timeout: 8000 }, async () => {
  expect.hasAssertions();

  const { channel, first, poster, reader } = await twoThreadsIn({ channel: "open-reply-paged", more: ["Third."] });
  const elsewhere = await postedOne({ by: poster, channel, text: "Elsewhere." });
  const close = await openLive({ client: reader, hash: "#/threads", pageSize: 2 });
  await listShows({ channel, texts: ["First.", "Second."] });
  await Promise.all([
    poster.createMessage({ channel, replyTo: elsewhere.id, text: "Not yours." }),
    poster.createMessage({ channel, replyTo: first.id, text: "Bump." }),
  ]);

  await listShows({ channel, texts: ["Second."] });

  fireEvent.click(inPane().getByRole("button", { name: "Load more" }));

  await listShows({ channel, texts: ["Second.", "Third.", "First."] });

  await close();
});

it("the list reloads when the live link comes back", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { channel, reader } = await startersIn("open-back");
  await posted({ by: reader, channel, texts: ["One."] });
  const { live, report } = cuttable();
  openAt({ client: reader, hash: "#/threads", live });
  await listShows({ channel, texts: ["One."] });
  await posted({ by: reader, channel, texts: ["Two."] });
  report("down");
  report("up");

  await listShows({ channel, texts: ["One.", "Two."] });
});
