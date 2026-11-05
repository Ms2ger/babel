import { E } from "x";
type F = E;
type G = F;
export type H = G;
function g(): number { return 7; }
export let h: typeof g;