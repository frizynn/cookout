import { Alert } from "../../design-system/content.tsx";
import type { AvatarPick } from "../../composer/index.ts";
import { CharacterPicker } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { avatar: "Avatar" } as const;

interface AvatarPickerProps {
  readonly name: string;
  readonly pick: AvatarPick;
}

export function AvatarPicker(props: AvatarPickerProps): ReactNode {
  const { pick } = props;
  const state = useSyncExternalStore(pick.subscribe, pick.snapshot);
  const handleChooseLook = pick.chooseStyle;
  const handlePick = pick.pick;
  const handleSave = pick.save;
  const handleShuffle = pick.shuffle;
  const { save } = state;
  return (
    <CharacterPicker
      label={TEXT.avatar}
      look={state.style}
      onChooseLook={handleChooseLook}
      onPick={handlePick}
      onSave={handleSave}
      onShuffle={handleShuffle}
      picked={state.picked}
      round={state.round}
      saving={save.status === "saving"}
      seed={props.name}
    >
      {save.status === "failed" && <Alert>{`Couldn't save the avatar (${save.code}): ${save.message}`}</Alert>}
    </CharacterPicker>
  );
}
