'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PayoutHint } from '@/components/PayoutHint';
import { DropDetail } from '@/lib/types';
import styles from '@/app/studio/studio.module.scss';

export function VideoForm({ video }: { video?: DropDetail }) {
  const editing = Boolean(video);
  const sold = video ? (video.capacity ?? 0) - (video.remaining ?? 0) : 0;

  const [price, setPrice] = useState(video?.priceCop ?? 0);
  const [unlimited, setUnlimited] = useState(video?.capacity === null);
  const [seats, setSeats] = useState(video?.capacity ?? 50);
  const [windowHours, setWindowHours] = useState(video?.viewWindowHours ?? 24);

  // Capacity can go up but never below what has already been sold: those
  // people paid, and lowering it would strand them.
  const belowSold = editing && !unlimited && seats < sold;

  return (
    <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
      <Link href="/studio" className="label muted">← Publicado</Link>
      <h1 className="label muted">{editing ? 'Editar video' : 'Nuevo video'}</h1>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" name="titulo" defaultValue={video?.title} autoComplete="off" />

      <label htmlFor="desc">Qué van a ver</label>
      <textarea id="desc" name="descripcion" rows={4} defaultValue={video?.description ?? ''} />

      <label htmlFor="video">Video</label>
      <input id="video" name="video" type="file" accept="video/*" />
      {editing && (
        <p className="muted">Ya hay un video cargado. Subir otro lo reemplaza.</p>
      )}

      <label htmlFor="precio">Precio en pesos</label>
      <input
        id="precio" name="precio" type="number" min={1} inputMode="numeric"
        value={price || ''} onChange={(e) => setPrice(Number(e.target.value))}
      />
      <PayoutHint price={price} />

      <fieldset className={styles.group}>
        <legend>Cuántas personas pueden comprarlo</legend>
        <label className={styles.checkbox}>
          <input
            type="checkbox" checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
          />
          Sin límite
        </label>
        <input
          type="number" min={1} inputMode="numeric"
          value={seats} onChange={(e) => setSeats(Number(e.target.value))}
          disabled={unlimited} aria-label="Número de cupos"
        />
        {belowSold ? (
          <p role="alert">
            Ya lo compraron {sold} personas. No puedes bajar de ahí: perderían lo que pagaron.
          </p>
        ) : (
          <p className="muted">
            {unlimited
              ? 'Cualquiera puede comprarlo, sin tope.'
              : editing
                ? `Lo han comprado ${sold}. Cuando lleguen a ${seats}, deja de venderse.`
                : `Cuando lo compren ${seats} personas, deja de venderse.`}
          </p>
        )}
      </fieldset>

      <label htmlFor="ventana">Horas de la ventana</label>
      <input
        id="ventana" name="ventana" type="number" min={1} inputMode="numeric"
        value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))}
      />
      <p className="muted">
        Desde que le dan play tienen {windowHours} h para verlo. Dentro de ese tiempo pueden
        entrar y salir; cuando se cierra, no vuelve a abrirse.
        {editing && ' Cambiarlo no afecta a quienes ya le dieron play.'}
      </p>

      <div className={styles.save}>
        <button type="submit" disabled>
          {editing ? 'Guardar cambios' : 'Guardar como borrador'}
        </button>
        <span className="muted">Guardar estará disponible cuando conectemos la tienda.</span>
      </div>
    </form>
  );
}
