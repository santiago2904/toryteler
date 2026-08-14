'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PayoutHint } from '@/components/PayoutHint';
import { PriceInput } from '@/components/PriceInput';
import { createPiece, updatePiece } from '@/lib/studio-actions';
import { uploadImages } from '@/lib/upload';
import { PieceDetail } from '@/lib/types';
import styles from '@/app/studio/studio.module.scss';

/**
 * One form for creating and editing. The only difference is whether it starts
 * with values: duplicating it would mean every future field has to be added
 * twice, and one of the two copies would drift.
 */
export function PieceForm({ piece }: { piece?: PieceDetail }) {
  const router = useRouter();
  const editing = Boolean(piece);

  const [title, setTitle] = useState(piece?.title ?? '');
  const [description, setDescription] = useState(piece?.description ?? '');
  const [story, setStory] = useState(piece?.story ?? '');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(piece?.priceCop ?? 0);
  const [units, setUnits] = useState(piece?.stock ?? 1);
  const [files, setFiles] = useState<File[]>([]);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    // Photographs first: a piece saved without them would need a second pass,
    // and a failed upload must not leave a half-made piece behind.
    let images = piece?.images ?? [];
    if (files.length > 0) {
      setStatus(`Subiendo ${files.length === 1 ? 'la foto' : 'las fotos'}…`);
      const uploaded = await uploadImages(files, 'pieces', (done, total) =>
        setStatus(`Subiendo ${done} de ${total}…`),
      );
      if (uploaded.error) {
        setSaving(false);
        setStatus(null);
        setError(uploaded.error);
        return;
      }
      images = uploaded.ids;
    }

    setStatus('Guardando…');
    const common = {
      title: title.trim(),
      description: description.trim() || null,
      story: story.trim() || null,
      priceCop: price,
      stock: units,
      images,
      ...(note.trim() ? { personalNote: note.trim() } : {}),
    };

    const result = editing
      ? await updatePiece(piece!.id, common)
      : await createPiece(common);

    setSaving(false);
    setStatus(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push('/studio');
  }

  const ready = title.trim().length > 2 && price > 0;

  return (
    <form onSubmit={save} className={styles.form}>
      <Link href="/studio" className="label muted">← Publicado</Link>
      <h1 className="label muted">{editing ? 'Editar pieza' : 'Nueva pieza'}</h1>

      <label htmlFor="titulo">Título</label>
      <input
        id="titulo" name="titulo" autoComplete="off"
        value={title} onChange={(e) => setTitle(e.target.value)} required
      />

      <label htmlFor="desc">Qué es</label>
      <textarea
        id="desc" name="descripcion" rows={3}
        value={description} onChange={(e) => setDescription(e.target.value)}
      />

      <label htmlFor="hist">Procedencia — de dónde viene y por qué importa</label>
      <textarea
        id="hist" name="historia" rows={5}
        value={story} onChange={(e) => setStory(e.target.value)}
      />

      <label htmlFor="nota">Nota personal para quien la compre</label>
      <textarea
        id="nota" name="nota" rows={3}
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={editing ? 'Escribe una nueva para reemplazar la que hay' : undefined}
      />
      {editing && (
        <p className="muted">
          La nota no se muestra aquí: viaja con el pedido de quien compre. Si la dejas
          vacía, se queda la que ya tenía.
        </p>
      )}

      <label htmlFor="precio">Precio</label>
      <PriceInput id="precio" value={price} onChange={setPrice} />
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
      <input
        id="fotos" name="fotos" type="file" multiple accept="image/*"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      {editing && piece!.images.length > 0 && files.length === 0 && (
        <p className="muted">
          Ahora tiene {piece!.images.length}{' '}
          {piece!.images.length === 1 ? 'foto' : 'fotos'}. Subir otras las reemplaza.
        </p>
      )}
      {files.length > 0 && (
        <p className="muted">
          {files.length === 1 ? 'Se subirá 1 foto' : `Se subirán ${files.length} fotos`}
          {editing && piece!.images.length > 0 ? ', reemplazando las de ahora.' : '.'}
        </p>
      )}

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
