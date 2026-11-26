const SHAPE =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap disabled:opacity-50 max-md:min-h-11 max-md:rounded-[10px] max-md:px-4 max-md:text-[15px]";

export const PRIMARY_BUTTON = `${SHAPE} border border-transparent bg-foreground text-background transition hover:opacity-90 motion-safe:active:scale-[0.97]`;

export const SECONDARY_BUTTON = `${SHAPE} border bg-surface text-foreground shadow-xs transition hover:bg-accent motion-safe:active:scale-[0.97] max-md:border-transparent max-md:bg-muted max-md:shadow-none`;
