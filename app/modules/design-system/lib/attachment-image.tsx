import type { AttachmentImageParts } from "./attachment-parts.ts";
import type { ReactNode } from "react";
import { pixels } from "./thumbnail-box.ts";

export function AttachmentImage(parts: AttachmentImageParts): ReactNode {
  return (
    <img
      alt={parts.name}
      className="block rounded-md border bg-muted object-contain"
      decoding="async"
      loading="lazy"
      src={parts.src}
      style={pixels(parts)}
    />
  );
}
