import type { Channel, ChannelName, Refusal } from "../../sdk/index.ts";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Answer } from "../../board/index.ts";
import type { ChannelRoutingResponse } from "../../channels/index.ts";
import { useBoardStore } from "./use-board.ts";

interface RoutingFields {
  readonly owner: string;
  readonly router: string;
  readonly fallback: string;
}

type SettingsSave =
  | { readonly status: "editing" }
  | { readonly status: "saving" }
  | { readonly status: "failed"; readonly refusal: Refusal }
  | { readonly status: "secret"; readonly secret: string };

interface ChannelSettings {
  readonly open: boolean;
  readonly fields: RoutingFields;
  readonly save: SettingsSave;
  readonly show: () => void;
  readonly close: () => void;
  readonly editOwner: (value: string) => void;
  readonly editRouter: (value: string) => void;
  readonly editFallback: (value: string) => void;
  readonly submit: () => void;
}

interface ChannelSettingsOf {
  readonly channel: ChannelName;
  readonly found: Channel | null;
}

type FieldsChange = (change: (fields: RoutingFields) => RoutingFields) => void;

const EDITING = { status: "editing" } as const;

const EMPTY: RoutingFields = { fallback: "", owner: "", router: "" };

const FIELDS = ["owner", "router", "fallback"] as const;

function fieldsOf(found: Channel | null): RoutingFields {
  if (found === null) {
    return EMPTY;
  }
  return { fallback: found.fallback ?? "", owner: found.owner ?? "", router: found.router ?? "" };
}

function requestOf(fields: RoutingFields): Record<string, string> {
  const filled = FIELDS.filter((field) => fields[field].trim() !== "");
  return Object.fromEntries(filled.map((field) => [field, fields[field].trim()]));
}

function savedAs(set: Answer<ChannelRoutingResponse>): SettingsSave | null {
  if ("refusal" in set) {
    return { refusal: set.refusal, status: "failed" };
  }
  const secret = set.answer.routerSecret ?? null;
  if (secret === null) {
    return null;
  }
  return { secret, status: "secret" };
}

function useFieldEdits(setFields: FieldsChange): Pick<ChannelSettings, "editFallback" | "editOwner" | "editRouter"> {
  return useMemo(
    () => ({
      editFallback: (fallback: string) => {
        setFields((fields) => ({ ...fields, fallback }));
      },
      editOwner: (owner: string) => {
        setFields((fields) => ({ ...fields, owner }));
      },
      editRouter: (router: string) => {
        setFields((fields) => ({ ...fields, router }));
      },
    }),
    [setFields],
  );
}

function useSaving(
  { channel }: ChannelSettingsOf,
  shown: { readonly fields: RoutingFields; readonly setOpen: (open: boolean) => void },
): Pick<ChannelSettings, "save" | "submit"> & { readonly reset: () => void } {
  const { calls } = useBoardStore();
  const [save, setSave] = useState<SettingsSave>(EDITING);
  const running = useRef(Promise.resolve());
  const { fields, setOpen } = shown;
  const reset = useCallback(() => {
    setSave(EDITING);
  }, []);
  const submit = useCallback(() => {
    if (save.status === "secret") {
      setOpen(false);
      return;
    }
    setSave({ status: "saving" });
    async function saving(): Promise<void> {
      const next = savedAs(await calls.setChannelRouting(channel, requestOf(fields)));
      setSave(next ?? EDITING);
      setOpen(next !== null);
    }
    running.current = saving();
  }, [calls, channel, fields, save.status, setOpen]);
  return { reset, save, submit };
}

function useChannelSettings(of: ChannelSettingsOf): ChannelSettings {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(EMPTY);
  const edits = useFieldEdits(setFields);
  const { reset, save, submit } = useSaving(of, { fields, setOpen });
  const { found } = of;
  const show = useCallback(() => {
    setFields(fieldsOf(found));
    reset();
    setOpen(true);
  }, [found, reset]);
  const saving = save.status === "saving";
  const close = useCallback(() => {
    if (!saving) {
      setOpen(false);
    }
  }, [saving]);
  return { ...edits, close, fields, open, save, show, submit };
}

export { type ChannelSettings, useChannelSettings };
