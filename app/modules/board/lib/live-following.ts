import type { Live } from "../../live/index.ts";
import type { Part } from "./slice.ts";

type Followed = Pick<Part<unknown>, "apply" | "back">;

type FollowedLive = Live | null;

interface Following {
  readonly live: FollowedLive;
  readonly parts: readonly Followed[];
  readonly rereads: readonly (() => void)[];
}

function catchUpOf(following: Omit<Following, "live">): () => void {
  return () => {
    for (const part of following.parts) {
      part.back();
    }
    for (const reread of following.rereads) {
      reread();
    }
  };
}

function followerOf(following: Following): () => void {
  const { live, parts } = following;
  let followed = false;
  return () => {
    if (followed || live === null) {
      return;
    }
    followed = true;
    live.follow({
      back: catchUpOf(following),
      heard: (event) => {
        for (const part of parts) {
          part.apply(event);
        }
      },
    });
  };
}

export { type FollowedLive, followerOf };
