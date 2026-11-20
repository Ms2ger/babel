export class C1 {
  a = "";
  b = 1;
  c = null;
  d = true;
  e = ``;
  f = 1n;
  g = undefined;
  h = function(): void {};
}

export class C2 {
  readonly a = "";
  readonly b = 1;
  readonly c = null;
  readonly d = true;
  readonly e = ``;
  readonly f = 1n;
  readonly g = undefined;
  readonly h = function(): void {};
}

export class C3 {
  a? = "";
  b? = 1;
  c? = null;
  d? = true;
  e? = ``;
  f? = 1n;
  g? = undefined;
  h? = function(): void {};
}

export class C4 {
  readonly a? = "";
  readonly b? = 1;
  readonly c? = null;
  readonly d? = true;
  readonly e? = ``;
  readonly f? = 1n;
  readonly g? = undefined;
  readonly h? = function(): void {};
}

export class C5 {
  a = "" as const;
  b = 1 as const;
  d = true as const;
  e = `` as const;
  f = 1n as const;
}

export class C6 {
  readonly a = "" as const;
  readonly b = 1 as const;
  readonly d = true as const;
  readonly e = `` as const;
  readonly f = 1n as const;
}

export class C7 {
  a? = "" as const;
  b? = 1 as const;
  d? = true as const;
  e? = `` as const;
  f? = 1n as const;
}

export class C8 {
  readonly a? = "" as const;
  readonly b? = 1 as const;
  readonly d? = true as const;
  readonly e? = `` as const;
  readonly f? = 1n as const;
}

export class C9 {
  a = "" as "";
  b = 1 as 1;
  d = true as true;
  e = `` as "";
  f = 1n as 1n;
  h = function(): void {} as () => void;
}

export class C10 {
  a? = "" as "";
  b? = 1 as 1;
  d? = true as true;
  e? = `` as "";
  f? = 1n as 1n;
  h? = function(): void {} as () => void;
}

export class C11 {
  a = [2] as const;
  b? = [2] as const;
  readonly c = [2] as const;
  readonly d? = [2] as const;
}

export class C12 {
  a = {a:1};
  b? = {a:1};
  readonly c = {a:1};
  readonly d = {a:1};
}

export class C13 {
  a = {a:1} as const;
  b? = {a:1} as const;
  readonly c = {a:1} as const;
  readonly d = {a:1} as const;
}

export class C {
  readonly i = {a:1};
  k? = {a: "7"} as const;
}
