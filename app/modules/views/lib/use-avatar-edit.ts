import type { AvatarPick, Composer } from "../../composer/index.ts";
import type { Identity, IdentityName } from "../../sdk/index.ts";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { EditAction } from "../../design-system/content.tsx";

interface AvatarEditProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly me: IdentityName;
}

interface AvatarEditing {
  readonly edit: EditAction | null;
  readonly open: boolean;
  readonly close: () => void;
  readonly pick: AvatarPick;
}

const LABEL = "Change avatar";

function settableBy(identity: Identity, me: IdentityName): boolean {
  if (identity.name === me) {
    return true;
  }
  return identity.kind === "agent" && identity.owner === String(me);
}

function editOf(settable: boolean, onEdit: () => void): EditAction | null {
  if (!settable) {
    return null;
  }
  return { label: LABEL, onEdit };
}

export function useAvatarEdit(props: AvatarEditProps): AvatarEditing {
  const { identity, me } = props;
  const pick = props.composer.avatar(identity.name);
  const { saved } = useSyncExternalStore(pick.subscribe, pick.snapshot);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const handleEdit = useCallback(() => {
    setOpenedAt(saved);
  }, [saved]);
  const handleClose = useCallback(() => {
    setOpenedAt(null);
  }, []);
  const edit = useMemo(() => editOf(settableBy(identity, me), handleEdit), [identity, me, handleEdit]);
  return { close: handleClose, edit, open: openedAt === saved, pick };
}
