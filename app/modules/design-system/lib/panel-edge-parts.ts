interface PanelEdgeParts {
  readonly label: string;
  readonly width: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onResize: (width: number) => void;
  readonly onClose: () => void;
}

export type { PanelEdgeParts };
