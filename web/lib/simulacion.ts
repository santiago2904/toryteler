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
    slug: 'chaqueta-gira-2024',
    title: 'Chaqueta de la gira 2024',
    description: 'Chaqueta de trabajo teñida a mano, talla única. Tiene una quemadura en la manga derecha.',
    story:
      'La usé las catorce noches de la gira. La quemadura es de una chispa en el show de Cali, el 3 de octubre. No la mandé a arreglar.',
    priceCop: 2400000,
    images: ['muestra/chaqueta-1', 'muestra/chaqueta-2'],
    available: true,
    soldAt: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'cuaderno-letras',
    title: 'Cuaderno de letras',
    description: 'Cuaderno de 90 hojas con los borradores del segundo disco. Escrito a mano.',
    story:
      'Empezó en un bus entre Medellín y Bogotá. Hay tres canciones que nunca salieron y una lista de mercado en la página 40.',
    priceCop: 900000,
    images: ['muestra/cuaderno-1'],
    available: true,
    soldAt: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    slug: 'micrófono-primer-demo',
    title: 'Micrófono del primer demo',
    description: 'Micrófono dinámico con el que se grabó el primer demo, en 2019.',
    story: 'Lo compré usado por 180 mil pesos. Grabé todo el demo en el cuarto de mi mamá con este aparato.',
    priceCop: 3800000,
    images: ['muestra/microfono-1'],
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
    posterImage: 'muestra/vara-poster',
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
