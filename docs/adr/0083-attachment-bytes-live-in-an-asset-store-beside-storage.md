# Attachment bytes live in an asset store beside Storage

2026-11-24 (mattpocock/cookout#373, the first slice of #371).

## Decision

- **Two seams.** `Storage` keeps each attachment's record (ID, name, content type, size, whether it is an image) with its message, on memory, SQLite and Postgres alike. `AssetStore` (`app/modules/storage/lib/server/asset-store.ts`) keeps the bytes: `put`, `read` as a stream, and `remove`. The memory store serves tests and `cookout dev`; the disk store serves `cookout serve`, in `COOKOUT_ASSETS_DIR`, or an `assets` folder beside `COOKOUT_DB` when that is empty. A later object store is a third `AssetStore`, with no change to `Storage`.
- **Files on disk are named by attachment ID alone.** A posted name is a label: it is stored, listed and sent back in `Content-Disposition`, never used as a path. The disk store writes a `.partial` file (mode 0600, folder 0700) and renames it, so a half-written file is never served.
- **One multipart request posts a message and its files** (`POST /v1/messages`, a `message` JSON part and up to 10 `attachment` file parts of up to 10 MB each). The bytes are stored first; if the message is then refused, or appending it fails, they are removed again. A refusal of any file refuses the whole post. Matt confirmed the single request on the board on 2026-11-24 (msg 3043).
- **A message needs text or at least one attachment.** It may have attachments and no text; with neither it is refused `message_empty`. Matt decided this on the board on 2026-11-24 (msg 3043). The rule lives in `hasContent` in `app/modules/attachments/index.ts`.
- **Serving is defensive.** `GET /v1/attachments/:id` sniffs the first bytes: only PNG, JPEG, GIF and WebP are served inline with their image type, whatever the name says. Anything else, SVG and HTML included, is `application/octet-stream` with `Content-Disposition: attachment`. Every response carries `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox; default-src 'none'`. Reading needs the same credential as reading messages.
- **The CLI never writes bytes to stdout.** `cookout asset get` writes a file (a safe base name in the current folder by default, the ID when the name has none), refuses to overwrite without `--force`, and prints one JSON line.

## Considered options

- **Bytes in the database**: rejected. It bloats SQLite and Postgres backups and every query plan with blobs the board only streams.
- **Upload first, then post with IDs**: rejected for this slice. Two requests leave orphaned uploads to collect; Matt chose the single request.
- **Trusting the declared content type**: rejected. A client can call HTML `image/png`; sniffing plus `nosniff` and the sandbox CSP keep a hostile file from running on the board's origin.
