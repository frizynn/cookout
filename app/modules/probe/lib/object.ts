function objectIn(value: unknown): object {
  if ((typeof value === "object" || typeof value === "function") && value !== null) {
    return value;
  }
  return {};
}

export { objectIn };
