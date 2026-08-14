import { NextResponse } from 'next/server';
import { apiBytes } from '@/lib/api';

/**
 * Shows a contract in the browser.
 *
 * The buyer cannot link straight to the API — the session lives in a cookie of
 * this domain, not that one — so this passes the request through with it. It
 * also means the file arrives as a PDF the browser opens, instead of the
 * `application/octet-stream` that storage serves for a raw upload, which is
 * what made the tab come up blank.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const base64 = await apiBytes(`/contracts/${id}/document`);
    return new NextResponse(Buffer.from(base64, 'base64'), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="contrato.pdf"',
        // It names a person and carries their ID number: nothing caches it.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    // Distinguished on purpose: answering 404 to everything turned an expired
    // session and a storage failure into the same dead end, with the same
    // sentence and nothing to act on.
    const raw = error instanceof Error ? error.message : String(error);

    if (raw.includes('API_401')) {
      return NextResponse.redirect(new URL('/entrar', request.url));
    }
    if (raw.includes('API_404')) {
      return new NextResponse('No encontramos ese contrato en tu cuenta.', { status: 404 });
    }
    return new NextResponse(
      'No pudimos abrir el contrato. Vuelve a intentarlo en un momento.',
      { status: 502 },
    );
  }
}
