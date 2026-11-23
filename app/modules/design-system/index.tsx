/**
 * The design system: shadcn/ui's components on Tailwind, monospace and dark
 * like Vercel Board. Every view builds from these and none styles itself, so
 * no component takes classes. `styles.css` is the Tailwind theme, which
 * `index.html` loads. `AppShell` is the page around every route; `Card`,
 * `CardHeader`, `Heading` and `Muted` are shadcn's card and its title row,
 * `CardBody` a padded section under it;
 * `LinkList` and `LinkRow` are a named list of links; `Alert` is a refusal,
 * read out by screen readers; `Skeleton` stands in while something loads.
 * `Form` hands one field's value to `onSubmit` without reloading the page;
 * `TextField` is a labelled secret input in it, such as a token, and
 * `SubmitButton` sends it; `Button` is any other button.
 */
export { Alert } from "./lib/alert.tsx";
export { AppShell } from "./lib/app-shell.tsx";
export { Button } from "./lib/button.tsx";
export { Card } from "./lib/card.tsx";
export { CardBody } from "./lib/card-body.tsx";
export { CardHeader } from "./lib/card-header.tsx";
export { Form } from "./lib/form.tsx";
export { Heading } from "./lib/heading.tsx";
export { LinkList } from "./lib/link-list.tsx";
export { LinkRow } from "./lib/link-row.tsx";
export { Muted } from "./lib/muted.tsx";
export { Skeleton } from "./lib/skeleton.tsx";
export { SubmitButton } from "./lib/submit-button.tsx";
export { TextField } from "./lib/text-field.tsx";
