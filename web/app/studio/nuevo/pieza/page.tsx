import type { Metadata } from 'next';
import { PieceForm } from '@/components/PieceForm';

export const metadata: Metadata = { title: 'Nueva pieza — Studio' };

export default function NewPiecePage() {
  return <PieceForm />;
}
