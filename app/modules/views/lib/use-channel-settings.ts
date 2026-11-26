import type { Channel, ChannelName, Refusal } from "../../sdk/index.ts";
import type { ChannelRoutingResponse, WakeOptions } from "../../channels/index.ts";
import { EMPTY, editedHarness, editedWake, fieldsOf, requestOf } from "./wake-fields.ts";
import type { RoutingFields, WakeMode } from "./wake-fields.ts";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Answer } from "../../board/index.ts";
import { useBoardStore } from "./use-board.ts";

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
  readonly editWake: (value: string) => void;
  readonly editHarness: (value: string) => void;
  readonly editModel: (value: string) => void;
  readonly editEffort: (value: string) => void;
  readonly options: WakeOptions | null;
  readonly submit: () => void;
}

interface ChannelSettingsOf {
  readonly channel: ChannelName;
  readonly found: Channel | null;
}

type FieldsChange = (change: (fields: RoutingFields) => RoutingFields) => void;

const EDITING = { status: "editing" } as const;

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

type FieldEdits = Pick<
  ChannelSettings,
  "editEffort" | "editFallback" | "editHarness" | "editModel" | "editOwner" | "editRouter" | "editWake"
>;

function isWakeMode(value: string): value is WakeMode {
  return value === "session" || value === "ephemeral";
}

function useFieldEdits(setFields: FieldsChange, options: WakeOptions | null): FieldEdits {
  return useMemo(
    () => ({
      editEffort: (effort: string) => {
        setFields((fields) => ({ ...fields, effort }));
      },
      editFallback: (fallback: string) => {
        setFields((fields) => ({ ...fields, fallback }));
      },
      editHarness: (harness: string) => {
        setFields((fields) => editedHarness({ fields, options })(harness));
      },
      editModel: (model: string) => {
        setFields((fields) => ({ ...fields, model }));
      },
      editOwner: (owner: string) => {
        setFields((fields) => ({ ...fields, owner }));
      },
      editRouter: (router: string) => {
        setFields((fields) => ({ ...fields, router }));
      },
      editWake: (wake: string) => {
        if (isWakeMode(wake)) {
          setFields((fields) => editedWake({ fields, options })(wake));
        }
      },
    }),
    [options, setFields],
  );
}

function useWakeOptions(): { readonly options: WakeOptions | null; readonly load: () => void } {
  const { calls } = useBoardStore();
  const [options, setOptions] = useState<WakeOptions | null>(null);
  const running = useRef(Promise.resolve());
  const load = useCallback(() => {
    async function loading(): Promise<void> {
      const found = await calls.wakeOptions();
      if ("answer" in found) {
        setOptions(found.answer);
      }
    }
    running.current = loading();
  }, [calls]);
  return { load, options };
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
  const wakeOptions = useWakeOptions();
  const edits = useFieldEdits(setFields, wakeOptions.options);
  const { reset, save, submit } = useSaving(of, { fields, setOpen });
  const show = useCallback(() => {
    setFields(fieldsOf(of.found));
    reset();
    wakeOptions.load();
    setOpen(true);
  }, [of.found, reset, wakeOptions]);
  const saving = save.status === "saving";
  const close = useCallback(() => {
    if (!saving) {
      setOpen(false);
    }
  }, [saving]);
  return { ...edits, close, fields, open, options: wakeOptions.options, save, show, submit };
}

export { type ChannelSettings, useChannelSettings };
