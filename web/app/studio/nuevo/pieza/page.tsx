'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PayoutHint } from '@/components/PayoutHint';
import styles from '../../studio.module.scss';

export default function NewPiecePage() {
  const [price, setPrecio] = useState(0);
  const [units, setUnidades] = useState(1);

  return (
    <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
      <Link href="/studio" className="label muted">← Publicado</Link>
      <h1 className="label muted">Nueva pieza</h1>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" autoComplete="off" />

      <label htmlFor="desc">Qué es</label>
      <textarea id="desc" name="descripcion" rows={3} />

      <label htmlFor="hist">Procedencia — de dónde viene y por qué importa</label>
      <textarea id="hist" name="historia" rows={5} />

      <label htmlFor="nota">Nota personal para quien la compre</label>
      <textarea id="nota" name="nota" rows={3} />

      <label htmlFor="precio">Precio en pesos</label>
      <input
        id="precio" name="precio" type="number" min={1} inputMode="numeric"
        value={price || ''} onChange={(e) => setPrecio(Number(e.target.value))}
      />
      <PayoutHint price={price} />

      <label htmlFor="unidades">Unidades a la venta</label>
      <input
        id="unidades" name="unidades" type="number" min={0} inputMode="numeric"
        value={units} onChange={(e) => setUnidades(Number(e.target.value))}
      />
      <p className="muted">
        {units === 1
          ? 'Una sola unidad: la pieza es irrepetible y se retira en cuanto alguien la compre.'
          : units === 0
            ? 'Sin units: se publica pero nadie puede comprarla.'
            : `Una edición de ${units}. Varias personas pueden tener la misma piece.`}
      </p>

      <label htmlFor="fotos">Fotos</label>
      <input id="fotos" name="fotos" type="file" multiple accept="image/*" />

      <div className={styles.save}>
        <button type="submit" disabled>Guardar como borrador</button>
        <span className="muted">Guardar estará disponible cuando conectemos la tienda.</span>
      </div>
    </form>
  );
}
