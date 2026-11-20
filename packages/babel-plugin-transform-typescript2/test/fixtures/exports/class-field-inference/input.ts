export class C1 {
  readonly a = "";
  readonly b = 1;
  readonly c = null;
  readonly d = true;
  readonly e = ``;
  readonly f = 1n;
  readonly g = undefined;
}
export class C2 {
  a = "";
  b = 1;
  c = null;
  d = true;
  e = ``;
  f = 1n;
  g = undefined;
}
export class C3 {
  readonly a? = "";
  readonly b? = 1;
  readonly c? = null;
  readonly d? = true;
  readonly e? = ``;
  readonly f? = 1n;
  readonly g? = undefined;
}
export class C4 {
  a? = "";
  b? = 1;
  c? = null;
  d? = true;
  e? = ``;
  f? = 1n;
  g? = undefined;
}
export class C5 {
  a? = "" as const;
  b? = 1 as const;
  d? = true as const;
  e? = `` as const;
  f? = 1n as const;
}

export class C {
  f? = [2] as const;
  g = [2] as const;
  h = {a:1} as const;
  readonly i = {a:1};
  readonly j = {a:1} as const;
  k? = {a: "7"} as const;
}
