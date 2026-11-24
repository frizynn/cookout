import type { Composer } from "../../composer/index.ts";
import { DisplayNames } from "./display-names.tsx";
import type { IdentityName } from "../../sdk/index.ts";
import type { Layout } from "../../layout/index.ts";
import { MyAgents } from "./my-agents.tsx";
import { PageSection } from "../../design-system/layout.tsx";
import type { ReactNode } from "react";
import type { SettingsSection } from "../../paths/index.ts";
import { ThemeChoice } from "./theme-choice.tsx";
import { hrefOf } from "../../paths/index.ts";

const TEXT = { agents: "My agents", profile: "Profile", theme: "Theme" } as const;

interface SettingsSectionsProps {
  readonly composer: Composer;
  readonly layout: Layout;
  readonly me: IdentityName;
  readonly section: SettingsSection | null;
}

export function SettingsSections(props: SettingsSectionsProps): ReactNode {
  const { composer, me, section } = props;
  return (
    <>
      <PageSection
        focused={section === "profile"}
        href={hrefOf({ name: "settings", section: "profile" })}
        label={TEXT.profile}
      >
        <DisplayNames composer={composer} me={me} />
      </PageSection>
      <PageSection
        focused={section === "theme"}
        href={hrefOf({ name: "settings", section: "theme" })}
        label={TEXT.theme}
      >
        <ThemeChoice layout={props.layout} />
      </PageSection>
      <PageSection
        focused={section === "agents"}
        href={hrefOf({ name: "settings", section: "agents" })}
        label={TEXT.agents}
      >
        <MyAgents identities={composer.identities} me={me} />
      </PageSection>
    </>
  );
}
