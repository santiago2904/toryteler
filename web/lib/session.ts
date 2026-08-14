import { cookies } from 'next/headers';

/**
 * The session is a signed token the API issues. It is kept in an httpOnly
 * cookie so no script on the page can read it — including anything that ever
 * sneaks into the bundle.
 */
const COOKIE = 'session';
const MAX_AGE_DAYS = 30;

export async function setSession(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_DAYS * 86_400,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function hasSession(): Promise<boolean> {
  return Boolean((await cookies()).get(COOKIE)?.value);
}

const DESTINATION = 'after-signin';

/**
 * Where to land once the emailed link is redeemed.
 *
 * Only a path within this site is accepted. A full URL here would turn the
 * sign-in flow into an open redirect: land on our domain, bounce to theirs,
 * with our name on the link that did it.
 */
export async function rememberDestination(path: string): Promise<void> {
  if (!path.startsWith('/') || path.startsWith('//')) return;
  (await cookies()).set(DESTINATION, path, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 900,
  });
}

export async function takeDestination(): Promise<string> {
  const store = await cookies();
  const path = store.get(DESTINATION)?.value;
  store.delete(DESTINATION);
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/cuenta';
}
