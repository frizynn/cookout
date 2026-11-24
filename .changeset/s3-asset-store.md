---
"@ai-hero/cookout": minor
---

`cookout serve` can keep attachments in a private S3-compatible bucket (S3, R2 or Tigris) instead of on disk. Set `COOKOUT_ASSET_STORE=s3` with `COOKOUT_S3_BUCKET`, `COOKOUT_S3_ENDPOINT`, `COOKOUT_S3_REGION`, `COOKOUT_S3_ACCESS_KEY_ID` and `COOKOUT_S3_SECRET_ACCESS_KEY`; each object is keyed by its attachment ID and streamed through `/v1/assets/<id>` with the same headers and sign-in check as on disk, so the bucket is never made public. With `s3` and a setting unset, serve refuses to start with `s3_settings_missing`, naming it and never showing a value. Disk stays the default, so nothing changes unless you set it.
