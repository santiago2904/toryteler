import { formatDate } from '@/lib/format';

/**
 * Status is spelled out in words, never a coloured dot. Tone supports it;
 * anyone who cannot tell the two greys apart reads the same thing.
 *
 * A piece with a single unit is irreplaceable and says so; with several it is
 * an edition, and what matters is how many are left.
 */
export function PieceStatus({ stock, soldAt }: { stock: number; soldAt: string | null }) {
  if (stock <= 0) {
    return (
      <span className="label muted">
        Vendida{soldAt ? ` · ${formatDate(soldAt)}` : ''}
      </span>
    );
  }
  if (stock === 1) return <span className="label">Única</span>;
  return <span className="label">Quedan {stock}</span>;
}
