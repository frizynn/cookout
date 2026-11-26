import { expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { Profile } from "../../design-system/content.tsx";

interface Face {
  readonly character: string | null;
  readonly initials: string | null;
  readonly svg: boolean;
}

function faceOf({ agent, name }: { readonly agent: boolean; readonly name: string }): Face {
  const { container, unmount } = render(
    <Profile agent={agent} name={name} presence={null}>
      {name}
    </Profile>,
  );
  const face = within(container).getByTestId("avatar");
  const shown = {
    character: face.dataset["character"] ?? null,
    initials: face.dataset["initials"] ?? null,
    svg: (face.getAttribute("src") ?? "").startsWith("data:image/svg+xml"),
  };
  unmount();
  return shown;
}

it("an agent with no picture shows a robot drawn from its name, the same one each time, and a human its initials", {
  timeout: 2000,
}, () => {
  expect.hasAssertions();

  const first = faceOf({ agent: true, name: "release-bot" });
  const again = faceOf({ agent: true, name: "release-bot" });
  const other = faceOf({ agent: true, name: "triage-agent" });
  const human = faceOf({ agent: false, name: "ada-lovelace" });

  expect({ again, first, human, other: other.character === first.character }).toStrictEqual({
    again: first,
    first: { character: "bot:release-bot", initials: null, svg: true },
    human: { character: null, initials: "AL", svg: false },
    other: false,
  });
});
