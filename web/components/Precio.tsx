import { formatearPrecio } from '@/lib/formato';

export function Precio({ cop }: { cop: number }) {
  return <span className="mayusculas">{formatearPrecio(cop)}</span>;
}
