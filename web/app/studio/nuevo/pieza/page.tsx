'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GuiaDePrecio } from '@/components/GuiaDePrecio';
import estilos from '../../studio.module.scss';

export default function NuevaPieza() {
  const [precio, setPrecio] = useState(0);
  const [unidades, setUnidades] = useState(1);

  return (
    <form onSubmit={(e) => e.preventDefault()} className={estilos.formulario}>
      <Link href="/studio" className="mayusculas tenue">← Publicado</Link>
      <h1 className="mayusculas tenue">Nueva pieza</h1>

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
        value={precio || ''} onChange={(e) => setPrecio(Number(e.target.value))}
      />
      <GuiaDePrecio precio={precio} />

      <label htmlFor="unidades">Unidades a la venta</label>
      <input
        id="unidades" name="unidades" type="number" min={0} inputMode="numeric"
        value={unidades} onChange={(e) => setUnidades(Number(e.target.value))}
      />
      <p className="tenue">
        {unidades === 1
          ? 'Una sola unidad: la pieza es irrepetible y se retira en cuanto alguien la compre.'
          : unidades === 0
            ? 'Sin unidades: se publica pero nadie puede comprarla.'
            : `Una edición de ${unidades}. Varias personas pueden tener la misma pieza.`}
      </p>

      <label htmlFor="fotos">Fotos</label>
      <input id="fotos" name="fotos" type="file" multiple accept="image/*" />

      <div className={estilos.guardar}>
        <button type="submit" disabled>Guardar como borrador</button>
        <span className="tenue">Guardar estará disponible cuando conectemos la tienda.</span>
      </div>
    </form>
  );
}
