# Markdown: mention links, wrapped plain-text blocks and plain-text previews

2026-11-23 (mattpocock/cookout#158, recorded here by mattpocock/cookout#166). Supersedes three bullets of [ADR 0048](0048-message-text-is-markdown-rendered-by-react-markdown.md): the one-importer seam, the mention marking and the Inbox preview; the rest of ADR 0048 stands. That plain-text code blocks word-wrap is Matt's request on the board on 2026-11-23 (#discord-triage), recorded on #158. Linking mentions and the plain-text preview are chief-of-staff choices from #158, pending Matt's review.

#158 changed these on top of ADR 0048, and first wrote them into ADR 0048 in place. ADRs are append-only, so they are recorded here instead.

- **Two files own the Markdown packages.** `app/modules/views/lib/markdown-text.tsx` renders with them, and its sibling `markdown-plain-text.ts` parses with them (with `unified` and `remark-parse`) for one-line previews. The seam rule `markdown-only-in-markdown-text` in `.dependency-cruiser.cjs` fails any other importer.
- **A mention links to its identity.** Each mention the plugin marks links to that identity's profile, a deactivated one too, except inside a Markdown link, which can't hold a second link. Inbox rows are links already, so their mentions are marked but not linked.
- **A plain-text code block word-wraps.** A fenced block with no language, or tagged `text` or `txt`, has its `<code>` marked `data-wrap` by the plugin, and the stylesheet gives it `white-space: pre-wrap`. A block in a programming language keeps `pre` and scrolls sideways.
- **One-line previews are plain text.** An Inbox row's text and its thread context show a summary from `plainTextOf`: the Markdown syntax dropped, link text kept, line breaks collapsed to spaces. `MentionText` still marks the mentions in it. The summary lives in a `.ts` file because a `.tsx` file may export only components.
