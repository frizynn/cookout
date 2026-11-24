import { screen, within } from "@testing-library/react";

function articleText(article: () => HTMLElement): string {
  const copy = article().cloneNode(true);
  if (!(copy instanceof HTMLElement)) {
    return "";
  }
  for (const hidden of copy.querySelectorAll("time")) {
    hidden.remove();
  }
  for (const action of [
    ...within(copy).queryAllByRole("link", { name: "Reply" }),
    ...within(copy).queryAllByRole("button", { name: "Reply" }),
    ...within(copy).queryAllByRole("button", { name: /^(?:Close|Reopen) thread$/u }),
  ]) {
    action.remove();
  }
  return copy.textContent;
}

export async function streamOf(label: string): Promise<readonly string[]> {
  const list = await screen.findByRole("list", { name: label });
  const shown: string[] = [];
  for (const item of within(list).queryAllByRole("listitem")) {
    for (const line of within(item).queryAllByRole("separator")) {
      shown.push(`[${String(line.getAttribute("aria-label"))}]`);
    }
    shown.push(articleText(() => within(item).getByRole("article")));
  }
  return shown;
}

export async function messagesIn(label: string): Promise<readonly string[]> {
  const shown = await streamOf(label);
  return shown.filter((row) => !row.startsWith("["));
}

export async function parentShown(): Promise<string> {
  await screen.findByRole("article", { name: "Parent message" });
  return articleText(() => screen.getByRole("article", { name: "Parent message" }));
}
