'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { setListed } from '@/lib/studio-actions';
import styles from './StudioItemActions.module.scss';

interface Props {
  kind: 'piece' | 'video';
  id: string;
  slug: string;
  title: string;
  /** Whether it is in the shop right now. A draft has never been published. */
  listed: boolean;
  /** Units left for a piece, remaining seats for a video. */
  left: number | null;
  /** How many people already bought it. Drives the whole warning. */
  sold: number;
}

/**
 * Edit, publish and unpublish for one item in the list.
 *
 * Unpublishing removes it from the store and nothing else. Anyone who already
 * bought keeps their order and their access — taking that away would be taking
 * back something paid for. The dialog says so explicitly, because the word
 * "unpublish" does not make it obvious.
 *
 * Publishing needs no confirmation: it is undone by the button next to it.
 *
 * Uses the native <dialog>: it handles focus trapping, Escape and the backdrop
 * without a line of our own code.
 */
export function StudioItemActions({ kind, id, slug, title, listed, left, sold }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editHref = `/studio/${kind === 'piece' ? 'pieza' : 'video'}/${slug}`;

  async function change(next: boolean) {
    setWorking(true);
    setError(null);

    const result = await setListed(kind === 'piece' ? 'piece' : 'drop', id, next);
    setWorking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    dialog.current?.close();
    router.refresh();
  }

  return (
    <div className={styles.actions}>
      <Link href={editHref} className="label">Editar</Link>

      {listed ? (
        <button
          type="button"
          className="link-button"
          onClick={() => dialog.current?.showModal()}
          disabled={working}
        >
          Despublicar
        </button>
      ) : (
        <button type="button" onClick={() => void change(true)} disabled={working}>
          {working ? 'Publicando…' : 'Publicar'}
        </button>
      )}

      {error && !listed && <span role="alert" className={styles.error}>{error}</span>}

      <dialog ref={dialog} className={styles.dialog}>
        <h2 className="label">Despublicar «{title}»</h2>

        <p>
          {kind === 'piece'
            ? 'Deja de aparecer en la tienda y nadie podrá comprarla.'
            : 'Deja de aparecer en la tienda y nadie más podrá comprarlo.'}
        </p>

        {sold > 0 && (
          <p>
            {kind === 'piece'
              ? sold === 1
                ? 'La persona que ya la compró la recibe igual: su pedido sigue su curso.'
                : `Las ${sold} personas que ya la compraron la reciben igual: sus pedidos siguen su curso.`
              : sold === 1
                ? 'Una persona ya lo compró y conserva su acceso: podrá verlo aunque lo despubliques.'
                : `${sold} personas ya lo compraron y conservan su acceso: podrán verlo aunque lo despubliques.`}
          </p>
        )}

        {left !== null && left > 0 && (
          <p className="muted">
            {kind === 'piece'
              ? left === 1
                ? 'Queda una unidad sin vender.'
                : `Quedan ${left} unidades sin vender.`
              : left === 1
                ? 'Queda un cupo sin vender que ya no se venderá.'
                : `Quedan ${left} cupos sin vender que ya no se venderán.`}
          </p>
        )}

        <p className="muted">Puedes volver a publicarlo cuando quieras.</p>

        {error && <p role="alert" className={styles.error}>{error}</p>}

        <div className={styles.buttons}>
          <button
            type="button"
            className="link-button"
            onClick={() => dialog.current?.close()}
            disabled={working}
          >
            Cancelar
          </button>
          <button type="button" onClick={() => void change(false)} disabled={working}>
            {working ? 'Despublicando…' : 'Despublicar'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
