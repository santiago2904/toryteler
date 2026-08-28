import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { ContentItem } from '@/lib/types';
import { ContentEditor } from '@/components/ContentEditor';
import styles from '../studio.module.scss';

export const metadata: Metadata = { title: 'Contenido — Studio' };
export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const items = await apiGet<ContentItem[]>('/admin/content', true);

  return (
    <div className={styles.published}>
      <h1 className="label muted">Contenido</h1>
      <p className="muted">
        Estos son los textos de la tienda que puedes cambiar sin tocar código. Lo que guardes
        se ve reflejado de inmediato.
      </p>

      <ContentEditor items={items} />
    </div>
  );
}
