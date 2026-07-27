
export function conTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout (${ms}ms)`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export async function fetchConReintento<T>(
  fn: () => Promise<T>,
  intentosMs: number[] = [10000, 8000],
): Promise<T> {
  let lastErr: unknown;
  for (const ms of intentosMs) {
    try {
      return await conTimeout(fn(), ms);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
