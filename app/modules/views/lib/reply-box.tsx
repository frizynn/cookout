import { Alert, Form, SubmitButton, TextArea } from "../../design-system/index.tsx";
import type { ThreadMessages, ThreadMessagesState } from "../../board/index.ts";
import type { ReactNode } from "react";

type ReplyState = Extract<ThreadMessagesState, { readonly status: "loaded" }>["reply"];

const TEXT = { button: "Send reply", field: "Reply", form: "Reply to the thread", posting: "Sending…" } as const;

interface ReplyBoxProps {
  readonly messages: ThreadMessages;
  readonly reply: ReplyState;
}

export function ReplyBox(props: ReplyBoxProps): ReactNode {
  const { reply } = props;
  const handleReply = props.messages.reply;
  const posting = reply.status === "posting";
  return (
    <>
      <Form field="text" label={TEXT.form} onSubmit={handleReply}>
        <TextArea label={TEXT.field} name="text" />
        <SubmitButton disabled={posting}>
          {posting && TEXT.posting}
          {!posting && TEXT.button}
        </SubmitButton>
      </Form>
      {reply.status === "failed" && <Alert>{`Couldn't post the reply (${reply.code}): ${reply.message}`}</Alert>}
    </>
  );
}
