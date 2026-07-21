export function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason || new Error("Analysis aborted");
}

export function withAbortSignal(fetchImpl, signal) {
  if (!signal) return fetchImpl;
  const implementation = fetchImpl || fetch;
  return (input, init = {}) => {
    throwIfAborted(signal);
    return implementation(input, { ...init, signal });
  };
}
