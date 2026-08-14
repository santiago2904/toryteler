'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PayoutHint } from '@/components/PayoutHint';
import { PriceInput } from '@/components/PriceInput';
import { createDrop, updateDrop } from '@/lib/studio-actions';
import { uploadImages, uploadVideo } from '@/lib/upload';
import { AdminDropDetail } from '@/lib/types';
import styles from '@/app/studio/studio.module.scss';

export function VideoForm({ video }: { video?: AdminDropDetail }) {
  const router = useRouter();
  const editing = Boolean(video);
  const sold = video?.sold ?? 0;

  const [title, setTitle] = useState(video?.title ?? '');
  const [description, setDescription] = useState(video?.description ?? '');
  const [price, setPrice] = useState(video?.priceCop ?? 0);
  const [unlimited, setUnlimited] = useState(video?.capacity === null);
  const [seats, setSeats] = useState(video?.capacity ?? 50);
  const [windowHours, setWindowHours] = useState(video?.viewWindowHours ?? 24);
  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Capacity can go up but never below what has already been sold: those
  // people paid, and lowering it would strand them.
  const belowSold = editing && !unlimited && seats < sold;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    let videoAssetId = video?.videoAssetId;
    let stillProcessing = false;

    if (file) {
      const uploaded = await uploadVideo(file, (stage, percent) =>
        setStatus(
          stage === 'subiendo'
            ? `Subiendo el video… ${percent}%`
            : 'Cloudflare está procesando el video. Puede tardar unos minutos.',
        ),
      );

      // PROCESANDO is not a failure: the video is safely uploaded, it just is
      // not playable yet. Losing everything else typed in would be the failure.
      if (uploaded.error && uploaded.error !== 'PROCESANDO') {
        setSaving(false);
        setStatus(null);
        setError(uploaded.error);
        return;
      }
      videoAssetId = uploaded.uid;
      stillProcessing = uploaded.error === 'PROCESANDO';
    }

    if (!videoAssetId) {
      setSaving(false);
      setStatus(null);
      setError('Falta el archivo del video.');
      return;
    }

    let posterImage = video?.posterImage ?? null;
    if (poster) {
      setStatus('Subiendo la portada…');
      const uploadedPoster = await uploadImages([poster], 'posters');
      if (uploadedPoster.error) {
        setSaving(false);
        setStatus(null);
        setError(uploadedPoster.error);
        return;
      }
      posterImage = uploadedPoster.ids[0] ?? null;
    }

    setStatus('Guardando…');
    const common = {
      title: title.trim(),
      description: description.trim() || null,
      priceCop: price,
      videoAssetId,
      posterImage,
      capacity: unlimited ? null : seats,
      viewWindowHours: windowHours,
    };

    const result = editing ? await updateDrop(video!.id, common) : await createDrop(common);

    setSaving(false);
    setStatus(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(
      stillProcessing ? '/studio?procesando=1' : '/studio',
    );
  }

  const ready = title.trim().length > 2 && price > 0 && (editing || file !== null) && !belowSold;

  return (
    <form onSubmit={save} className={styles.form}>
      <Link href="/studio" className="label muted">← Publicado</Link>
      <h1 className="label muted">{editing ? 'Editar video' : 'Nuevo video'}</h1>

      <label htmlFor="titulo">Título</label>
      <input
        id="titulo" name="titulo" autoComplete="off"
        value={title} onChange={(e) => setTitle(e.target.value)} required
      />

      <label htmlFor="desc">Qué van a ver</label>
      <textarea
        id="desc" name="descripcion" rows={4}
        value={description} onChange={(e) => setDescription(e.target.value)}
      />

      <label htmlFor="video">Video</label>
      <input
        id="video" name="video" type="file" accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <p className="muted">
        Va directo a Cloudflare, no pasa por la tienda. Máximo 200 MB.
        {editing && ' Ya hay uno cargado: subir otro lo reemplaza.'}
      </p>

      <label htmlFor="portada">Portada</label>
      <input
        id="portada" name="portada" type="file" accept="image/*"
        onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
      />
      <p className="muted">
        Es lo que se ve antes de darle play.
        {editing && video!.posterImage && ' Ya tiene una: subir otra la reemplaza.'}
      </p>

      <label htmlFor="precio">Precio</label>
      <PriceInput id="precio" value={price} onChange={setPrice} />
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

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <div className={styles.save}>
        <button type="submit" disabled={saving || !ready}>
          {status ?? (editing ? 'Guardar cambios' : 'Guardar como borrador')}
        </button>
        {!editing && (
          <span className="muted">
            Se guarda sin publicar. Aparece en la tienda cuando le des a publicar.
          </span>
        )}
      </div>
    </form>
  );
}
