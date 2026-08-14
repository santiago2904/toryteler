'use client';

import Link from 'next/link';
import { useRef } from 'react';
import styles from './StudioItemActions.module.scss';

interface Props {
  kind: 'piece' | 'video';
  slug: string;
  title: string;
  /** Units left for a piece, remaining seats for a video. */
  left: number | null;
  /** How many people already bought it. Drives the whole warning. */
  sold: number;
}

/**
 * Edit and unpublish for one item in the list.
 *
 * Unpublishing removes it from the store and nothing else. Anyone who already
 * bought keeps their order and their access — taking that away would be taking
 * back something paid for. The dialog says so explicitly, because the word
 * "unpublish" does not make it obvious.
 *
 * Uses the native <dialog>: it handles focus trapping, Escape and the backdrop
 * without a line of our own code.
 */
export function StudioItemActions({ kind, slug, title, left, sold }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const editHref = `/studio/${kind === 'piece' ? 'pieza' : 'video'}/${slug}`;

  return (
    <div className={styles.actions}>
      <Link href={editHref} className="label">Editar</Link>

      <button type="button" className="link-button" onClick={() => dialog.current?.showModal()}>
        Despublicar
      </button>

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

        <div className={styles.buttons}>
          <button type="button" className="link-button" onClick={() => dialog.current?.close()}>
            Cancelar
          </button>
          <button type="button" disabled>Despublicar</button>
        </div>

        <p className="muted">Despublicar estará disponible cuando conectemos la tienda.</p>
      </dialog>
    </div>
  );
}
