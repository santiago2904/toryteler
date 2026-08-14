'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PayoutHint } from '@/components/PayoutHint';
import styles from '../../studio.module.scss';

export default function NewVideoPage() {
  const [price, setPrecio] = useState(0);
  const [unlimited, setSinLimite] = useState(false);
  const [seats, setCupos] = useState(50);
  const [windowHours, setVentana] = useState(24);

  return (
    <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
      <Link href="/studio" className="label muted">← Publicado</Link>
      <h1 className="label muted">Nuevo video</h1>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" autoComplete="off" />

      <label htmlFor="desc">Qué van a ver</label>
      <textarea id="desc" name="descripcion" rows={4} />

      <label htmlFor="video">Video</label>
      <input id="video" name="video" type="file" accept="video/*" />

      <label htmlFor="precio">Precio en pesos</label>
      <input
        id="precio" name="precio" type="number" min={1} inputMode="numeric"
        value={price || ''} onChange={(e) => setPrecio(Number(e.target.value))}
      />
      <PayoutHint price={price} />

      <fieldset className={styles.group}>
        <legend>Cuántas personas pueden comprarlo</legend>
        <label className={styles.checkbox}>
          <input
            type="checkbox" checked={unlimited}
            onChange={(e) => setSinLimite(e.target.checked)}
          />
          Sin límite
        </label>
        <input
          type="number" min={1} inputMode="numeric"
          value={seats} onChange={(e) => setCupos(Number(e.target.value))}
          disabled={unlimited} aria-label="Número de cupos"
        />
        <p className="muted">
          {unlimited
            ? 'Cualquiera puede comprarlo, sin tope.'
            : `Cuando lo compren ${seats} personas, deja de venderse.`}
        </p>
      </fieldset>

      <label htmlFor="ventana">Horas de la ventana</label>
      <input
        id="ventana" name="ventana" type="number" min={1} inputMode="numeric"
        value={windowHours} onChange={(e) => setVentana(Number(e.target.value))}
      />
      <p className="muted">
        Desde que le dan play tienen {windowHours} h para verlo. Dentro de ese tiempo pueden entrar
        y salir; cuando se cierra, no vuelve a abrirse.
      </p>

      <div className={styles.save}>
        <button type="submit" disabled>Guardar como borrador</button>
        <span className="muted">Guardar estará disponible cuando conectemos la tienda.</span>
      </div>
    </form>
  );
}
