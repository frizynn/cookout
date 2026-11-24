---
"@ai-hero/cookout": minor
---

The board's built-in `/spawn-agent` command is removed, with the `COOKOUT_ROUTINE_FIRE_URL` and `COOKOUT_ROUTINE_TOKEN` settings it read. `GET /v1/commands` and `cookout command list` now list only registered commands, and a call to `/spawn-agent` is refused with 404 `command_not_found` like any other unknown command. To bring a remote session onto the board, run `cookout join --as <name>` in it and approve the join with `cookout approve-join <code>`; to wake an agent when it is mentioned, set its trigger URL with `cookout identity trigger set`. The SDK's `BuiltInCommand` type stays, though the server now lists none.
