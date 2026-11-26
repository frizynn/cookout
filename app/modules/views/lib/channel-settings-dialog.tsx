import type { ChannelName, Identity } from "../../sdk/index.ts";
import { FieldNote, FormDialog, TokenText } from "../../design-system/controls.tsx";
import { Alert } from "../../design-system/content.tsx";
import { ChannelRoutingFields } from "./channel-routing-fields.tsx";
import type { ChannelSettings } from "./use-channel-settings.ts";
import type { ReactNode } from "react";

const TEXT = {
  busy: "Saving…",
  description: (channel: ChannelName) => `Who hears a person's top-level message in #${channel} that mentions no one.`,
  done: "Done",
  failed: "Couldn't save it.",
  save: "Save",
  secret: "Router secret",
  secretNote: "Shown once. The router checks each request's cookout-signature header with it.",
  title: "Channel settings",
} as const;

interface ChannelSettingsDialogProps {
  readonly channel: ChannelName;
  readonly identities: readonly Identity[];
  readonly settings: ChannelSettings;
}

function buttonOf(settings: ChannelSettings): string {
  if (settings.save.status === "secret") {
    return TEXT.done;
  }
  return TEXT.save;
}

export function ChannelSettingsDialog(props: ChannelSettingsDialogProps): ReactNode {
  const { settings } = props;
  const { save } = settings;
  const handleCancel = settings.close;
  const handleSubmit = settings.submit;
  return (
    <FormDialog
      busy={save.status === "saving"}
      busyButton={TEXT.busy}
      button={buttonOf(settings)}
      description={TEXT.description(props.channel)}
      disabled={false}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      open={settings.open}
      title={TEXT.title}
    >
      {save.status !== "secret" && <ChannelRoutingFields identities={props.identities} settings={settings} />}
      {save.status === "secret" && <TokenText label={TEXT.secret} token={save.secret} />}
      {save.status === "secret" && <FieldNote refused={false}>{TEXT.secretNote}</FieldNote>}
      {save.status === "failed" && <Alert>{`${TEXT.failed} ${save.refusal.message}`}</Alert>}
    </FormDialog>
  );
}
