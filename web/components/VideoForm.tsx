'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PayoutHint } from '@/components/PayoutHint';
import { PosterPicker } from '@/components/PosterPicker';
import { PriceInput } from '@/components/PriceInput';
import { createDrop, freezePoster, updateDrop, videoStatus } from '@/lib/studio-actions';
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

  /**
   * The video is uploaded when it is chosen, not when the form is submitted.
   * Choosing a frame for the cover needs the video to already be up there, and
   * uploading while the rest of the form is being filled in is time nobody
   * spends waiting.
   */
  const [uploadedUid, setUploadedUid] = useState<string | null>(video?.videoAssetId ?? null);
  const [duration, setDuration] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const [posterSource, setPosterSource] = useState<'frame' | 'file'>(
    video?.videoAssetId ? 'frame' : 'file',
  );
  const [posterSeconds, setPosterSeconds] = useState(1);
  const [poster, setPoster] = useState<File | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editing: ask how long it is, so the frame slider has a real range.
  useEffect(() => {
    if (!video?.videoAssetId) return;
    void videoStatus(video.videoAssetId).then((result) => {
      if (result.ok) setDuration(result.data.durationSeconds);
    });
  }, [video?.videoAssetId]);

  // Capacity can go up but never below what has already been sold: those
  // people paid, and lowering it would strand them.
  const belowSold = editing && !unlimited && seats < sold;

  async function chooseFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploadedUid(null);
    setDuration(null);

    const uploaded = await uploadVideo(file, (stage, percent) =>
      setUploadStatus(
        stage === 'subiendo'
          ? `Subiendo… ${percent}%`
          : 'Cloudflare está procesando el video. Puede tardar unos minutos.',
      ),
    );
    setUploadStatus(null);

    // PROCESANDO is not a failure: the video is safely uploaded, it just is
    // not playable yet.
    if (uploaded.error && uploaded.error !== 'PROCESANDO') {
      setError(uploaded.error);
      return;
    }
    setUploadedUid(uploaded.uid ?? null);
    setDuration(uploaded.durationSeconds ?? null);
    setProcessing(uploaded.error === 'PROCESANDO');
    if (uploaded.uid && !uploaded.error) setPosterSource('frame');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const videoAssetId = uploadedUid;
    const stillProcessing = processing;

    if (!videoAssetId) {
      setSaving(false);
      setError('Falta subir el video.');
      return;
    }

    let posterImage = video?.posterImage ?? null;

    if (posterSource === 'frame') {
      setStatus('Guardando la portada…');
      const frozen = await freezePoster(videoAssetId, posterSeconds);
      if (!frozen.ok) {
        setSaving(false);
        setStatus(null);
        setError(frozen.error);
        return;
      }
      posterImage = frozen.data;
    } else if (poster) {
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

  const ready =
    title.trim().length > 2 && price > 0 && uploadedUid !== null && !belowSold &&
    uploadStatus === null;

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
        onChange={(e) => void chooseFile(e.target.files?.[0] ?? null)}
        disabled={uploadStatus !== null}
      />
      <p className="muted">
        {uploadStatus ??
          (uploadedUid && !editing
            ? processing
              ? 'Subido. Cloudflare lo sigue procesando: podrás publicarlo en unos minutos.'
              : 'Subido y listo.'
            : `Va directo a Cloudflare, no pasa por la tienda. Máximo 200 MB.${
                editing ? ' Ya hay uno cargado: subir otro lo reemplaza.' : ''
              }`)}
      </p>

      <fieldset className={styles.group}>
        <legend>Portada</legend>
        <p className="muted">Es lo que se ve antes de darle play.</p>

        <label className={styles.checkbox}>
          <input
            type="radio" name="portada-origen" checked={posterSource === 'frame'}
            onChange={() => setPosterSource('frame')}
            disabled={!uploadedUid}
          />
          Un fotograma del video
        </label>

        {posterSource === 'frame' && uploadedUid && (
          <PosterPicker
            uid={uploadedUid}
            durationSeconds={duration}
            seconds={posterSeconds}
            onChange={setPosterSeconds}
          />
        )}
        {!uploadedUid && (
          <p className="muted">
            Para elegir un fotograma hay que subir el video primero.
          </p>
        )}

        <label className={styles.checkbox}>
          <input
            type="radio" name="portada-origen" checked={posterSource === 'file'}
            onChange={() => setPosterSource('file')}
          />
          Una imagen aparte
        </label>

        {posterSource === 'file' && (
          <input
            id="portada" name="portada" type="file" accept="image/*"
            onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
          />
        )}

        {editing && video!.posterImage && (
          <p className="muted">Ya tiene una portada: lo que elijas aquí la reemplaza.</p>
        )}
      </fieldset>

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
