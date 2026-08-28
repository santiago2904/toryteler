import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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

  // An expired or missing session on a page that needs one is not an error to
  // show: it is a trip to the sign-in screen. No `next` here — what is known at
  // this depth is the API path, not the page the reader was looking at, and
  // sending them to /me/orders would land them on nothing.
  if (res.status === 401 && authenticated) redirect('/entrar');

  if (!res.ok) throw new Error(`API_${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * A binary response, base64 encoded so a server action can return it.
 *
 * Used for images the browser cannot fetch on its own because they sit behind
 * the session — a frame of a protected video, for instance.
 */
export async function apiBytes(path: string): Promise<string> {
  if (!BASE) throw new Error('API_NOT_CONFIGURED');

  const session = (await cookies()).get('session')?.value;
  const res = await fetch(`${BASE}${path}`, {
    headers: session ? { Authorization: `Bearer ${session}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API_${res.status}`);

  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown = {},
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
    return PIECES.map(({ slug, title, priceUsdCents, images, stock, available }) => ({
      slug, title, priceUsdCents, images, stock, available,
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

  /**
   * There are no sessions without an API, so the mock hands out the artist's
   * own profile and /studio stays walkable in the demo deployment. That is the
   * whole reason the panel is reachable there — with API_URL set, the real
   * answer decides, and someone who is not the artist gets a 404.
   */
  if (path === '/me') {
    return { id: 'mock', email: 'tory@toryteler.co', fullName: 'Tory', isAdmin: true } as T;
  }

  if (path === '/me/orders') return ORDERS as T;

  if (path.startsWith('/orders/')) {
    const order = ORDERS.find((o) => o.id === path.slice('/orders/'.length));
    if (!order) throw new Error('API_404');
    return order as T;
  }
  if (path === '/me/entitlements') return ENTITLEMENTS as T;

  if (path.startsWith('/me/entitlements/')) {
    const id = path.slice('/me/entitlements/'.length);
    const entitlement = ENTITLEMENTS.find((e) => e.id === id);
    if (!entitlement) throw new Error('API_404');
    return entitlement as T;
  }

  throw new Error(`MOCK_ROUTE_MISSING:${path}`);
}
