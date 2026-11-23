import { adminClient, newIdentity } from "./identities.ts";
import { expect, it } from "vitest";
import { inPane } from "./regions.ts";
import { openAt } from "./render.tsx";

const LONG_LINE_WORDS = 60;

interface Shown {
  readonly texts: (selector: string) => readonly string[];
  readonly attributes: (selector: string, names: readonly string[]) => readonly (string | null)[];
  readonly close: () => void;
}

function shownOf(body: () => Element, close: () => void): Shown {
  return {
    attributes: (selector, names) => {
      const found = body().querySelector(selector);
      if (found === null) {
        return [];
      }
      return names.map((name) => found.getAttribute(name));
    },
    close,
    texts: (selector) => {
      const texts: string[] = [];
      for (const element of body().querySelectorAll(selector)) {
        texts.push(element.textContent);
      }
      return texts;
    },
  };
}

async function shownMessage(channel: string, text: string, seen: string): Promise<Shown> {
  const reader = await newIdentity({ kind: "human", name: `${channel}-reader` });
  await adminClient().createChannel({ name: channel });
  await adminClient().createMessage({ channel, text });
  const close = openAt({ client: reader.client, hash: `#/channels/${channel}` });
  const found = await inPane().findByText(seen);
  const body = found.closest("article");
  if (body === null) {
    throw new Error("The message is not in an article.");
  }
  return shownOf(() => body, close);
}

it("a bare URL in a message becomes a link that opens in a new tab", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const url = "https://github.com/mattpocock/cookout/issues/150";
  const shown = await shownMessage("web-md-url", `See ${url} please`, url);

  expect([shown.texts("p a"), shown.attributes("p a", ["href", "target", "rel"])]).toStrictEqual([
    [url],
    [url, "_blank", "noopener noreferrer"],
  ]);

  shown.close();
});

it("every newline in a message is a line break", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const shown = await shownMessage("web-md-breaks", "First line\nSecond line", "First line Second line");

  expect([shown.texts("p br"), shown.texts("p")]).toStrictEqual([[""], ["First line\nSecond line"]]);

  shown.close();
});

it("bold, inline code and a fenced code block render as formatting", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const shown = await shownMessage("web-md-format", "**loud** and `quiet`\n\n```\nconst done = true;\n```", "loud");

  expect([shown.texts("strong"), shown.texts("p code"), shown.texts("pre code")]).toStrictEqual([
    ["loud"],
    ["quiet"],
    ["const done = true;\n"],
  ]);

  shown.close();
});

it("a mention of me still shows marked inside formatting, but not inside code", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const shown = await shownMessage(
    "web-md-mention",
    "**ask @web-md-mention-reader** or `@web-md-mention-reader`",
    "ask",
  );

  expect([shown.texts("strong mark"), shown.texts("code"), shown.texts("code mark")]).toStrictEqual([
    ["@web-md-mention-reader"],
    ["@web-md-mention-reader"],
    [],
  ]);

  shown.close();
});

it("raw HTML in a message shows as text and a javascript: link does not link", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const shown = await shownMessage(
    "web-md-html",
    '<script>alert(1)</script>\n\nLook <img src="x" onerror="alert(2)"> [click](javascript:alert(3))',
    "<script>alert(1)</script>",
  );

  expect([shown.texts("script, img"), shown.texts("p"), shown.attributes("p a", ["href"])]).toStrictEqual([
    [],
    ["<script>alert(1)</script>", 'Look <img src="x" onerror="alert(2)"> click'],
    [""],
  ]);

  shown.close();
});

it("a long line in a plain-text code block wraps, and one in a ts block does not", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const long = Array.from({ length: LONG_LINE_WORDS }, () => "word").join(" ");
  const fence = "```";
  const text = [
    "Code blocks:",
    `${fence}\n${long}\n${fence}`,
    `${fence}text\n${long}\n${fence}`,
    `${fence}txt\n${long}\n${fence}`,
    `${fence}ts\nconst value = "${long}";\n${fence}`,
  ].join("\n\n");
  const shown = await shownMessage("web-md-wrap", text, "Code blocks:");

  expect([shown.texts("pre code[data-wrap]"), shown.texts("pre code:not([data-wrap])")]).toStrictEqual([
    [`${long}\n`, `${long}\n`, `${long}\n`],
    [`const value = "${long}";\n`],
  ]);

  shown.close();
});
