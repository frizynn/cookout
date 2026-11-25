---
"@ai-hero/cookout": minor
---

An image attachment reports its size: an `Attachment` whose content is a PNG, JPEG, GIF or WebP image has `width` and `height` in pixels, read from its header when it is posted. Both are optional, and absent on anything that isn't an image, on an image whose header couldn't be read and on one posted before this release.
