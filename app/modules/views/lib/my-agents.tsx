import { AgentCard } from "./agent-card.tsx";
import { CreateAgentForm } from "./create-agent-form.tsx";
import type { Identities } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

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
      {owned.map((agent) => (
        <AgentCard identities={identities} identity={agent} key={agent.name} />
      ))}
      <CreateAgentForm creation={identities.creation} />
    </>
  );
}
