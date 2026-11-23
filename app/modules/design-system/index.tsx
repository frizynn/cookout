/**
 * The design system: shadcn/ui's components on Tailwind, monospace and dark
 * like Vercel Board. Every view builds from these and none styles itself, so
 * no component takes classes. `styles.css` is the Tailwind theme, which
 * `index.html` loads. `AppShell` is the page around every route; `Card`,
 * `CardHeader`, `Heading` and `Muted` are shadcn's card and its title row,
 * `CardBody` a padded section under it; `BackLink` leads back up a level;
 * `LinkList` and `LinkRow` are a named list of links, and `ItemList` and
 * `ItemRow` a named list of plain rows; `Article` is one named item shown on
 * its own, such as a thread's parent message; `Alert` is a refusal,
 * read out by screen readers; `Skeleton` stands in while something loads.
 * `Form` hands one field's value to `onSubmit` without reloading the page;
 * `TextField` is a labelled secret input in it, such as a token, `TextArea` a
 * labelled box to write in, such as a reply, whose text and caret its owner
 * holds, and `SubmitButton` sends it; `Suggestions` is a named list of options
 * to pick from under a box, such as mentions, which leaves the box focused;
 * `Button` is any other button. `FieldsForm` is a form of several fields,
 * `Select` a labelled pick in it from its `SelectOption`s, `DataArea` a
 * labelled box in it to write JSON in, and `DataBlock` a
 * named block of JSON, such as a message's data.
 */
export { Alert } from "./lib/alert.tsx";
export { AppShell } from "./lib/app-shell.tsx";
export { Article } from "./lib/article.tsx";
export { BackLink } from "./lib/back-link.tsx";
export { Button } from "./lib/button.tsx";
export { Card } from "./lib/card.tsx";
export { CardBody } from "./lib/card-body.tsx";
export { CardHeader } from "./lib/card-header.tsx";
export { DataArea } from "./lib/data-area.tsx";
export { DataBlock } from "./lib/data-block.tsx";
export { FieldsForm } from "./lib/fields-form.tsx";
export { Form } from "./lib/form.tsx";
export { Heading } from "./lib/heading.tsx";
export { ItemList } from "./lib/item-list.tsx";
export { ItemRow } from "./lib/item-row.tsx";
export { LinkList } from "./lib/link-list.tsx";
export { LinkRow } from "./lib/link-row.tsx";
export { Muted } from "./lib/muted.tsx";
export { Select } from "./lib/select.tsx";
export { SelectOption } from "./lib/select-option.tsx";
export { Skeleton } from "./lib/skeleton.tsx";
export { Suggestions } from "./lib/suggestions.tsx";
export { SubmitButton } from "./lib/submit-button.tsx";
export { TextArea } from "./lib/text-area.tsx";
export { TextField } from "./lib/text-field.tsx";
