// Spread
let j = {};
export let i = {
    ...j
};
//
export let i = {
  a(a = 7+1): void {}
};
//
export let i = {
  a([a] = [7]): void {}
};
//
export class C5 {
  constructor(private ...args: string[]) {}
}
//
export class C5 {
  constructor(private {a}: {a: string}) {}
}
//
export class C5 {
  constructor(private [a]: string[]) {}
}