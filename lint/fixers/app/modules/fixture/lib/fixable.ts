import { later } from "./promise.ts";
import { choose } from "./void.ts";

// oxlint-disable-next-line no-debugger
export const settings = { zeta: 1, alpha: 2 };

export function pick(flag: boolean): number {
  if (flag) return settings.alpha;
  return settings.zeta;
}

export const used = [later, choose];
