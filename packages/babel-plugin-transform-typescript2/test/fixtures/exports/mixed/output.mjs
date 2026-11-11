import { type Cat, type Dog } from "./animal.js";
import type { Component as X } from "a";
import type { "*" as Y } from "a";
import type * as Z from "a";
import type foox from "a";
export type Cat2 = Cat;
export type Dog2 = Dog;
export type Component = X;
export type Component2 = Y;
export type Component3 = typeof Z;
export type Component4 = typeof foox;
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
  private f7;
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
  private f7;
  protected f8: string;
  protected f9(): string;
}
export declare class C3 {
  #private;
  constructor();
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
export type E2 = keyof typeof E1;
export const enum E3 {
  A = 0,
  B = 1
}
export declare const x = 7;
export declare let y: number;
export declare const a: {
  y: number;
  z: {
    a: string;
  };
  x: boolean;
};
export declare let b: {
  y: number;
  z: {
    a: string;
    9: string;
  };
  x: boolean;
};
export declare let c: {
  y: number;
  z: {
    a: string;
    9: string;
  };
  x: boolean;
};
export declare const d: () => void;
export declare const e: object;
export declare let f: any;
export declare function g(...args: number[]): void;
export declare function h(a: string, b?: string): void;
export declare let i: {
  a(_: string): number;
  b(_: string): number;
  c(p?: () => void): void;
  d(p?: any): void;
};
export declare class C4 {
  static a: string;
}
export declare class C5 {
  constructor([a]: string[]);
  foo([a]: string[]): void;
}
export declare class C6 {
  constructor(a?: string);
}