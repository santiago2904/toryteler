import { DropDetail, EntitlementSummary, OrderSummary, PieceDetail } from './tipos';

/**
 * Datos de mentira para desarrollar el front antes de que exista la API.
 * Vive detrás de lib/api.ts y desaparece en cuanto API_URL apunte a algo real:
 * ninguna página importa este archivo.
 *
 * lazy: borrar este módulo completo cuando la API esté en pie.
 */

export const PIEZAS: PieceDetail[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'boceto-portada-primer-disco',
    title: 'Boceto de portada — primer disco',
    description:
      'Impresión de trabajo sobre papel mate, 30 × 30 cm. Marcas de lápiz en el margen inferior y una anotación de puño y letra en el reverso.',
    story:
      'Es la versión que llevé a la reunión donde decidimos la portada. Perdió por dos votos. La guardé enrollada detrás de un parlante durante seis años y tiene la esquina doblada por eso.',
    priceCop: 2400000,
    images: ['v1786679539/800w-KKOAYz5esa4.jpg'],
    available: true,
    soldAt: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'prueba-de-color',
    title: 'Prueba de color',
    description:
      'Prueba de imprenta, 30 × 30 cm, con las correcciones de tono marcadas en rojo por el diseñador.',
    story:
      'Hicimos catorce pruebas hasta dar con el color. Esta es la número nueve, la que casi queda. Todavía se ven las indicaciones de cuánto había que bajarle al azul.',
    priceCop: 900000,
    images: ['v1786679537/3YV2PTJAVFGCVJK5IC6RJYY6EA.jpg'],
    available: true,
    soldAt: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'portada-descartada',
    title: 'Portada descartada',
    description: 'Única copia impresa de una portada que nunca se usó, 30 × 30 cm.',
    story:
      'Esta portada existió durante once días. Se imprimió una sola vez, para verla en papel, y al día siguiente cambiamos de idea. Nadie fuera del estudio la había visto hasta ahora.',
    priceCop: 3800000,
    images: ['v1786679539/250px-Taylor_Swift_-_1989.png.png'],
    available: false,
    soldAt: '2026-07-28T19:12:00Z',
  },
];

export const DROPS: DropDetail[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    slug: 'la-vara',
    title: 'La vara',
    description: 'Cuatro minutos hablando de por qué casi no saco el disco. Grabado a las 3 de la mañana.',
    priceCop: 4000,
    posterImage: 'v1786679537/3YV2PTJAVFGCVJK5IC6RJYY6EA.jpg',
    capacity: 50,
    remaining: 12,
    soldOut: false,
    viewWindowHours: 24,
  },
];

export const PEDIDOS: OrderSummary[] = [
  {
    id: '55555555-5555-5555-5555-555555555555',
    reference: 'ord_a1b2c3d4e5f6',
    status: 'paid',
    totalCop: 2400000,
    createdAt: '2026-08-10T14:30:00Z',
    trackingNumber: 'GUIA-99120384',
  },
];

export const ACCESOS: EntitlementSummary[] = [
  {
    id: '66666666-6666-6666-6666-666666666666',
    dropSlug: 'la-vara',
    dropTitle: 'La vara',
    firstPlayedAt: null,
    expiresAt: null,
    state: 'unopened',
  },
];
