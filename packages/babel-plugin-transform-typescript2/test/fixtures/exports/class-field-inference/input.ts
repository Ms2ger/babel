export class C {
  a = 2;
  a1 = 1n
  a2 = ""
  a3 = null
  a4 = undefined
  b? = 1;
  b1? = 1n
  b2? = ""
  b3? = null
  b4? = undefined
  readonly c = 1;
  d? = 7 as const;
  e? = "7" as const;
  f? = [2] as const;
  g = [2] as const;
  h = {a:1} as const;
  readonly i = {a:1};
  readonly j = {a:1} as const;
  k? = {a: "7"} as const;
}
