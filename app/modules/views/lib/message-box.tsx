import { Alert, BoxFrame, Form, SubmitButton, Suggestions, TextArea } from "../../design-system/index.tsx";
import { useCallback, useSyncExternalStore } from "react";
import type { Draft } from "../../composer/index.ts";
import type { PostState } from "../../board/index.ts";
import type { ReactNode } from "react";
import { useMentions } from "./use-mentions.ts";

interface MessageBoxText {
  readonly button: string;
  readonly field: string;
  readonly form: string;
  readonly posts: string;
}

const POSTING = "Sending…";
const SUGGESTIONS = "Mention suggestions";

interface MessageBoxProps {
  readonly draft: Draft;
  readonly post: PostState;
  readonly onPost: (text: string, posted: () => void) => void;
  readonly text: MessageBoxText;
  readonly focused: boolean;
}

export function MessageBox(props: MessageBoxProps): ReactNode {
  const { draft, onPost, post, text } = props;
  const handleEdit = draft.edit;
  const written = useSyncExternalStore(draft.subscribe, draft.snapshot);
  const posting = post.status === "posting";
  const handleSend = useCallback(
    (sent: string) => {
      onPost(sent, draft.clear);
    },
    [draft, onPost],
  );
  const { choosing, handleChoose, mentions } = useMentions({ draft, suggestions: written.suggestions });
  const handleMove = draft.highlight;
  const handlePick = draft.chooseHighlighted;
  return (
    <BoxFrame>
      <Form field="text" label={text.form} onSubmit={handleSend}>
        <TextArea
          caret={written.caret}
          choosing={choosing}
          focused={props.focused}
          label={text.field}
          name="text"
          onEdit={handleEdit}
          onMove={handleMove}
          onPick={handlePick}
          value={written.text}
        />
        {choosing && (
          <Suggestions
            highlighted={written.highlighted}
            label={SUGGESTIONS}
            onChoose={handleChoose}
            options={mentions}
          />
        )}
        <SubmitButton disabled={posting}>
          {posting && POSTING}
          {!posting && text.button}
        </SubmitButton>
      </Form>
      {post.status === "failed" && <Alert>{`Couldn't post the ${text.posts} (${post.code}): ${post.message}`}</Alert>}
    </BoxFrame>
  );
}
