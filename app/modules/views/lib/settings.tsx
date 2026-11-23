import { Page, Pane, PaneHeader } from "../../design-system/index.tsx";
import type { Composer } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import type { Layout } from "../../layout/index.ts";
import type { ReactNode } from "react";
import type { SettingsSection } from "../../paths/index.ts";
import { SettingsSections } from "./settings-sections.tsx";

const TEXT = { description: "Your profile, the theme and your agents", title: "Settings" } as const;

interface SettingsProps {
  readonly composer: Composer;
  readonly layout: Layout;
  readonly me: IdentityName;
  readonly section: SettingsSection | null;
}

export function SettingsView(props: SettingsProps): ReactNode {
  return (
    <Pane>
      <PaneHeader description={TEXT.description} sans title={TEXT.title} />
      <Page label={TEXT.title}>
        <SettingsSections composer={props.composer} layout={props.layout} me={props.me} section={props.section} />
      </Page>
    </Pane>
  );
}
