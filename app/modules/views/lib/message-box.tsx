import { Alert, Form, SubmitButton, Suggestions, TextArea } from "../../design-system/index.tsx";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Draft } from "../../composer/index.ts";
import type { PostState } from "../../board/index.ts";
import type { ReactNode } from "react";

interface MessageBoxText {
  readonly button: string;
  readonly field: string;
  readonly form: string;
  readonly posts: string;
}

const POSTING = "Sending…";
const SUGGESTIONS = "Mention suggestions";

const NONE = 0;

interface MessageBoxProps {
  readonly draft: Draft;
  readonly post: PostState;
  readonly onPost: (text: string, posted: () => void) => void;
  readonly text: MessageBoxText;
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
  const handleChoose = useCallback(
    (option: string) => {
      draft.choose(option.slice("@".length));
    },
    [draft],
  );
  const mentions = useMemo(() => written.suggestions.map((identity) => `@${identity.name}`), [written.suggestions]);
  return (
    <>
      <Form field="text" label={text.form} onSubmit={handleSend}>
        <TextArea caret={written.caret} label={text.field} name="text" onEdit={handleEdit} value={written.text} />
        {mentions.length > NONE && <Suggestions label={SUGGESTIONS} onChoose={handleChoose} options={mentions} />}
        <SubmitButton disabled={posting}>
          {posting && POSTING}
          {!posting && text.button}
        </SubmitButton>
      </Form>
      {post.status === "failed" && <Alert>{`Couldn't post the ${text.posts} (${post.code}): ${post.message}`}</Alert>}
    </>
  );
}
