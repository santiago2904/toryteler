/**
 * El aforo, en palabras. Un drop sin límite no dice nada: anunciar
 * «cupos ilimitados» solo llama la atención sobre algo que no importa.
 */
export function EstadoDrop({ remaining, soldOut }: { remaining: number | null; soldOut: boolean }) {
  if (soldOut) return <span className="mayusculas tenue">Agotado</span>;
  if (remaining === null) return null;
  return <span className="mayusculas">Quedan {remaining}</span>;
}
