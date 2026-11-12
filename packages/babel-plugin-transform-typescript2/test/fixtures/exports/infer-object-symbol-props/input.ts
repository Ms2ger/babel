export const e = {
  [Symbol.hasInstance]: function(): boolean { return false },
  [Symbol.isConcatSpreadable]: function(): boolean { return false },
};
export const f = {
  [globalThis.Symbol.hasInstance]: function(): boolean { return false },
  [globalThis.Symbol.isConcatSpreadable]: function(): boolean { return false },
};