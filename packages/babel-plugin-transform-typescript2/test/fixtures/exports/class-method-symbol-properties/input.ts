export class C1 {
  [Symbol.hasInstance](): boolean { return false }
  [Symbol.isConcatSpreadable](): boolean { return false }
};
export class C2 {
  [globalThis.Symbol.hasInstance](): boolean { return false }
  [globalThis.Symbol.isConcatSpreadable](): boolean { return false }
  [Symbol()](): boolean { return false }
};