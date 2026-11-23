import { fireEvent, screen } from "@testing-library/react";

const MAIN_BUTTON = 0;

export function pressed(button: () => HTMLElement): void {
  fireEvent.pointerDown(button(), { button: MAIN_BUTTON, ctrlKey: false });
}

export async function chose(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}
