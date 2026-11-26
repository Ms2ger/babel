export const a = {
  [Symbol.hasInstance]: function(): boolean { return false },
  [Symbol.isConcatSpreadable]: function(): boolean { return false },
};
export const b = {
  [globalThis.Symbol.hasInstance]: function(): boolean { return false },
  [globalThis.Symbol.isConcatSpreadable]: function(): boolean { return false },
};
export const c = {
  [Symbol.hasInstance](): boolean { return false },
  [Symbol.isConcatSpreadable](): boolean { return false },
};
export const d = {
  [globalThis.Symbol.hasInstance](): boolean { return false },
  [globalThis.Symbol.isConcatSpreadable](): boolean { return false },
};