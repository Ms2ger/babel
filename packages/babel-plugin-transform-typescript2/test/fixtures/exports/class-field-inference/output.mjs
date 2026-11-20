export declare class C1 {
  readonly a = "";
  readonly b = 1;
  readonly c: null;
  readonly d = true;
  readonly e = "";
  readonly f = 1n;
  readonly g: undefined;
}
export declare class C2 {
  a: string;
  b: number;
  c: null;
  d: boolean;
  e: string;
  f: bigint;
  g: undefined;
}
export declare class C3 {
  readonly a?: "" | undefined;
  readonly b?: 1 | undefined;
  readonly c?: null | undefined;
  readonly d?: true | undefined;
  readonly e?: "";
  readonly f?: 1n | undefined;
  readonly g?: undefined;
}
export declare class C4 {
  a?: string | undefined;
  b?: number | undefined;
  c?: null | undefined;
  d?: boolean | undefined;
  e?: string;
  f?: bigint | undefined;
  g?: undefined;
}
export declare class C5 {
  a: "";
  b: 1;
  d: true;
  e: "";
  f: 1n;
}
export declare class C6 {
  a: "";
  b: 1;
  d: true;
  e: "";
  f: 1n;
}
export declare class C7 {
  a?: "";
  b?: 1;
  d?: true;
  e?: "";
  f?: 1n;
}
export declare class C8 {
  a?: "";
  b?: 1;
  d?: true;
  e?: "";
  f?: 1n;
}
export declare class C9 {
  a: readonly [2];
  b?: readonly [2] | undefined;
  readonly c: readonly [2];
  readonly d?: readonly [2] | undefined;
}
export declare class C10 {
  a: {
    readonly a: 1;
  };
  b?: {
    readonly a: 1;
  } | undefined;
  readonly c: {
    readonly a: 1;
  };
  readonly d: {
    readonly a: 1;
  };
}
export declare class C {
  readonly i: {
    a: number;
  };
  k?: {
    readonly a: "7";
  } | undefined;
}
