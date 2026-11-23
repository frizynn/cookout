import { expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { openAt } from "./render.tsx";
import { subscribedReader } from "./inbox-reader.ts";

it("an Inbox row of a Markdown message shows its text as one plain line, with mentions still marked", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const channel = "web-inbox-preview";
  const { poster, reader } = await subscribedReader(channel);
  const { message: parent } = await reader.createMessage({
    channel,
    text: "# Plan\n\n**Deploy** per [the notes](https://example.com/notes)",
  });
  await poster.createMessage({
    channel,
    replyTo: parent.id,
    text: `> quoted\n\n- *one* for @${channel}-reader\n- \`two\`\n\nlast\nline  \nend`,
  });
  const unmount = openAt({ client: reader, hash: "#/inbox" });

  const row = await within(await screen.findByRole("list", { name: "For you" })).findByRole("listitem");

  expect([
    within(row).getByText("re: Plan Deploy per the notes").textContent,
    within(row).getByText(`@${channel}-reader`).tagName,
    within(row).getByText(/^quoted one for/u).textContent,
  ]).toStrictEqual(["re: Plan Deploy per the notes", "MARK", `quoted one for @${channel}-reader two last line end`]);

  unmount();
});
