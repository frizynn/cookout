---
"@ai-hero/cookout": patch
---

In the web UI, buttons that close or replace part of the page leave focus on a named element instead of the page: a newly shown token's `Copy token` takes focus and `Done` gives it back to that agent's `Rotate token`; Pause and Resume keep focus on the toggled button; saving or cancelling a scheduled message's edit returns focus to its `Edit`; and the new channel form's `Cancel` returns it to `New channel`. The create-agent form in Settings now tabs from the name to the display name before `Create`.
