import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardCalls } from "../../board/index.ts";
import type { BoardLimits } from "../../channels/index.ts";
import type { Refusal } from "../../sdk/index.ts";
import { useBoardStore } from "./use-board.ts";

interface LimitFields {
  readonly agentMentions: string;
  readonly agentTurns: string;
}

type LimitsSave =
  | { readonly status: "editing" }
  | { readonly status: "saving" }
  | { readonly status: "failed"; readonly refusal: Refusal };

interface BoardLimitsEdit {
  readonly limits: BoardLimits | null;
  readonly open: boolean;
  readonly fields: LimitFields;
  readonly save: LimitsSave;
  readonly show: () => void;
  readonly close: () => void;
  readonly editMentions: (value: string) => void;
  readonly editTurns: (value: string) => void;
  readonly submit: () => void;
}

interface BoardLimitsSet {
  readonly fields: LimitFields;
  readonly setLimits: (limits: BoardLimits) => void;
  readonly setOpen: (open: boolean) => void;
}

const EDITING = { status: "editing" } as const;

const EMPTY: LimitFields = { agentMentions: "", agentTurns: "" };

function fieldsOf(limits: BoardLimits | null): LimitFields {
  if (limits === null) {
    return EMPTY;
  }
  return { agentMentions: String(limits.agentMentions), agentTurns: String(limits.agentTurns) };
}

function limitsOf(fields: LimitFields): BoardLimits {
  return { agentMentions: Number(fields.agentMentions), agentTurns: Number(fields.agentTurns) };
}

async function loadInto(calls: BoardCalls, setLimits: (limits: BoardLimits) => void): Promise<void> {
  const found = await calls.boardLimits();
  if ("answer" in found) {
    setLimits(found.answer);
  }
}

function useLoadedLimits(): readonly [BoardLimits | null, (limits: BoardLimits) => void] {
  const { calls } = useBoardStore();
  const [limits, setLimits] = useState<BoardLimits | null>(null);
  const loading = useRef(Promise.resolve());
  useEffect(() => {
    loading.current = loadInto(calls, setLimits);
  }, [calls]);
  return [limits, setLimits];
}

function useFieldEdits(
  setFields: (change: (held: LimitFields) => LimitFields) => void,
): Pick<BoardLimitsEdit, "editMentions" | "editTurns"> {
  const editMentions = useCallback(
    (agentMentions: string) => {
      setFields((held) => ({ ...held, agentMentions }));
    },
    [setFields],
  );
  const editTurns = useCallback(
    (agentTurns: string) => {
      setFields((held) => ({ ...held, agentTurns }));
    },
    [setFields],
  );
  return { editMentions, editTurns };
}

function useSaving(set: BoardLimitsSet): Pick<BoardLimitsEdit, "save" | "submit"> & { readonly reset: () => void } {
  const { calls } = useBoardStore();
  const [save, setSave] = useState<LimitsSave>(EDITING);
  const running = useRef(Promise.resolve());
  const reset = useCallback(() => {
    setSave(EDITING);
  }, []);
  const submit = useCallback(() => {
    setSave({ status: "saving" });
    async function saving(): Promise<void> {
      const answer = await calls.setBoardLimits(limitsOf(set.fields));
      if ("refusal" in answer) {
        setSave({ refusal: answer.refusal, status: "failed" });
        return;
      }
      set.setLimits(answer.answer);
      setSave(EDITING);
      set.setOpen(false);
    }
    running.current = saving();
  }, [calls, set]);
  return { reset, save, submit };
}

function useBoardLimits(): BoardLimitsEdit {
  const [limits, setLimits] = useLoadedLimits();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(EMPTY);
  const edits = useFieldEdits(setFields);
  const { reset, save, submit } = useSaving({ fields, setLimits, setOpen });
  const show = useCallback(() => {
    setFields(fieldsOf(limits));
    reset();
    setOpen(true);
  }, [limits, reset]);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  return { ...edits, close, fields, limits, open, save, show, submit };
}

export { type BoardLimitsEdit, useBoardLimits };
