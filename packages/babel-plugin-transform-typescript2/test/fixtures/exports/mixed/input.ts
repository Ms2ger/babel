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

{ var baz = function() : string { return "" } }
export { baz };

export function foo() : string {
  return "8";
}
export function bar() : number {
  return 7 + 8;
}
var quux1: () => void = function() : void { return }
export {quux1};

{var quux2 = function() : void { return }}
export {quux2};

function quux3a() : void { return }
function quux3b() : void { quux3a(); return }
export {quux3b};

var quux4a = function() : void { return }, quux4b = function() : void { return };
export {quux4a};

export default function() : void{}

export type cat = number;
export declare var x1: number;
declare var x2: number;
var x3: number = 3;
export var [y1, y2]: number[] = [3, 4];

export declare class C1 {
  f1: string;
  f2(): void;
  f3(a: string): string;
  f3(a: number): number;
  get f4(): bigint;
  set f4(value: bigint);
  static f5() : number;
  private f6: string;
  private f7(): string;
  protected f8: string;
  protected f9(): string;
}

export class C2 {
  f1: string = "";
  f2(): void { return };
  get f4(): bigint { return 0n };
  set f4(value: bigint) {};
  static f5() : number { return 7 };
  private f6: string;
  private f7(): string { return ""; };
  protected f8: string;
  protected f9(): string { return ""; };
}
export class C3 {
  #f: string
  constructor() {
      this.#f = ""
  }
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
  B = 1,
}

export const x = 7;
export let y = 7;
export const a = {y:7, z: {a:""}, x: true};
export let b = {y:7, z: {a:"", 9: ``}, x: true};
export let c = {y:7, z: {["a"]:"", [9]: ""}, x: true};
export const d = function(): void {}
export const e: object = {y:7, z: {a:""}, x: true};
export let f: any = {y:7, z: {a:""}, x: true};
export function g(...args: number[]): void {};
export function h(a: string, b?: string): void {};
export let i = {
  a(_: string): number { return 7 },
  ["b"](_: string): number { return 7 },
  c(p = function(): void {}): void { p() },
  d(p: any = function(): void {}): void {},
}
export class C4 {
  static a: string;
  static {
    this.a = "static";
  }
}