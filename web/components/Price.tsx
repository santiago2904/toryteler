import { formatPrice } from '@/lib/format';

export function Price({ cop }: { cop: number }) {
  return <span className="label">{formatPrice(cop)}</span>;
}
