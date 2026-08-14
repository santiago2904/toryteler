import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { PieceDetail } from '@/lib/types';
import { PieceForm } from '@/components/PieceForm';

export const metadata: Metadata = { title: 'Editar pieza — Studio' };

export default async function EditPiecePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let piece: PieceDetail;
  try {
    piece = await apiGet<PieceDetail>(`/pieces/${slug}`);
  } catch {
    notFound();
  }
  return <PieceForm piece={piece} />;
}
