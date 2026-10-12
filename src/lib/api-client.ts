export type FetchImplementation = typeof fetch;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly payload: unknown) {
    super(`API request failed (${status})`);
    this.name = 'ApiError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reads transport data as unknown: each feature owns validation of its protocol. */
export async function requestJson(
  path: string,
  options: RequestInit = {},
  fetchImplementation: FetchImplementation = fetch,
): Promise<unknown> {
  options.signal?.throwIfAborted();
  const response = typeof __AGRIDX_DEV_PREVIEW__ !== 'undefined' && __AGRIDX_DEV_PREVIEW__ && fetchImplementation === fetch
    ? await (await import('../dev-preview/api')).previewFetch(path, options)
    : await fetchImplementation(path, options);
  options.signal?.throwIfAborted();
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    options.signal?.throwIfAborted();
    throw new ApiError(response.status, payload);
  }
  const payload: unknown = await response.json();
  options.signal?.throwIfAborted();
  return payload;
}
