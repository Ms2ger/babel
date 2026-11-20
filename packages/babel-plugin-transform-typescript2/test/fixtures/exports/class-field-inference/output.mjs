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
  a?: "";
  b?: 1;
  d?: true;
  e?: "";
  f?: 1n;
}
export declare class C {
  f?: readonly [2] | undefined;
  g: readonly [2];
  h: {
    readonly a: 1;
  };
  readonly i: {
    a: number;
  };
  readonly j: {
    readonly a: 1;
  };
  k?: {
    readonly a: "7";
  } | undefined;
}
