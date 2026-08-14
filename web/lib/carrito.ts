export interface LineaCarrito {
  kind: 'piece' | 'drop';
  slug: string;
  title: string;
  image: string | null;
  priceCop: number;
}

const CLAVE = 'carrito';

/**
 * El carrito vive en el navegador. Cuando exista la API seguirá viviendo aquí:
 * lo que se envía al crear el pedido son los identificadores, y los precios se
 * releen de la base. Nada de lo que hay aquí se cree a la hora de cobrar.
 *
 * `storage` solo avisa a otras pestañas, así que se emite además un evento
 * propio para que la cabecera se entere en la pestaña actual.
 */
export const EVENTO_CARRITO = 'carrito:cambio';

export function leerCarrito(): LineaCarrito[] {
  if (typeof window === 'undefined') return [];
  try {
    const crudo = localStorage.getItem(CLAVE);
    const valor: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(valor) ? (valor as LineaCarrito[]) : [];
  } catch {
    return [];
  }
}

function guardar(lineas: LineaCarrito[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lineas));
  } catch {
    // Almacenamiento bloqueado: el carrito dura lo que dure la página.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CARRITO));
}

/** Las piezas son únicas y los videos van uno por persona: nunca hay cantidad. */
export function agregar(linea: LineaCarrito): void {
  const lineas = leerCarrito();
  if (lineas.some((l) => l.kind === linea.kind && l.slug === linea.slug)) return;
  guardar([...lineas, linea]);
}

export function quitar(kind: LineaCarrito['kind'], slug: string): void {
  guardar(leerCarrito().filter((l) => !(l.kind === kind && l.slug === slug)));
}

export function estaEnCarrito(kind: LineaCarrito['kind'], slug: string): boolean {
  return leerCarrito().some((l) => l.kind === kind && l.slug === slug);
}

export function totalCop(lineas: LineaCarrito[]): number {
  return lineas.reduce((suma, l) => suma + l.priceCop, 0);
}
