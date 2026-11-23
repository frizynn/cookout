/**
 * The design system: shadcn/ui's components on Tailwind, monospace and dark
 * like Vercel Board. Every view builds from these and none styles itself, so
 * no component takes classes. `styles.css` is the Tailwind theme, which
 * `index.html` loads. `AppShell` is the page around every route; `Card`,
 * `CardHeader`, `Heading` and `Muted` are shadcn's card and its title row;
 * `LinkList` and `LinkRow` are a named list of links; `Alert` is a refusal,
 * read out by screen readers; `Skeleton` stands in while something loads.
 */
export { Alert } from "./lib/alert.tsx";
export { AppShell } from "./lib/app-shell.tsx";
export { Card } from "./lib/card.tsx";
export { CardHeader } from "./lib/card-header.tsx";
export { Heading } from "./lib/heading.tsx";
export { LinkList } from "./lib/link-list.tsx";
export { LinkRow } from "./lib/link-row.tsx";
export { Muted } from "./lib/muted.tsx";
export { Skeleton } from "./lib/skeleton.tsx";
