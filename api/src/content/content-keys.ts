/**
 * Los 43 textos editoriales de la tienda. El texto de aquí es el que se
 * usa el día que nadie ha cambiado nada — content_overrides solo guarda
 * las claves que en efecto se cambiaron.
 *
 * Tres textos con una parte dinámica incrustada (el título de la pieza en
 * el checkbox de firma, la fecha en el cierre de ventana, las horas en el
 * aviso antes de reproducir) quedan fuera a propósito: un texto plano no
 * puede sustituirlos sin perder esa parte.
 */
export interface ContentKeyDef {
  key: string;
  section: string;
  defaultValue: string;
}

export const CONTENT_KEYS: ContentKeyDef[] = [
  { key: 'home.empty.body', section: 'Home', defaultValue: 'Aún no hay nada publicado.' },

  { key: 'artist.meta.title', section: 'Artista', defaultValue: 'Toryteler — quién es' },
  { key: 'artist.meta.description', section: 'Artista', defaultValue: 'Quién es el artista detrás de las piezas.' },
  { key: 'artist.role', section: 'Artista', defaultValue: 'Músico y archivista de lo suyo' },
  { key: 'artist.bio.paragraph1', section: 'Artista', defaultValue: 'Grabo desde 2019, casi siempre de noche y casi siempre en cuartos prestados. Lo que hago no cabe en un disco: cabe en las cajas donde guardo lo que sobró.' },
  { key: 'artist.bio.paragraph2', section: 'Artista', defaultValue: 'Esta tienda existe porque me cansé de que esas cajas se quedaran cerradas. Cada pieza que está aquí estuvo antes en un estudio, en un bus o en el piso de mi casa, y tiene una historia que puedo contar entera.' },
  { key: 'artist.bio.paragraph3', section: 'Artista', defaultValue: 'No hay reediciones. Lo que se va, se fue.' },
  { key: 'artist.socials.title', section: 'Artista', defaultValue: 'Dónde encontrarlo' },

  { key: 'site.meta.description', section: 'Marca global', defaultValue: 'Piezas únicas y contenido personal del artista.' },
  { key: 'site.nav.homeLabel', section: 'Marca global', defaultValue: 'La casa de Tory' },

  { key: 'cart.empty.body', section: 'Carrito', defaultValue: 'No tienes nada en el carrito.' },
  { key: 'cart.empty.cta', section: 'Carrito', defaultValue: 'Ver la casa de Tory' },
  { key: 'cart.contractNotice.body', section: 'Carrito', defaultValue: 'Al pagar firmarás el contrato de compraventa de las piezas físicas. Necesitarás tu cédula a mano.' },

  { key: 'checkout.empty.body', section: 'Checkout', defaultValue: 'No tienes nada en el carrito.' },
  { key: 'checkout.emailNotice.body', section: 'Checkout', defaultValue: 'Ahí te llegan el recibo y, si compras una pieza, el código para firmar el contrato.' },
  { key: 'checkout.signature.note', section: 'Checkout', defaultValue: 'Sin costo. Firmarla toma unos días más antes de que salga el envío.' },
  { key: 'checkout.addressNotice.body', section: 'Checkout', defaultValue: 'En el siguiente paso firmarás el contrato de compraventa. Ten a mano tu cédula.' },

  { key: 'checkout.invalidLink.body', section: 'Contrato', defaultValue: 'Este enlace no lleva a ningún pedido.' },
  { key: 'checkout.contract.intro', section: 'Contrato', defaultValue: 'Estos datos van en el documento que vas a firmar, así que tienen que coincidir con tu cédula.' },
  { key: 'checkout.contract.otpIntro', section: 'Contrato', defaultValue: 'Te enviamos un código de seis dígitos a tu correo. Lee el documento y fírmalo con ese código.' },
  { key: 'checkout.contract.mustOpenNotice', section: 'Contrato', defaultValue: 'Abre el documento para poder confirmarlo.' },
  { key: 'checkout.contract.signBeforePayNotice', section: 'Contrato', defaultValue: 'Firmas antes de pagar. Si el pago no se completa, el contrato queda anulado.' },

  { key: 'checkout.pay.gatewayNotice', section: 'Pagar', defaultValue: 'Te llevamos a la pasarela para completar el pago. Volverás aquí al terminar.' },
  { key: 'checkout.pay.securityNotice', section: 'Pagar', defaultValue: 'Los datos de tu tarjeta no pasan por esta tienda.' },

  { key: 'checkout.result.pending.title', section: 'Resultado del pago', defaultValue: 'Confirmando tu pago' },
  { key: 'checkout.result.pending.body', section: 'Resultado del pago', defaultValue: 'La pasarela todavía no nos ha confirmado el cobro. Esto suele tardar segundos; te escribimos al correo en cuanto quede.' },
  { key: 'checkout.result.paid.title', section: 'Resultado del pago', defaultValue: 'Listo' },
  { key: 'checkout.result.paid.body', section: 'Resultado del pago', defaultValue: 'Tu compra quedó confirmada. Te enviamos el correo con el detalle y, si compraste una pieza, el contrato firmado.' },
  { key: 'checkout.result.failed.title', section: 'Resultado del pago', defaultValue: 'El pago no se completó' },
  { key: 'checkout.result.failed.body', section: 'Resultado del pago', defaultValue: 'No te cobramos nada y lo que habías apartado volvió a la tienda. Puedes intentarlo otra vez.' },
  { key: 'checkout.result.expired.title', section: 'Resultado del pago', defaultValue: 'El pedido venció' },
  { key: 'checkout.result.expired.body', section: 'Resultado del pago', defaultValue: 'Pasó demasiado tiempo sin completar el pago, así que soltamos lo que tenías apartado.' },
  { key: 'checkout.result.refunded.title', section: 'Resultado del pago', defaultValue: 'Te devolvimos el dinero' },
  { key: 'checkout.result.refunded.body', section: 'Resultado del pago', defaultValue: 'Alguien se adelantó con lo que compraste, así que reembolsamos el valor completo.' },
  { key: 'checkout.result.notFound.title', section: 'Resultado del pago', defaultValue: 'No encontramos ese pedido' },
  { key: 'checkout.result.notFound.body', section: 'Resultado del pago', defaultValue: 'Puede que sea de otra cuenta. Mira tus pedidos para comprobarlo.' },

  { key: 'piece.detail.includesNote', section: 'Pieza', defaultValue: 'Incluye una nota escrita por el artista y el contrato de compraventa firmado.' },
  { key: 'piece.detail.soldBody', section: 'Pieza', defaultValue: 'Esta pieza ya encontró dueño.' },
  { key: 'piece.detail.notForSaleBody', section: 'Pieza', defaultValue: 'No está a la venta.' },

  { key: 'drop.detail.soldOutBody', section: 'Drop', defaultValue: 'Ya no quedan seats.' },

  { key: 'watch.closed.title', section: 'Reproductor', defaultValue: 'Tu ventana se cerró.' },
  { key: 'watch.intro.title', section: 'Reproductor', defaultValue: 'Antes de reproducir' },
  { key: 'watch.intro.warning', section: 'Reproductor', defaultValue: 'Cuando la ventana se cierre, este video no vuelve a abrirse. Ocurre una sola vez.' },
];

export const CONTENT_KEY_SET = new Set(CONTENT_KEYS.map((k) => k.key));
