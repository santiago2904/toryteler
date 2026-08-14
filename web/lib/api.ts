import { cookies } from 'next/headers';

/**
 * The single boundary with the backend. No page calls fetch on its own.
 *
 * With no API_URL defined, it answers with mock data so the frontend can be
 * built before the API exists. Once API_URL points at something real, this file
 * is the only one that changes behaviour: pages never notice.
 */

const BASE = process.env.API_URL;

export async function apiGet<T>(path: string, authenticated = false): Promise<T> {
  if (!BASE) return mock<T>(path);

  const headers: Record<string, string> = {};
  if (authenticated) {
    const session = (await cookies()).get('session')?.value;
    if (session) headers.Authorization = `Bearer ${session}`;
  }

  const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`API_${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
  if (!BASE) throw new Error('API_NOT_CONFIGURED');

  const session = (await cookies()).get('session')?.value;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session) headers.Authorization = `Bearer ${session}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${BASE}${path}`, { method, headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API_${res.status}:${await res.text()}`);
  return res.json() as Promise<T>;
}

/** lazy: development scaffolding. Deleted together with lib/mock-data.ts. */
async function mock<T>(path: string): Promise<T> {
  const { PIECES, DROPS, ORDERS, ENTITLEMENTS } = await import('./mock-data');

  if (path === '/pieces') {
    return PIECES.map(({ slug, title, priceCop, images, stock, available }) => ({
      slug, title, priceCop, images, stock, available,
    })) as T;
  }

  if (path.startsWith('/pieces/')) {
    const piece = PIECES.find((p) => p.slug === decodeURIComponent(path.slice('/pieces/'.length)));
    if (!piece) throw new Error('API_404');
    return piece as T;
  }

  if (path === '/drops') return DROPS as T;

  if (path.startsWith('/drops/')) {
    const drop = DROPS.find((d) => d.slug === decodeURIComponent(path.slice('/drops/'.length)));
    if (!drop) throw new Error('API_404');
    return drop as T;
  }

  if (path === '/me/orders') return ORDERS as T;
  if (path === '/me/entitlements') return ENTITLEMENTS as T;

  if (path.startsWith('/me/entitlements/')) {
    const id = path.slice('/me/entitlements/'.length);
    const entitlement = ENTITLEMENTS.find((e) => e.id === id);
    if (!entitlement) throw new Error('API_404');
    return entitlement as T;
  }

  throw new Error(`MOCK_ROUTE_MISSING:${path}`);
}
