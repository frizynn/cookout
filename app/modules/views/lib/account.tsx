import { Author, ChoiceGroup, Panel, ToggleButton } from "../../design-system/index.tsx";
import type { Layout, ThemeChoice } from "../../layout/index.ts";
import { useCallback, useSyncExternalStore } from "react";
import type { Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { themeChoices } from "../../layout/index.ts";

const TEXT = { settings: "Settings", theme: "Theme" } as const;

const THEMES = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

interface AccountProps {
  readonly identity: Identity;
  readonly layout: Layout;
}

function themesOf(value: string): readonly ThemeChoice[] {
  return themeChoices.filter((choice) => choice === value);
}

export function Account(props: AccountProps): ReactNode {
  const { identity, layout } = props;
  const state = useSyncExternalStore(layout.subscribe, layout.snapshot);
  const handleToggle = layout.toggleSettings;
  const handleChoose = useCallback(
    (value: string) => {
      for (const theme of themesOf(value)) {
        layout.chooseTheme(theme);
      }
    },
    [layout],
  );
  return (
    <>
      {state.settings && (
        <Panel label={TEXT.settings}>
          <ChoiceGroup choices={THEMES} label={TEXT.theme} onChoose={handleChoose} value={state.theme} />
        </Panel>
      )}
      <Author agent={identity.kind === "agent"} name={identity.name} shown={identity.name} />
      <ToggleButton expanded={state.settings} onClick={handleToggle}>
        {TEXT.settings}
      </ToggleButton>
    </>
  );
}
