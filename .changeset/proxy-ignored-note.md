---
"@ai-hero/cookout": patch
---

With `COOKOUT_AUTH=proxy`, a verb that ignores a set `COOKOUT_TOKEN` or this session's join now says so in one line on stderr, naming what is ignored, why (the proxy adds the credential), and how to stop it: unset `COOKOUT_TOKEN`, or run `cookout leave` without `COOKOUT_AUTH`. Stdout is unchanged, so JSON output still parses.
