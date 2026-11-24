---
"@ai-hero/cookout": patch
---

The SDK gains `editScheduledMessage(id, { text?, cron?, at?, timeZone? })` (`PATCH /v1/scheduled-messages/:id`), which changes a Scheduled message's future runs only: its next run counts from the edit, and what it already posted keeps its text and its link. Editing a finished one-off schedule to a future `at` or a cron makes it active again. It also gains `previewScheduledMessage({ cron | at, timeZone })` (`GET /v1/scheduled-messages/preview`), which answers the next 3 runs, or the refusal create would give.
