import { FileDrop } from "./file-drop.tsx";
import type { FilesHandler } from "./drop-zone.tsx";
import type { ReactNode } from "react";

interface SidePanelBodyParts {
  readonly onFiles: FilesHandler | null;
  readonly children: ReactNode;
}

export function SidePanelBody(parts: SidePanelBodyParts): ReactNode {
  if (parts.onFiles === null) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{parts.children}</div>;
  }
  const handleFiles = parts.onFiles;
  return <FileDrop onFiles={handleFiles}>{parts.children}</FileDrop>;
}
