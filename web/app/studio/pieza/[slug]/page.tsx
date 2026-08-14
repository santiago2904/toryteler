import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { PieceDetail } from '@/lib/types';
import { PieceForm } from '@/components/PieceForm';

export const metadata: Metadata = { title: 'Editar pieza — Studio' };

/** Always fresh: this is the form that just saved. */
export const dynamic = 'force-dynamic';

export default async function EditPiecePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let piece: PieceDetail;
  try {
    // The admin endpoint, so a draft can be edited at all: the public one
    // hides drafts, which is precisely what makes them drafts.
    piece = await apiGet<PieceDetail>(`/admin/pieces/${slug}`, true);
  } catch {
    notFound();
  }
  return <PieceForm piece={piece} />;
}
