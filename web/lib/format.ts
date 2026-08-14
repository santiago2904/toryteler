const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** User-facing strings stay in Spanish: the store sells in Colombia. */
export function formatPrice(cop: number): string {
  return `$${PESOS.format(cop)} COP`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function timeLeft(until: string): string {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return 'vencido';
  const hours = Math.floor(ms / 3600_000);
  const minutes = Math.floor((ms % 3600_000) / 60_000);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}
