import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { OrderSummary } from '@/lib/tipos';
import { Imagen } from '@/components/Imagen';
import { formatearFecha, formatearPrecio } from '@/lib/formato';
import estilos from '../studio.module.scss';

export const metadata: Metadata = { title: 'Pedidos — Studio' };

const ESTADO: Record<OrderSummary['status'], string> = {
  pending: 'Confirmando pago',
  paid: 'Pagado',
  failed: 'Pago fallido',
  expired: 'Vencido',
  refunded: 'Reembolsado',
};

export default async function Pedidos() {
  // lazy: mientras no hay API, se listan los mismos pedidos simulados de la
  // cuenta. El endpoint real de administración trae además dirección y correo.
  const pedidos = await apiGet<OrderSummary[]>('/me/orders', true);

  const porDespachar = pedidos.filter((p) => p.status === 'paid' && !p.tracking);

  return (
    <div className={estilos.pedidos}>
      <h1 className="mayusculas tenue">
        Pedidos · {porDespachar.length} por despachar
      </h1>

      <ul className={estilos.listaPedidos}>
        {pedidos.map((pedido) => (
          <li key={pedido.id} className={estilos.pedido}>
            <ul className={estilos.miniaturas}>
              {pedido.items.map((item) => (
                <li key={`${item.kind}-${item.slug}`} className={estilos.miniatura}>
                  {item.image && <Imagen publicId={item.image} alt={item.title} />}
                </li>
              ))}
            </ul>

            <div className={estilos.datos}>
              <span className="mayusculas">{pedido.reference}</span>
              <span className="tenue">{pedido.items.map((i) => i.title).join(' · ')}</span>
              <span>{formatearPrecio(pedido.totalCop)}</span>
              <span className="mayusculas tenue">
                {ESTADO[pedido.status]} · {formatearFecha(pedido.createdAt)}
              </span>

              {pedido.tracking ? (
                <span className="mayusculas tenue">
                  Enviado · {pedido.tracking.carrier} {pedido.tracking.number}
                </span>
              ) : pedido.status === 'paid' ? (
                <form className={estilos.envio}>
                  <label htmlFor={`transportadora-${pedido.id}`}>Transportadora</label>
                  <select id={`transportadora-${pedido.id}`} defaultValue="Servientrega">
                    <option>Servientrega</option>
                    <option>Coordinadora</option>
                    <option>Interrapidísimo</option>
                    <option>TCC</option>
                  </select>

                  <label htmlFor={`guia-${pedido.id}`}>Número de guía</label>
                  <input id={`guia-${pedido.id}`} inputMode="numeric" />

                  <button type="submit" disabled>Marcar enviado</button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
