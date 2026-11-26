import { InputField, PickField } from "../../design-system/controls.tsx";
import type { ChannelSettings } from "./use-channel-settings.ts";
import type { Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";

const TEXT = {
  fallback: "Fallback",
  fallbackHelp: "The agent that hears it when the router fails, takes over 5 s or picks no one. Empty: no one.",
  owner: "Owner",
  ownerHelp: "The agent that hears a person's message here that mentions no one. Leave empty to use a router.",
  router: "Router URL",
  routerHelp: "A webhook that picks which agents hear it, in place of an owner. Its secret is shown once.",
} as const;

interface ChannelRoutingFieldsProps {
  readonly identities: readonly Identity[];
  readonly settings: ChannelSettings;
}

function agentNames(identities: readonly Identity[]): readonly string[] {
  return identities
    .filter((identity) => identity.kind === "agent" && identity.deactivated !== true)
    .map((identity) => identity.name);
}

export function ChannelRoutingFields(props: ChannelRoutingFieldsProps): ReactNode {
  const { settings } = props;
  const agents = agentNames(props.identities);
  const handleOwner = settings.editOwner;
  const handleRouter = settings.editRouter;
  const handleFallback = settings.editFallback;
  return (
    <>
      <PickField
        error={null}
        help={TEXT.ownerHelp}
        label={TEXT.owner}
        onEdit={handleOwner}
        options={agents}
        required={false}
        value={settings.fields.owner}
      />
      <InputField
        error={null}
        help={TEXT.routerHelp}
        kind="text"
        label={TEXT.router}
        onEdit={handleRouter}
        required={false}
        value={settings.fields.router}
      />
      <PickField
        error={null}
        help={TEXT.fallbackHelp}
        label={TEXT.fallback}
        onEdit={handleFallback}
        options={agents}
        required={false}
        value={settings.fields.fallback}
      />
    </>
  );
}
