# Message text is Markdown, rendered by react-markdown

2026-11-23 (mattpocock/cookout#151). Matt asked for it on the board on 2026-11-23: messages should behave like Slack, but with Markdown syntax.

The web UI renders a message's text as GitHub-flavoured Markdown with [react-markdown](https://github.com/remarkjs/react-markdown) 10, [remark-gfm](https://github.com/remarkjs/remark-gfm) 4 (bare URLs, strikethrough, tables) and [remark-breaks](https://github.com/remarkjs/remark-breaks) 4 (every newline is a line break). They are maintained by the unified collective, are ESM, and render to React elements, so nothing goes through `dangerouslySetInnerHTML`.

- `app/modules/views/lib/markdown-text.tsx` is the one file that renders with them, and its sibling `markdown-plain-text.ts` the one that parses with them (with `unified` and `remark-parse`) for one-line previews; the seam rule `markdown-only-in-markdown-text` in `.dependency-cruiser.cjs` fails any other importer.
- Raw HTML is shown as text: a small remark plugin (`markdown-tree.ts`) turns every `html` node into a text node, wrapped in a paragraph at block level. react-markdown's default URL transform drops `javascript:` and other unsafe links.
- The same plugin marks the message's @-mentions (only names in `message.mentions`, as before) in text nodes, so a mention inside bold or a link is marked and one in code is not. Each marked mention links to that identity's profile, a deactivated one too, except inside a Markdown link, which can't hold a second link (mattpocock/cookout#158). Inbox rows are links already, so their mentions are marked but not linked. `#channel` references had no rendering of their own and still don't.
- A fenced code block of plain text (no language, or `text` or `txt`) word-wraps: the plugin marks its `<code>` with `data-wrap` and the stylesheet gives it `white-space: pre-wrap` (Matt, 2026-11-23, mattpocock/cookout#158). A block in a programming language keeps `pre` and scrolls sideways.
- Headings render as bold lines. Links open in a new tab with `rel="noopener noreferrer"`.
- One-line previews (an Inbox row's text and its thread context) show a plain-text summary: `plainTextOf` drops the Markdown syntax, keeps link text, and collapses line breaks to spaces (mattpocock/cookout#158). `MentionText` still marks the mentions in it. The summary lives in a `.ts` file because a `.tsx` file may export only components.
- The packages are `devDependencies`, like React: Vite bundles them into the web assets, and the server bundle (`app/main.ts`) and the SDK never import them.

## Considered options

- markdown-to-jsx: one package with no dependencies, but no line-break mode, its own HTML handling to audit, and no plugin seam for mentions.
- marked or markdown-it with a sanitiser: renders an HTML string, so it needs `dangerouslySetInnerHTML` and a sanitiser to get right.
