/**
 * Centralised API client. All requests go to /api/v1 on this origin and are
 * proxied to the Express backend by next.config.ts, so the httpOnly session
 * cookie is sent automatically.
 */
export const API_BASE = '/api/v1';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: FieldError[],
  ) {
    super(message);
  }
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount?: number;
  [key: string]: unknown;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

let onUnauthorized: (() => void) | null = null;
/** Registered by the authenticated layouts: called when a session expires mid-use. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(method: Method, path: string, body?: unknown, { raw = false } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  let json: { success?: boolean; data?: unknown; meta?: PageMeta; error?: { code: string; message: string; details?: FieldError[] } } | null = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON (e.g. proxy error page)
  }

  if (!res.ok) {
    const err = json?.error;
    if (res.status === 401 && onUnauthorized && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? (res.status >= 500 ? 'The server is unavailable. Please try again shortly.' : 'Request failed'),
      err?.details,
    );
  }

  if (raw) return json as T;
  return json?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  getPaged: <T>(path: string) => request<Paged<T>>('GET', path, undefined, { raw: true }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/** SWR fetchers */
export const fetcher = <T>(path: string) => api.get<T>(path);
export const pagedFetcher = <T>(path: string) => api.getPaged<T>(path);

/** Builds a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function errorMessage(err: unknown, fallback = 'Something went wrong') {
  return err instanceof Error ? err.message : fallback;
}
