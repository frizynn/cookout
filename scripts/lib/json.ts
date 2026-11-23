const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseJson = (source: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(source);
    return parsed;
  } catch {
    return undefined;
  }
};

export const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

export const list = (value: unknown): readonly unknown[] | undefined => (Array.isArray(value) ? value : undefined);

export const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

export const counts = (value: unknown): Readonly<Record<string, number>> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  const numbers = entries.flatMap(([key, count]) => (typeof count === "number" ? [[key, count] as const] : []));
  return numbers.length === entries.length ? Object.fromEntries(numbers) : undefined;
};
