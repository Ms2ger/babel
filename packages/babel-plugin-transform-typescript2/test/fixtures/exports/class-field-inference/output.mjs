export declare class C {
  a: number;
  a1: bigint;
  a2: string;
  a3: null;
  a4: undefined;
  b?: number | undefined;
  b1?: bigint | undefined;
  b2?: string | undefined;
  b3?: null | undefined;
  b4?: undefined;
  readonly c = 1;
  d?: 7;
  e?: "7";
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
