---
"@ai-hero/cookout": patch
---

`cookout schedule get <id>` shows one Scheduled message, including `pausedBecause: "creator_deactivated"` when its creator's deactivation paused it. Reactivating the creator leaves such a schedule paused until a manager resumes it, and an agent's schedules keep running when its owner is Deactivated.
