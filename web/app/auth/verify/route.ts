import { NextRequest, NextResponse } from 'next/server';
import { redeemLink } from '@/lib/checkout-actions';
import { takeDestination } from '@/lib/session';

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

  return NextResponse.redirect(new URL(await takeDestination(), origin));
}
