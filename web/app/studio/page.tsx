import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { DropDetail, PieceSummary } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { formatearPrecio } from '@/lib/formato';
import estilos from './studio.module.scss';

export const metadata: Metadata = { title: 'Publicado — Studio' };

export default async function Publicado() {
  const [piezas, videos] = await Promise.all([
    apiGet<PieceSummary[]>('/pieces'),
    apiGet<DropDetail[]>('/drops'),
  ]);

  return (
    <div className={estilos.publicado}>
      <div className={estilos.acciones}>
        <h1 className="mayusculas tenue">
          {piezas.length} piezas · {videos.length} videos
        </h1>
        <div className={estilos.botones}>
          <Link href="/studio/nuevo/pieza"><button type="button">Nueva pieza</button></Link>
          <Link href="/studio/nuevo/video"><button type="button">Nuevo video</button></Link>
        </div>
      </div>

      <section className={estilos.grupoLista}>
        <h2 className="mayusculas tenue">Piezas</h2>
        <ul className={estilos.listaPedidos}>
          {piezas.map((pieza) => (
            <li key={pieza.slug} className={estilos.articulo}>
              <div className={estilos.miniatura}>
                {pieza.images[0] && <Imagen publicId={pieza.images[0]} alt={pieza.title} />}
              </div>

              <div className={estilos.datos}>
                <Link href={`/piezas/${pieza.slug}`} className="mayusculas">{pieza.title}</Link>
                <span>{formatearPrecio(pieza.priceCop)}</span>
                <span className="mayusculas tenue">
                  {pieza.stock === 0
                    ? 'Agotada'
                    : pieza.stock === 1
                      ? 'Última unidad'
                      : `${pieza.stock} unidades`}
                </span>
              </div>

              <div className={estilos.gestion}>
                <button type="button" className="enlace" disabled>Editar</button>
                <button type="button" className="enlace" disabled>Despublicar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={estilos.grupoLista}>
        <h2 className="mayusculas tenue">Videos</h2>
        <ul className={estilos.listaPedidos}>
          {videos.map((video) => (
            <li key={video.slug} className={estilos.articulo}>
              <div className={estilos.miniatura}>
                {video.posterImage && <Imagen publicId={video.posterImage} alt={video.title} />}
              </div>

              <div className={estilos.datos}>
                <Link href={`/drops/${video.slug}`} className="mayusculas">{video.title}</Link>
                <span>{formatearPrecio(video.priceCop)}</span>
                <span className="mayusculas tenue">
                  {video.soldOut
                    ? 'Agotado'
                    : video.capacity === null
                      ? 'Sin límite de cupos'
                      : `${video.remaining} de ${video.capacity} cupos`}
                  {' · '}
                  ventana de {video.viewWindowHours} h
                </span>
              </div>

              <div className={estilos.gestion}>
                <button type="button" className="enlace" disabled>Editar</button>
                <button type="button" className="enlace" disabled>Despublicar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
