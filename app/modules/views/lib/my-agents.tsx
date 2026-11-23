import { AgentCard } from "./agent-card.tsx";
import { CreateAgentForm } from "./create-agent-form.tsx";
import type { Identities } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import { Muted } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { title: "My agents" } as const;

interface MyAgentsProps {
  readonly identities: Identities;
  readonly me: IdentityName;
}

export function MyAgents(props: MyAgentsProps): ReactNode {
  const { identities, me } = props;
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  const owned = listed.filter((identity) => identity.kind === "agent" && identity.owner === String(me));
  return (
    <>
      <Muted>{TEXT.title}</Muted>
      {owned.map((agent) => (
        <AgentCard identities={identities} identity={agent} key={agent.name} />
      ))}
      <CreateAgentForm creation={identities.creation} />
    </>
  );
}
