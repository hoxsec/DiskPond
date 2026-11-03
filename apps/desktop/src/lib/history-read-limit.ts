// Shared by comparisons and Home/vault histories. Aborted queued reads never
// reach the engine; in-flight requests receive the same signal.
export function createHistoryReadLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function limited<T>(
    signal: AbortSignal,
    work: () => Promise<T>,
  ): Promise<T> {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const start = () => {
        signal.removeEventListener("abort", abort);
        active++;
        resolve();
      };
      const abort = () => {
        const index = queue.indexOf(start);
        if (index !== -1) queue.splice(index, 1);
        reject(signal.reason);
      };
      if (active < concurrency) start();
      else {
        queue.push(start);
        signal.addEventListener("abort", abort, { once: true });
      }
    });
    try {
      signal.throwIfAborted();
      return await work();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

export const limitHistoryRead = createHistoryReadLimit(4);
