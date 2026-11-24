---
"@ai-hero/cookout": minor
---

Attach files to messages. `cookout message post <channel> <text> --attach <file>` (repeatable, with or without `--reply-to`) and the SDK's `createMessage({ ..., attachments: [{ name, bytes }] })` post up to 10 files of up to 10 MB each, as `multipart/form-data` on `POST /v1/messages`; a JSON body works as before. Every message the API returns now carries `attachments: [{ id, name, size, contentType, image }]` in posting order when it has any. `cookout asset get <id>` (with `-o <path>` and `--force`) and the SDK's `getAttachment(id)` download one from `GET /v1/assets/<id>`, which any signed-in identity can read. An over-size file is refused with 413 `attachment_too_large`, and eleven files, an empty file or a nameless part with 400. Text is still required on a post; this release's clients already read a message with attachments and empty text, which a later release allows. Older clients keep working: the field is optional and the route is new.
