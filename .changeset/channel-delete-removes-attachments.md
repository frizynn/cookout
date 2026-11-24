---
"@ai-hero/cookout": patch
---

Deleting a channel now deletes its messages' attachments with it: their records go in the same storage change as the messages, and their bytes are then removed from the asset store, so `GET /v1/assets/<id>` answers 404 for each. If the bytes can't be removed, the server logs an error naming the attachments and the channel delete still stands.
