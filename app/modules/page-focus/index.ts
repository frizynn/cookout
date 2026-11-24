/**
 * The `page-focus` module: whether the page is visible and its window has
 * focus, the one place the web reads either. `createPageFocus` reads them
 * through an adapter and calls each subscriber when the answer changes, so a
 * view can count time on screen only while someone could be looking (the
 * Inbox's read rule, `docs/adr/0073-the-inbox-reads-a-conversation-after-2-s-on-screen.md`).
 * The browser's adapter is `documentFocusAdapter()`, which reads
 * `document.visibilityState` and `document.hasFocus()` and listens for
 * `visibilitychange`, `focus` and `blur`. Tests in jsdom, whose page never
 * really gains or loses focus, bring their own adapter.
 */

export { type PageFocus, createPageFocus } from "./lib/page-focus.ts";
export { documentFocusAdapter } from "./lib/document.ts";
