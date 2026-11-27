import { AgentField, InputField } from "../../design-system/controls.tsx";
import type { AgentChoice } from "../../design-system/controls.tsx";
import type { ChannelSettings } from "./use-channel-settings.ts";
import { FallbackWakeFields } from "./fallback-wake-fields.tsx";
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

function agentsOf(identities: readonly Identity[]): readonly AgentChoice[] {
  return identities
    .filter((identity) => identity.kind === "agent" && identity.deactivated !== true)
    .map((identity) => ({ displayName: identity.displayName ?? null, name: identity.name }));
}

function withHeld(agents: readonly AgentChoice[], held: string): readonly AgentChoice[] {
  if (held === "" || agents.some((agent) => agent.name === held)) {
    return agents;
  }
  return [...agents, { displayName: null, name: held }];
}

export function ChannelRoutingFields(props: ChannelRoutingFieldsProps): ReactNode {
  const { settings } = props;
  const agents = agentsOf(props.identities);
  const handleOwner = settings.editOwner;
  const handleRouter = settings.editRouter;
  const handleFallback = settings.editFallback;
  return (
    <>
      <AgentField
        agents={withHeld(agents, settings.fields.owner)}
        error={null}
        help={TEXT.ownerHelp}
        label={TEXT.owner}
        onEdit={handleOwner}
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
      <AgentField
        agents={withHeld(agents, settings.fields.fallback)}
        error={null}
        help={TEXT.fallbackHelp}
        label={TEXT.fallback}
        onEdit={handleFallback}
        required={false}
        value={settings.fields.fallback}
      />
      {settings.fields.fallback !== "" && <FallbackWakeFields settings={settings} />}
    </>
  );
}
