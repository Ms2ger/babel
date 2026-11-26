export let a = {
  0(): boolean { return false },
  a(): boolean { return false },
  [+1](): boolean { return false },
  [-1](): boolean { return false },
  ["b"](): boolean { return false },
  [`c`](): boolean { return false },
  [`-d`](): boolean { return false },
  ["-e"](): boolean { return false },
}
