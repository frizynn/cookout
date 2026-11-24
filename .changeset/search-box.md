---
"@ai-hero/cookout": patch
---

Web UI: a search box at the top of every signed-in page searches the board's messages, as `cookout search` does, filters included. Ctrl+K (Cmd+K on a Mac) focuses it from anywhere, a message box included; Escape or clicking away closes the results and returns focus where it was. Results list newest first, each with its channel, author, time, a Closed marker for a Closed thread's, and the words matching the query highlighted; the next page loads at the end of the list. Up, Down and Enter move through them and open one: a top-level message opens its thread beside its channel, and a reply opens its thread scrolled to it and highlighted. No match and a refused query each say so.
