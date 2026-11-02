import { type Cat, type Dog } from "./animal.js";
import type { Component as X } from "a";
import type { "*" as Y } from "a";
import type * as Z from "a";
import type foox from "a";
import { E } from "x";
export type Cat2 = Cat;
export type Dog2 = Dog;
export type Component = X;
export type Component2 = Y;
export type Component3 = typeof Z;
export type Component4 = typeof foox;
type F = E;
type G = F;
export type H = G;
declare var baz: () => string;
export { baz };
export declare function foo(): string;
export declare function bar(): number;
declare var quux1: () => void;
export { quux1 };
declare var quux2: () => void;
export { quux2 };
declare function quux3b(): void;
export { quux3b };
declare var quux4a: () => void;
export { quux4a };
export default function (): void;
export type cat = number;
export declare var x1: number;
export declare class C1 {
  f1: string;
  f2(): void;
  f3(a: string): string;
  f3(a: number): number;
  get f4(): bigint;
  set f4(value: bigint);
  static f5(): number;
  private f6;
  private f7();
  protected f8: string;
  protected f9(): string;
}
export declare class C2 {
  f1: string;
  f2(): void;
  get f4(): bigint;
  set f4(value: bigint);
  static f5(): number;
  private f6;
  private f7();
  protected f8: string;
  protected f9(): string;
}
export interface I1 {
  f1: string;
  f2: {
    f3: bigint;
  };
}
export enum E1 {
  A = 0,
  B = 1,
  C = 2,
  D = 12
}