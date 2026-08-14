/**
 * Capacity, in words. A drop with no limit says nothing: announcing
 * "unlimited seats" only draws attention to something that does not matter.
 */
export function DropStatus({ remaining, soldOut }: { remaining: number | null; soldOut: boolean }) {
  if (soldOut) return <span className="label muted">Agotado</span>;
  if (remaining === null) return null;
  return <span className="label">Quedan {remaining}</span>;
}
