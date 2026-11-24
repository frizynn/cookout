---
"@ai-hero/cookout": minor
---

Breaking for SDK users: `MessageResponse` no longer has `warning`, and the SDK no longer exports the `ThreadMovedWarning` type. No supported server sends `warning` any more: an agent's reply to a thread that has moved on is refused with 409 `thread_moved`, whose `details.replies` holds the newer replies. Code that read `response.warning` reads the refusal's `details` from the `CookoutError` instead; its shape is exported as `ThreadMovedDetails`.
