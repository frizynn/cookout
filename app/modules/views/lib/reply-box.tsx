import { Alert, Form, SubmitButton, Suggestions, TextArea } from "../../design-system/index.tsx";
import type { ThreadMessages, ThreadMessagesState } from "../../board/index.ts";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Draft } from "../../composer/index.ts";
import type { ReactNode } from "react";

type ReplyState = Extract<ThreadMessagesState, { readonly status: "loaded" }>["reply"];

const TEXT = {
  button: "Send reply",
  field: "Reply",
  form: "Reply to the thread",
  posting: "Sending…",
  suggestions: "Mention suggestions",
} as const;

const NONE = 0;

interface ReplyBoxProps {
  readonly draft: Draft;
  readonly messages: ThreadMessages;
  readonly reply: ReplyState;
}

export function ReplyBox(props: ReplyBoxProps): ReactNode {
  const { draft, reply } = props;
  const handleReply = props.messages.reply;
  const handleEdit = draft.edit;
  const written = useSyncExternalStore(draft.subscribe, draft.snapshot);
  const posting = reply.status === "posting";
  const handleSend = useCallback(
    (text: string) => {
      handleReply(text);
      draft.clear();
    },
    [draft, handleReply],
  );
  const handleChoose = useCallback(
    (option: string) => {
      draft.choose(option.slice("@".length));
    },
    [draft],
  );
  const mentions = useMemo(() => written.suggestions.map((identity) => `@${identity.name}`), [written.suggestions]);
  return (
    <>
      <Form field="text" label={TEXT.form} onSubmit={handleSend}>
        <TextArea caret={written.caret} label={TEXT.field} name="text" onEdit={handleEdit} value={written.text} />
        {mentions.length > NONE && <Suggestions label={TEXT.suggestions} onChoose={handleChoose} options={mentions} />}
        <SubmitButton disabled={posting}>
          {posting && TEXT.posting}
          {!posting && TEXT.button}
        </SubmitButton>
      </Form>
      {reply.status === "failed" && <Alert>{`Couldn't post the reply (${reply.code}): ${reply.message}`}</Alert>}
    </>
  );
}
