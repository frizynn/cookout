import { Context } from "effect";

export class Keyed extends Context.Service<Keyed, { readonly size: number }>()("not/the/deterministic/key") {}
