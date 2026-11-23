import { ChoiceGroup, IdentityLink, Panel, ToggleButton } from "../../design-system/index.tsx";
import type { Layout, ThemeChoice } from "../../layout/index.ts";
import { useCallback, useSyncExternalStore } from "react";
import type { Composer } from "../../composer/index.ts";
import { DisplayNames } from "./display-names.tsx";
import type { Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";
import { themeChoices } from "../../layout/index.ts";
import { useListed } from "./use-author.ts";

const TEXT = { settings: "Settings", theme: "Theme" } as const;

const THEMES = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

interface SidebarSettingsProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly layout: Layout;
  readonly open: boolean;
}

function themesOf(value: string): readonly ThemeChoice[] {
  return themeChoices.filter((choice) => choice === value);
}

export function SidebarSettings(props: SidebarSettingsProps): ReactNode {
  const { identity, layout } = props;
  const state = useSyncExternalStore(layout.subscribe, layout.snapshot);
  const listed = useListed(identity.name) ?? identity;
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
          <DisplayNames composer={props.composer} me={identity.name} />
          <ChoiceGroup choices={THEMES} label={TEXT.theme} onChoose={handleChoose} value={state.theme} />
        </Panel>
      )}
      <IdentityLink
        active={props.open}
        agent={identity.kind === "agent"}
        displayName={listed.displayName ?? null}
        href={hrefOf({ identity: identity.name, name: "profile" })}
        name={identity.name}
      />
      <ToggleButton expanded={state.settings} onClick={handleToggle}>
        {TEXT.settings}
      </ToggleButton>
    </>
  );
}
