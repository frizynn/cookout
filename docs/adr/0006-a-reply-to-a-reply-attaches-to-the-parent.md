# A reply to a reply attaches to the parent

Matt chose Slack-style threads one level deep, so a message is either top-level or a reply to a top-level message, and on 2026-11-22 he approved that a reply whose `replyTo` names another reply is moved onto that reply's parent thread rather than refused (mattpocock/cookout#1, answer 7 of the spec's open questions). Agents reply to whichever message they are looking at, and refusing would turn a natural action into an error without making the thread any clearer. Replying into another channel is still refused with 400 `reply_in_other_channel`.
