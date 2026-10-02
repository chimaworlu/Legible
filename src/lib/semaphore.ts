// Minimal in-process concurrency limiter (ai-pipeline.md law 15 — "rate
// limits and concurrency caps per provider live in config, the worker
// respects them with a limiter, not with hope"). Deliberately not a
// distributed lock: the worker is a single long-running process, so an
// in-memory counter is the whole mechanism needed for v1.
export function createSemaphore(maxConcurrency: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  function next() {
    if (active >= maxConcurrency) return;
    const resolve = waiting.shift();
    if (!resolve) return;
    active++;
    resolve();
  }

  return {
    // Runs `task` once a concurrency slot is free. Never awaited by the
    // caller — this is fire-and-forget so the poll loop can keep scheduling
    // other jobs while this one runs.
    run(task: () => Promise<void>): void {
      const start = () =>
        task().finally(() => {
          active--;
          next();
        });

      if (active < maxConcurrency) {
        active++;
        void start();
      } else {
        waiting.push(() => void start());
      }
    },
  };
}
