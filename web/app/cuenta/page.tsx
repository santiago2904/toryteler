import Link from 'next/link';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { EntitlementSummary, OrderSummary } from '@/lib/tipos';
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

function textoAcceso(acceso: EntitlementSummary): string {
  if (acceso.state === 'unopened') return 'Sin abrir';
  if (acceso.state === 'open') return `Quedan ${tiempoRestante(acceso.expiresAt!)}`;
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
              <li key={pedido.id} className={estilos.fila}>
                <span className="mayusculas">{pedido.reference}</span>
                <span>{formatearPrecio(pedido.totalCop)}</span>
                <span className="mayusculas tenue">{ESTADO_PEDIDO[pedido.status]}</span>
                <span className="tenue">{formatearFecha(pedido.createdAt)}</span>
                {pedido.trackingNumber && (
                  <span className="tenue">Guía {pedido.trackingNumber}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={estilos.seccion}>
        <h1 className="mayusculas tenue">Accesos</h1>
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
