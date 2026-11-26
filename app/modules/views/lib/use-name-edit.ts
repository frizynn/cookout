import type { Identity, IdentityName } from "../../sdk/index.ts";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Composer } from "../../composer/index.ts";
import type { EditAction } from "../../design-system/content.tsx";

interface NameEditProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly me: IdentityName;
}

interface NameEditing {
  readonly edit: EditAction | null;
  readonly open: boolean;
  readonly close: () => void;
}

const LABEL = "Edit display name";

function editableBy(identity: Identity, me: IdentityName): boolean {
  if (identity.name === me) {
    return true;
  }
  return identity.kind === "agent" && identity.owner === String(me);
}

function editOf(editable: boolean, onEdit: () => void): EditAction | null {
  if (!editable) {
    return null;
  }
  return { label: LABEL, onEdit };
}

export function useNameEdit(props: NameEditProps): NameEditing {
  const { identity, me } = props;
  const draft = props.composer.displayName(identity.name);
  const { saved } = useSyncExternalStore(draft.subscribe, draft.snapshot);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const handleEdit = useCallback(() => {
    setOpenedAt(saved);
  }, [saved]);
  const handleClose = useCallback(() => {
    draft.discard();
    setOpenedAt(null);
  }, [draft]);
  const edit = useMemo(() => editOf(editableBy(identity, me), handleEdit), [identity, me, handleEdit]);
  return { close: handleClose, edit, open: openedAt === saved };
}
