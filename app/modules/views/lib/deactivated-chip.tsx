import { Chip } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";

const TEXT = { long: "Show deactivated", short: "Deactivated" } as const;

interface DeactivatedChipProps {
  readonly onToggle: () => void;
  readonly pressed: boolean;
}

export function DeactivatedChip(props: DeactivatedChipProps): ReactNode {
  const handleToggle = props.onToggle;
  return (
    <Chip onClick={handleToggle} pressed={props.pressed}>
      <span className="max-md:sr-only">{TEXT.long}</span>
      <span aria-hidden="true" className="md:hidden">
        {TEXT.short}
      </span>
    </Chip>
  );
}
