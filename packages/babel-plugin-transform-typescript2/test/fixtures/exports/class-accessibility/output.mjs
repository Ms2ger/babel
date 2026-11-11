declare class C1 {
  private constructor();
  private f;
  private ["g"];
  private static h;
  private static ["i"];
}
declare class C2 {
  constructor(a: string);
  f(a: string): void;
  ["g"](a: string): void;
  static h(a: string): void;
  static ["i"](a: string): void;
}
declare class C3 {
  protected constructor(a: string);
  protected f(a: string): void;
  protected ["g"](a: string): void;
  protected static h(a: string): void;
  protected static ["i"](a: string): void;
}