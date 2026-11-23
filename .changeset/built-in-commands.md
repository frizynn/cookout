---
"@ai-hero/cookout": minor
---

Built-in commands, the ones the server handles itself such as `/spawn-agent`, no longer carry an empty `url` in `GET /v1/commands` (`client.listCommands`, `cookout command list`): they leave `url` out and carry `builtIn: true` instead, while registered commands keep their `url` and carry no flag. The SDK's `Command` is now a union of the two; narrow it with `"builtIn" in command`, and `CommandWithSecretResponse.command` is always a registered one, with its `url`. Adding a command under a built-in command's name is refused with 409 `command_exists`.
