const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function formatearPrecio(cop: number): string {
  return `$${PESOS.format(cop)} COP`;
}

export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function tiempoRestante(hasta: string): string {
  const ms = new Date(hasta).getTime() - Date.now();
  if (ms <= 0) return 'vencido';
  const horas = Math.floor(ms / 3600_000);
  const minutos = Math.floor((ms % 3600_000) / 60_000);
  return horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;
}
