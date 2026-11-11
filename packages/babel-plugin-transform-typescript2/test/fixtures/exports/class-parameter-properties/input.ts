class C1 {
  private b: string = "";
  constructor(private a: string) {}
}
class C2 {
  private b: string = "";
  constructor(public a: string) {}
}
class C3 {
  private b: string = "";
  constructor(protected a: string) {}
}
class C4 {
  private b: string = "";
  constructor(readonly a: string) {}
}
class C5 {
  private b: string = "";
  constructor(private a = "x") {}
}
class C6 {
  private b: string = "";
  constructor(public a = "x") {}
}
class C7 {
  private b: string = "";
  constructor(protected a = "x") {}
}
class C8 {
  private b: string = "";
  constructor(readonly a = "x") {}
}