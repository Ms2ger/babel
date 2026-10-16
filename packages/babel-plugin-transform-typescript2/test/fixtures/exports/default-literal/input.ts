import type { Component as
  X } from "a";
import type { "*" as Y } from "a";
import type * as Z from "a";
import type foox from "a";
import A, * as B from "c";
import C, { X as D } from "c";
export type Component = X;
export type Component2 = Y;
export type Component3 = typeof Z;
export type Component4 = typeof foox;
Array.from([]);
{ let x = 7; }

export function foo() : string {
    return "8";
}
export function bar() : number {
  return 7 + 8;
}
//export default function () {};

export default "foo";
export function baz() : void { return }

export type cat = number;