'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GuiaDePrecio } from '@/components/GuiaDePrecio';
import estilos from '../../studio.module.scss';

export default function NuevoVideo() {
  const [precio, setPrecio] = useState(0);
  const [sinLimite, setSinLimite] = useState(false);
  const [cupos, setCupos] = useState(50);
  const [ventana, setVentana] = useState(24);

  return (
    <form onSubmit={(e) => e.preventDefault()} className={estilos.formulario}>
      <Link href="/studio" className="mayusculas tenue">← Publicado</Link>
      <h1 className="mayusculas tenue">Nuevo video</h1>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" autoComplete="off" />

      <label htmlFor="desc">Qué van a ver</label>
      <textarea id="desc" name="descripcion" rows={4} />

      <label htmlFor="video">Video</label>
      <input id="video" name="video" type="file" accept="video/*" />

      <label htmlFor="precio">Precio en pesos</label>
      <input
        id="precio" name="precio" type="number" min={1} inputMode="numeric"
        value={precio || ''} onChange={(e) => setPrecio(Number(e.target.value))}
      />
      <GuiaDePrecio precio={precio} />

      <fieldset className={estilos.grupo}>
        <legend>Cuántas personas pueden comprarlo</legend>
        <label className={estilos.casilla}>
          <input
            type="checkbox" checked={sinLimite}
            onChange={(e) => setSinLimite(e.target.checked)}
          />
          Sin límite
        </label>
        <input
          type="number" min={1} inputMode="numeric"
          value={cupos} onChange={(e) => setCupos(Number(e.target.value))}
          disabled={sinLimite} aria-label="Número de cupos"
        />
        <p className="tenue">
          {sinLimite
            ? 'Cualquiera puede comprarlo, sin tope.'
            : `Cuando lo compren ${cupos} personas, deja de venderse.`}
        </p>
      </fieldset>

      <label htmlFor="ventana">Horas de la ventana</label>
      <input
        id="ventana" name="ventana" type="number" min={1} inputMode="numeric"
        value={ventana} onChange={(e) => setVentana(Number(e.target.value))}
      />
      <p className="tenue">
        Desde que le dan play tienen {ventana} h para verlo. Dentro de ese tiempo pueden entrar
        y salir; cuando se cierra, no vuelve a abrirse.
      </p>

      <div className={estilos.guardar}>
        <button type="submit" disabled>Guardar como borrador</button>
        <span className="tenue">Guardar estará disponible cuando conectemos la tienda.</span>
      </div>
    </form>
  );
}
