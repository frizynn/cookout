import type { ChannelSettings } from "./use-channel-settings.ts";
import { ChoiceField } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";
import { WakeChoices } from "./wake-choices.tsx";

const TEXT = {
  ephemeral: "A new session",
  ephemeralHelp: (fallback: string) =>
    `Each thread @${fallback} takes starts a new session, with the harness, model and effort below.`,
  label: "Fallback wakes in",
  session: "Its own session",
  sessionHelp: (fallback: string) => `@${fallback} hears it in the session it already runs, as when mentioned.`,
} as const;

const CHOICES = [
  { label: TEXT.session, value: "session" },
  { label: TEXT.ephemeral, value: "ephemeral" },
] as const;

interface FallbackWakeFieldsProps {
  readonly settings: ChannelSettings;
}

function helpOf({ fields }: ChannelSettings): string {
  if (fields.wake === "ephemeral") {
    return TEXT.ephemeralHelp(fields.fallback);
  }
  return TEXT.sessionHelp(fields.fallback);
}

export function FallbackWakeFields(props: FallbackWakeFieldsProps): ReactNode {
  const { settings } = props;
  const handleWake = settings.editWake;
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <ChoiceField
        choices={CHOICES}
        help={helpOf(settings)}
        label={TEXT.label}
        onChoose={handleWake}
        value={settings.fields.wake}
      />
      {settings.fields.wake === "ephemeral" && settings.options !== null && (
        <WakeChoices options={settings.options} settings={settings} />
      )}
    </div>
  );
}
