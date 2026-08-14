import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { EntitlementSummary, OrderSummary } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { formatearFecha, formatearPrecio, tiempoRestante } from '@/lib/formato';
import estilos from './page.module.scss';

export const metadata: Metadata = { title: 'Tu cuenta — Toryteler' };

const ESTADO_PEDIDO: Record<OrderSummary['status'], string> = {
  pending: 'Confirmando pago',
  paid: 'Pagado',
  failed: 'Pago fallido',
  expired: 'Vencido',
  refunded: 'Reembolsado',
};

/**
 * «Quedan» está reservado para los cupos de un video en la tienda. Usar la
 * misma palabra para el tiempo restante hacía que dos cosas distintas se
 * leyeran igual.
 */
function textoAcceso(acceso: EntitlementSummary): string {
  if (acceso.state === 'unopened') return 'Sin abrir';
  if (acceso.state === 'open') return `Se cierra en ${tiempoRestante(acceso.expiresAt!)}`;
  return `Visto ${formatearFecha(acceso.firstPlayedAt!)}`;
}

export default async function Cuenta() {
  const [pedidos, accesos] = await Promise.all([
    apiGet<OrderSummary[]>('/me/orders', true),
    apiGet<EntitlementSummary[]>('/me/entitlements', true),
  ]);

  return (
    <div className={estilos.cuenta}>
      <section className={estilos.seccion}>
        <h1 className="mayusculas tenue">Pedidos</h1>
        {pedidos.length === 0 ? (
          <p className="tenue">Todavía no tienes pedidos.</p>
        ) : (
          <ul className={estilos.lista}>
            {pedidos.map((pedido) => (
              <li key={pedido.id} className={estilos.pedido}>
                <ul className={estilos.miniaturas}>
                  {pedido.items.map((item) => (
                    <li key={`${item.kind}-${item.slug}`} className={estilos.miniatura}>
                      <Link href={`/${item.kind === 'piece' ? 'piezas' : 'drops'}/${item.slug}`}>
                        {item.image ? (
                          <Imagen publicId={item.image} alt={item.title} />
                        ) : (
                          <span className="mayusculas tenue">{item.title}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className={estilos.datos}>
                  <span className="mayusculas">{pedido.reference}</span>
                  <span className="tenue">
                    {pedido.items.map((item) => item.title).join(' · ')}
                  </span>
                  <span>{formatearPrecio(pedido.totalCop)}</span>
                  <span className="mayusculas tenue">
                    {ESTADO_PEDIDO[pedido.status]} · {formatearFecha(pedido.createdAt)}
                  </span>

                  {pedido.tracking && (
                    <span className="mayusculas">
                      {pedido.tracking.url ? (
                        <a href={pedido.tracking.url} target="_blank" rel="noopener noreferrer">
                          Rastrear · {pedido.tracking.carrier} {pedido.tracking.number}
                        </a>
                      ) : (
                        <span className="tenue">
                          {pedido.tracking.carrier} {pedido.tracking.number}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={estilos.seccion}>
        <div className={estilos.encabezado}>
          <h1 className="mayusculas tenue">Videos</h1>
          {/* La regla no es evidente y de ella depende que alguien no pierda
              lo que pagó. Va aquí, no en unos términos que nadie abre. */}
          <p className={`${estilos.nota} tenue`}>
            Cada video se ve una sola vez. Al darle play se abre tu ventana y, mientras esté
            abierta, puedes entrar y salir cuantas veces quieras. Cuando se cierra, no vuelve
            a abrirse.
          </p>
        </div>
        {accesos.length === 0 ? (
          <p className="tenue">Todavía no tienes accesos.</p>
        ) : (
          <ul className={estilos.lista}>
            {accesos.map((acceso) => (
              <li key={acceso.id} className={estilos.fila}>
                <span className="mayusculas">{acceso.dropTitle}</span>
                <span className="mayusculas tenue">{textoAcceso(acceso)}</span>
                {acceso.state !== 'consumed' && (
                  <Link href={`/ver/${acceso.id}`} className="mayusculas">
                    {acceso.state === 'unopened' ? 'Abrir' : 'Continuar'}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
