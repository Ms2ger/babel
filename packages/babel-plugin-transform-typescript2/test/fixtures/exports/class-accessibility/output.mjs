declare class C1 {
  private constructor();
  private f;
  private ["g"];
  private static h;
  private static ["i"];
  private j;
  private readonly k;
  private readonly l;
  private readonly m;
}
declare class C2 {
  constructor(a: string);
  f(a: string): void;
  ["g"](a: string): void;
  static h(a: string): void;
  static ["i"](a: string): void;
  j: number;
  readonly k = 1;
  readonly l: 1;
  readonly m: 1;
}
declare class C3 {
  protected constructor(a: string);
  protected f(a: string): void;
  protected ["g"](a: string): void;
  protected static h(a: string): void;
  protected static ["i"](a: string): void;
  protected j: number;
  protected readonly k = 1;
  protected readonly l: 1;
  protected readonly m: 1;
}