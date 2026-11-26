import type { AvatarPick } from "../../composer/index.ts";
import { AvatarPicker } from "./avatar-picker.tsx";
import { ListDialog } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";

interface ProfileAvatarProps {
  readonly name: string;
  readonly open: boolean;
  readonly pick: AvatarPick;
  readonly onClose: () => void;
}

const TEXT = {
  close: "Cancel",
  description: (name: string) => `Pick a character for @${name}. Saving it replaces the current picture.`,
  title: "Change avatar",
} as const;

export function ProfileAvatar(props: ProfileAvatarProps): ReactNode {
  const handleClose = props.onClose;
  return (
    <ListDialog
      close={TEXT.close}
      description={TEXT.description(props.name)}
      onClose={handleClose}
      open={props.open}
      title={TEXT.title}
    >
      <AvatarPicker name={props.name} pick={props.pick} />
    </ListDialog>
  );
}
