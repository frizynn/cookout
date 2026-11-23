import { screen, waitFor } from "@testing-library/react";

export async function alertSaying(start: string): Promise<HTMLElement> {
  const said = await waitFor(() => {
    for (const alert of screen.getAllByRole("alert")) {
      if (alert.textContent.startsWith(start)) {
        return alert;
      }
    }
    throw new Error(`No alert says ${start}`);
  });
  return said;
}

export function alertsShown(): readonly string[] {
  const shown: string[] = [];
  for (const alert of screen.queryAllByRole("alert")) {
    shown.push(alert.textContent);
  }
  return shown;
}
