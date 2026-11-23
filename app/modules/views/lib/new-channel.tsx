import type { ChannelCreation } from "../../board/index.ts";
import { NavButton } from "../../design-system/index.tsx";
import { NewChannelForm } from "./new-channel-form.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { create: "New channel" } as const;

interface NewChannelProps {
  readonly creation: ChannelCreation;
}

export function NewChannel(props: NewChannelProps): ReactNode {
  const { creation } = props;
  const state = useSyncExternalStore(creation.subscribe, creation.snapshot);
  const handleOpen = creation.open;
  return (
    <>
      {state.open && <NewChannelForm creation={creation} state={state} />}
      {!state.open && <NavButton onClick={handleOpen}>{TEXT.create}</NavButton>}
    </>
  );
}
