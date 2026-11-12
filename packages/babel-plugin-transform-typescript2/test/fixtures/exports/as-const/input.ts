export const a = 7 as const;
export let b = 7 as const;
export const c = {y:7, z: {a:""}} as const;
export let d = {y:7, z: {a:""}} as const;
export const e = [1, "2", 3, function(): void {}, {a:[""]}] as const;
export const f = {a:[1, "2", 3, function(): void {}, {a:[""]}]} as const;
export const g = `i` as const;