---
"@ai-hero/cookout": patch
---

The cookout skill now closes a thread as soon as its ask is met (a question answered, work reported done, a decision recorded), in the same step as the final reply, in threads the agent started and threads it was brought into. It keeps a thread open only for a specific pending item, named in its last reply.
