import { cookies } from 'next/headers';

/**
 * Única frontera con el backend. Ninguna página llama a fetch por su cuenta.
 *
 * Sin API_URL definida, responde con datos simulados para poder construir el
 * front antes que la API. En cuanto API_URL apunte a algo real, este archivo es
 * lo único que cambia de comportamiento: las páginas no se enteran.
 */

const BASE = process.env.API_URL;

export async function apiGet<T>(path: string, autenticado = false): Promise<T> {
  if (!BASE) return simular<T>(path);

  const headers: Record<string, string> = {};
  if (autenticado) {
    const sesion = (await cookies()).get('session')?.value;
    if (sesion) headers.Authorization = `Bearer ${sesion}`;
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
  if (!BASE) throw new Error('API_NO_CONFIGURADA');

  const sesion = (await cookies()).get('session')?.value;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sesion) headers.Authorization = `Bearer ${sesion}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${BASE}${path}`, { method, headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API_${res.status}:${await res.text()}`);
  return res.json() as Promise<T>;
}

/** lazy: andamio de desarrollo. Se borra junto con lib/simulacion.ts. */
async function simular<T>(path: string): Promise<T> {
  const { PIEZAS, DROPS, PEDIDOS, ACCESOS } = await import('./simulacion');

  if (path === '/pieces') {
    return PIEZAS.map(({ slug, title, priceCop, images, stock, available }) => ({
      slug, title, priceCop, images, stock, available,
    })) as T;
  }

  if (path.startsWith('/pieces/')) {
    const pieza = PIEZAS.find((p) => p.slug === decodeURIComponent(path.slice('/pieces/'.length)));
    if (!pieza) throw new Error('API_404');
    return pieza as T;
  }

  if (path === '/drops') return DROPS as T;

  if (path.startsWith('/drops/')) {
    const drop = DROPS.find((d) => d.slug === decodeURIComponent(path.slice('/drops/'.length)));
    if (!drop) throw new Error('API_404');
    return drop as T;
  }

  if (path === '/me/orders') return PEDIDOS as T;
  if (path === '/me/entitlements') return ACCESOS as T;

  throw new Error(`SIMULACION_SIN_RUTA:${path}`);
}
