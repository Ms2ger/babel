class C1 {
  private constructor(a: string) {}
  private f(a: string) {}
  private ["g"](a: string) {}
  private static h(a: string) {}
  private static ["i"](a: string) {}
}
class C2 {
  public constructor(a: string) {}
  public f(a: string): void {}
  public ["g"](a: string): void {}
  public static h(a: string): void {}
  public static ["i"](a: string): void {}
}
class C3 {
  protected constructor(a: string) {}
  protected f(a: string): void {}
  protected ["g"](a: string): void {}
  protected static h(a: string): void {}
  protected static ["i"](a: string): void {}
}