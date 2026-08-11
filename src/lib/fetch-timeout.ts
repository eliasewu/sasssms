/**
 * fetch() with a true timeout that ABORTS the underlying request.
 *
 * The old Promise.race approach left the socket alive in SYN-SENT for minutes
 * when a peer server was down, leaking one zombie socket per timed-out call
 * (observed: 35k+ stuck connections, 3GB RSS). AbortController closes it fast.
 *
 * Only AbortError (i.e. the timeout fired) is relabeled as a timeout message;
 * genuine failures (ECONNREFUSED, DNS, resets) are rethrown unchanged so
 * callers can surface accurate errors.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 3000
): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctl.signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
