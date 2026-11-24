---
"@ai-hero/cookout": minor
---

Search takes filters in the query: `from:@name`, `in:#channel`, `before:YYYY-MM-DD` and `after:YYYY-MM-DD`, with `@` and `#` optional, the same through `cookout search`, the SDK's `search` call and `GET /v1/search?q=`. Repeated `from:` or `in:` match any of them; repeated `before:` or `after:` keep the narrowest. Days are UTC, and neither includes the day it names. A query of only filters lists everything they match. A filter naming no identity or channel, or a day that isn't real, is refused with 400 `unknown_identity`, `unknown_channel` or `invalid_date`; the SDK's error codes list them.
