import { expect, it } from "vitest";
import { screen } from "@testing-library/react";

it("looks a button up across the whole page", () => {
  expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
});
