import { ChoiceField, OptionRows } from "../../design-system/controls.tsx";
import type { ChannelSettings } from "./use-channel-settings.ts";
import type { OptionRowChoice } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";
import type { WakeOptions } from "../../channels/index.ts";
import { effortLabel } from "./effort-label.ts";
import { harnessIn } from "./wake-fields.ts";

const TEXT = { effort: "Effort", harness: "Harness", model: "Model" } as const;

interface WakeChoicesProps {
  readonly options: WakeOptions;
  readonly settings: ChannelSettings;
}

function harnessChoices(options: WakeOptions): readonly OptionRowChoice[] {
  return options.harnesses.map(({ label, name }) => ({ label, mark: name, name }));
}

function modelChoices(props: WakeChoicesProps): readonly OptionRowChoice[] {
  const harness = harnessIn({ name: props.settings.fields.harness, options: props.options });
  if (harness === null) {
    return [];
  }
  return harness.models;
}

function effortChoices(props: WakeChoicesProps): readonly { readonly label: string; readonly value: string }[] {
  const harness = harnessIn({ name: props.settings.fields.harness, options: props.options });
  if (harness === null) {
    return [];
  }
  return harness.efforts.map((effort) => ({ label: effortLabel(effort), value: effort }));
}

export function WakeChoices(props: WakeChoicesProps): ReactNode {
  const { settings } = props;
  const handleHarness = settings.editHarness;
  const handleModel = settings.editModel;
  const handleEffort = settings.editEffort;
  return (
    <>
      <OptionRows
        choices={harnessChoices(props.options)}
        label={TEXT.harness}
        onChoose={handleHarness}
        value={settings.fields.harness}
      />
      <OptionRows
        choices={modelChoices(props)}
        label={TEXT.model}
        onChoose={handleModel}
        value={settings.fields.model}
      />
      <ChoiceField
        choices={effortChoices(props)}
        help={null}
        label={TEXT.effort}
        onChoose={handleEffort}
        value={settings.fields.effort}
      />
    </>
  );
}
