import { createCatName, type Cat, type Dog } from "./animal.js";
import type { Component as
  X } from "a";
import type { "*" as Y } from "a";
import type * as Z from "a";
import type foox from "a";
import A, * as B from "c";
import C, { X as D } from "c";
export type Cat2 = Cat;
export type Dog2 = Dog;
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
function quux() : void { return }
export {quux};

export type cat = number;
export declare var x1: number;
declare var x2: number;
var x3: number = 3;

export declare class C1 {
  f1: string;
  f2(): void;
  f3(a: string): string;
  f3(a: number): number;
  get f4(): bigint;
  set f4(value: bigint);
}