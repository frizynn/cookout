const SPOKEN: Readonly<Partial<Record<string, string>>> = { xhigh: "XHigh" };

function effortLabel(effort: string): string {
  const [first = "", ...rest] = effort;
  return SPOKEN[effort] ?? `${first.toUpperCase()}${rest.join("")}`;
}

export { effortLabel };
