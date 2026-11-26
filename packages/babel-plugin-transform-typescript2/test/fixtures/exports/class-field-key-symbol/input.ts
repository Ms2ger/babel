export class C1 {
  [Symbol.hasInstance] = function(): boolean { return false };
  [Symbol.isConcatSpreadable] = function(): boolean { return false };
};
export class C2 {
  [globalThis.Symbol.hasInstance] = function(): boolean { return false };
  [globalThis.Symbol.isConcatSpreadable] = function(): boolean { return false };
};