import { availableParallelism } from 'node:os'

// Past ~8 threads decode slowed 2-4x under load in the 2026-11 benchmark; E-cores and SMT siblings
// don't help. Half the logical CPUs is close to the performance cores on Apple silicon and SMT x86.
export function performanceCoreThreads(): number {
  const logical = availableParallelism()
  return Math.min(logical, 8, Math.max(4, Math.floor(logical / 2)))
}
