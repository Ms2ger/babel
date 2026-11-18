class C1 {
  private constructor(a: string) { this.l = 1 }
  private f(a: string) {}
  private ["g"](a: string) {}
  private static h(a: string) {}
  private static ["i"](a: string) {}
  private j = 2;
  private readonly k = 1;
  private readonly l: 1;
  private readonly m: 1 = 1;
}
class C2 {
  public constructor(a: string) { this.l = 1 }
  public f(a: string): void {}
  public ["g"](a: string): void {}
  public static h(a: string): void {}
  public static ["i"](a: string): void {}
  public j = 2;
  public readonly k = 1;
  public readonly l: 1;
  public readonly m: 1 = 1;
}
class C3 {
  protected constructor(a: string) { this.l = 1 }
  protected f(a: string): void {}
  protected ["g"](a: string): void {}
  protected static h(a: string): void {}
  protected static ["i"](a: string): void {}
  protected j = 2;
  protected readonly k = 1;
  protected readonly l: 1;
  protected readonly m: 1 = 1;
}