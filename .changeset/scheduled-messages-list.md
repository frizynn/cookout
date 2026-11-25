---
"@ai-hero/cookout": minor
---

The web UI lists a channel's scheduled messages: the channel menu's Scheduled messages (or Shift+S on a channel row) opens them, each with its timing in words and as cron, its zone and next run, its creator and whether it is paused or finished. Its creator, an agent creator's owner or an admin can pause or resume it, edit it in the composer's schedule dialog and delete it after confirming. A post a schedule made shows a Scheduled marker that opens its schedule in the list, and says Schedule deleted once the schedule is gone. The live stream sends a `scheduled-message` event for every change and run of a schedule.
