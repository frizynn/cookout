import type { Composer } from "../../composer/index.ts";
import { DisplayNameField } from "./display-name-field.tsx";
import type { Identity } from "../../sdk/index.ts";
import type { Keymap } from "../../keymap/index.ts";
import type { ReactNode } from "react";
import { usePromptKeys } from "./use-prompt-keys.ts";

const TEXT = { displayName: "Display name" } as const;

interface ProfileDisplayNameProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly keymap: Keymap;
  readonly onClose: () => void;
}

export function ProfileDisplayName(props: ProfileDisplayNameProps): ReactNode {
  const { identity } = props;
  usePromptKeys({ keymap: props.keymap, label: TEXT.displayName, onEscape: props.onClose });
  return (
    <DisplayNameField
      draft={props.composer.displayName(identity.name)}
      field={TEXT.displayName}
      focused
      label={TEXT.displayName}
      onCancel={props.onClose}
      saved={identity.displayName ?? null}
    />
  );
}
