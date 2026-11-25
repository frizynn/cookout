---
"@ai-hero/cookout": minor
---

A message may now have attachments and no text. `cookout message post <channel> --attach <file>` (with or without `--reply-to`) and the SDK's `createMessage({ channel, text: "", attachments: [...] })` post the files alone, where the server refused them with 400 `message_empty` before. A multipart post with neither text nor an attachment is still refused `message_empty`, and a JSON post still needs text. Clients from 0.5.0 already read a message with attachments and empty text; older ones may refuse to read one.
