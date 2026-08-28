import { formatPrice } from '@/lib/format';

export function Price({ usdCents }: { usdCents: number }) {
  return <span className="label">{formatPrice(usdCents)}</span>;
}
