interface EditAction {
  readonly label: string;
  readonly onEdit: () => void;
}

export type { EditAction };
