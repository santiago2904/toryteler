'use client';

import { useState } from 'react';
import { calcularComision, PRECIO_RECOMENDADO_COP } from '@/lib/comision';
import { formatearPrecio } from '@/lib/formato';
import estilos from './studio.module.scss';

/**
 * Muestra qué queda después de la comisión en el momento de escribir el precio.
 * Es información en el punto de decisión, nunca una restricción: el artista
 * puede poner el precio que quiera, incluido el simbólico.
 */
function GuiaDePrecio({ precio }: { precio: number }) {
  const { recibeCop, porcentaje } = calcularComision(precio);
  if (precio <= 0) return null;

  return (
    <p className={`${estilos.guia} tenue`} role="status">
      Recibes {formatearPrecio(recibeCop)} · {porcentaje}% se va en comisión.
      {precio < PRECIO_RECOMENDADO_COP &&
        ` Desde ${formatearPrecio(PRECIO_RECOMENDADO_COP)} la comisión baja a cerca del 8%.`}
    </p>
  );
}

export default function Studio() {
  const [precioPieza, setPrecioPieza] = useState(0);
  const [precioDrop, setPrecioDrop] = useState(0);
  const [sinLimite, setSinLimite] = useState(false);

  const sinGuardar = (e: React.FormEvent) => e.preventDefault();

  return (
    <div className={estilos.formularios}>
      <form onSubmit={sinGuardar} className={estilos.formulario}>
        <h1 className="mayusculas tenue">Nueva pieza</h1>

        <label htmlFor="p-titulo">Título</label>
        <input id="p-titulo" name="titulo" />

        <label htmlFor="p-slug">Dirección en la web</label>
        <input id="p-slug" name="slug" placeholder="boceto-portada" pattern="[a-z0-9-]+" />

        <label htmlFor="p-desc">Qué es</label>
        <textarea id="p-desc" name="descripcion" rows={3} />

        <label htmlFor="p-hist">Procedencia — de dónde viene y por qué importa</label>
        <textarea id="p-hist" name="historia" rows={5} />

        <label htmlFor="p-nota">Nota personal para quien la compre</label>
        <textarea id="p-nota" name="nota" rows={3} />

        <label htmlFor="p-precio">Precio en pesos</label>
        <input
          id="p-precio" name="precio" type="number" min={1} inputMode="numeric"
          value={precioPieza || ''} onChange={(e) => setPrecioPieza(Number(e.target.value))}
        />
        <GuiaDePrecio precio={precioPieza} />

        <label htmlFor="p-img">Fotos</label>
        <input id="p-img" name="imagenes" type="file" multiple accept="image/*" />

        <button type="submit" disabled>Guardar como borrador</button>
      </form>

      <form onSubmit={sinGuardar} className={estilos.formulario}>
        <h1 className="mayusculas tenue">Nuevo video</h1>

        <label htmlFor="d-titulo">Título</label>
        <input id="d-titulo" name="titulo" />

        <label htmlFor="d-slug">Dirección en la web</label>
        <input id="d-slug" name="slug" placeholder="ojitos-verdes-maqueta" pattern="[a-z0-9-]+" />

        <label htmlFor="d-desc">Qué van a ver</label>
        <textarea id="d-desc" name="descripcion" rows={4} />

        <label htmlFor="d-video">Video</label>
        <input id="d-video" name="video" type="file" accept="video/*" />

        <label htmlFor="d-precio">Precio en pesos</label>
        <input
          id="d-precio" name="precio" type="number" min={1} inputMode="numeric"
          value={precioDrop || ''} onChange={(e) => setPrecioDrop(Number(e.target.value))}
        />
        <GuiaDePrecio precio={precioDrop} />

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
            id="d-cupos" name="cupos" type="number" min={1} inputMode="numeric"
            defaultValue={50} disabled={sinLimite}
            aria-label="Número de cupos"
          />
        </fieldset>

        <label htmlFor="d-ventana">
          Horas de la ventana — cuánto dura el acceso desde que le dan play
        </label>
        <input id="d-ventana" name="ventana" type="number" min={1} defaultValue={24} />

        <button type="submit" disabled>Guardar como borrador</button>
      </form>
    </div>
  );
}
