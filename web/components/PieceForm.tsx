'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PayoutHint } from '@/components/PayoutHint';
import { PieceDetail } from '@/lib/types';
import styles from '@/app/studio/studio.module.scss';

/**
 * One form for creating and editing. The only difference is whether it starts
 * with values: duplicating it would mean every future field has to be added
 * twice, and one of the two copies would drift.
 */
export function PieceForm({ piece }: { piece?: PieceDetail }) {
  const editing = Boolean(piece);
  const [price, setPrice] = useState(piece?.priceCop ?? 0);
  const [units, setUnits] = useState(piece?.stock ?? 1);

  return (
    <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
      <Link href="/studio" className="label muted">← Publicado</Link>
      <h1 className="label muted">{editing ? 'Editar pieza' : 'Nueva pieza'}</h1>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" defaultValue={piece?.title} autoComplete="off" />

      <label htmlFor="desc">Qué es</label>
      <textarea id="desc" name="descripcion" rows={3} defaultValue={piece?.description ?? ''} />

      <label htmlFor="hist">Procedencia — de dónde viene y por qué importa</label>
      <textarea id="hist" name="historia" rows={5} defaultValue={piece?.story ?? ''} />

      <label htmlFor="nota">Nota personal para quien la compre</label>
      <textarea id="nota" name="nota" rows={3} />

      <label htmlFor="precio">Precio en pesos</label>
      <input
        id="precio" name="precio" type="number" min={1} inputMode="numeric"
        value={price || ''} onChange={(e) => setPrice(Number(e.target.value))}
      />
      <PayoutHint price={price} />

      <label htmlFor="unidades">Unidades a la venta</label>
      <input
        id="unidades" name="unidades" type="number" min={0} inputMode="numeric"
        value={units} onChange={(e) => setUnits(Number(e.target.value))}
      />
      <p className="muted">
        {units === 1
          ? 'Una sola unidad: la pieza es irrepetible y se retira en cuanto alguien la compre.'
          : units === 0
            ? 'Sin unidades: sigue publicada pero nadie puede comprarla.'
            : `Una edición de ${units}. Varias personas pueden tener la misma pieza.`}
      </p>

      <label htmlFor="fotos">Fotos</label>
      <input id="fotos" name="fotos" type="file" multiple accept="image/*" />
      {editing && piece!.images.length > 0 && (
        <p className="muted">
          Ahora tiene {piece!.images.length}{' '}
          {piece!.images.length === 1 ? 'foto' : 'fotos'}. Subir otras las reemplaza.
        </p>
      )}

      <div className={styles.save}>
        <button type="submit" disabled>
          {editing ? 'Guardar cambios' : 'Guardar como borrador'}
        </button>
        <span className="muted">Guardar estará disponible cuando conectemos la tienda.</span>
      </div>
    </form>
  );
}
