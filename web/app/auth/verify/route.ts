import { NextRequest, NextResponse } from 'next/server';
import { apiGet } from '@/lib/api';
import { redeemLink } from '@/lib/checkout-actions';
import { takeDestination } from '@/lib/session';
import { Profile } from '@/lib/types';

/**
 * Where the emailed link lands.
 *
 * A route and not a page, because the whole job is a side effect: redeem the
 * token, leave the session cookie, and send the buyer on. Rendering anything
 * would leave the token sitting in the address bar of a page they might share.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const origin = request.nextUrl.origin;

  if (!token) return NextResponse.redirect(new URL('/entrar?error=1', origin));

  const result = await redeemLink(token);
  if (!result.ok) return NextResponse.redirect(new URL('/entrar?error=1', origin));

  return NextResponse.redirect(new URL(await landing(), origin));
}

/**
 * Where to go now.
 *
 * A destination saved before signing in wins: it is what the person was trying
 * to do. Failing that, the artist goes to the studio and everyone else to their
 * account — there is one sign-in door for both, so the difference has to show
 * up after walking through it, not before.
 */
async function landing(): Promise<string> {
  const saved = await takeDestination();
  if (saved !== '/cuenta') return saved;

  try {
    const profile = await apiGet<Profile>('/me', true);
    return profile.isAdmin ? '/studio' : '/cuenta';
  } catch {
    // Whoever they are, the session is valid: the account page is never wrong.
    return '/cuenta';
  }
}
