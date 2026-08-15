import { DropDetail, EntitlementSummary, OrderSummary, PieceDetail } from './types';

/**
 * Fake data so the frontend can be built before the API exists.
 * It lives behind lib/api.ts and disappears the moment API_URL points at
 * something real: no page imports this file.
 *
 * lazy: delete this whole module once the API is up.
 */

export const PIECES: PieceDetail[] = [
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
    stock: 1,
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
    stock: 1,
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
    stock: 0,
    available: false,
    soldAt: '2026-07-28T19:12:00Z',
  },
  {
    id: '44444444-0000-0000-0000-000000000004',
    slug: 'plantilla-de-mezcla',
    title: 'Plantilla de mezcla',
    description: 'Cartón de trabajo con la retícula de la portada dibujada a mano, 30 × 30 cm.',
    story:
      'Antes de que existiera el arte final existió esto: una cuadrícula a lápiz para saber dónde iba cada cosa. Lo usábamos de mantel cuando pedíamos comida al estudio, y se nota.',
    priceCop: 620000,
    images: [
      'v1786679538/unknown-cd-album-mixtape-cover-design-templat-template-a0089f026a71f9722a55157364f22590_screen.jpg',
    ],
    stock: 1,
    available: true,
    soldAt: null,
  },
  {
    id: '55555555-0000-0000-0000-000000000005',
    slug: 'retrato-sin-usar',
    title: 'Retrato sin usar',
    description: 'Copia fotográfica de la sesión de portada, 30 × 30 cm. Sin retoque.',
    story:
      'De esa sesión salieron cuatrocientas fotos y se usó una. Esta es la que yo quería. Me dijeron que se me veía cansado; llevaba dos días sin dormir, así que tenían razón.',
    priceCop: 1750000,
    images: ['v1786679538/rihanna-anti-cover-2016-billboard-1240.jpg'],
    stock: 12,
    available: true,
    soldAt: null,
  },
  {
    id: '66666666-0000-0000-0000-000000000006',
    slug: 'maqueta-de-empaque',
    title: 'Maqueta de empaque',
    description: 'Maqueta física del empaque, armada a mano con cinta y cartón.',
    story:
      'La armé yo en la cocina para ver si el disco cabía. No cabía. Le sobra medio centímetro por un lado y ahí quedó la marca del corte que le hice con un bisturí.',
    priceCop: 1100000,
    images: ['v1786679539/Ecomm-PreLaunch-CD-16STD-1_d64d3610-8393-4a07-95db-959456b7f15c.png'],
    stock: 1,
    available: true,
    soldAt: null,
  },
  {
    id: '77777777-0000-0000-0000-000000000007',
    slug: 'lamina-de-calcomanias',
    title: 'Lámina de calcomanías',
    description: 'Lámina de calcomanías de la primera gira, 30 × 30 cm. Faltan tres.',
    story:
      'Repartimos estas láminas en la primera gira. De la mía faltan tres calcomanías: dos se las pegué a la guitarra y una la perdí en un aeropuerto.',
    priceCop: 480000,
    images: ['v1786679540/TattooYou81.jpg.jpg'],
    stock: 0,
    available: false,
    soldAt: '2026-08-02T22:40:00Z',
  },
  {
    id: '88888888-0000-0000-0000-000000000008',
    slug: 'portada-alterna-vinilo',
    title: 'Portada alterna — vinilo',
    description: 'Portada alterna impresa para la edición en vinilo, 31 × 31 cm.',
    story:
      'Sacamos doscientos vinilos con esta portada y nunca se repitió. Esta es la copia cero, la que sale antes de la tirada para revisar que todo esté bien.',
    priceCop: 2950000,
    images: ['v1786679541/RR8051_The-Travelled-Road.jpg'],
    stock: 5,
    available: true,
    soldAt: null,
  },
  {
    id: '99999999-0000-0000-0000-000000000009',
    slug: 'estudio-de-luz',
    title: 'Estudio de luz',
    description: 'Impresión de un estudio de luz para la portada, 30 × 30 cm.',
    story:
      'Estuvimos una noche entera probando cómo se rompía la luz al pasar por un vidrio. De ahí salió todo lo demás. Es la imagen más antigua del proyecto.',
    priceCop: 4200000,
    images: [
      'v1786682102/6.-Pink-Floyd-_E2_80_98Dark-Side-of-the-Moon-1973-album-art-billboard-1240.jpg',
    ],
    stock: 1,
    available: true,
    soldAt: null,
  },
  {
    id: 'aaaaaaaa-0000-0000-0000-00000000000a',
    slug: 'contraportada-original',
    title: 'Contraportada original',
    description: 'Arte de contraportada con los créditos escritos a máquina, 30 × 30 cm.',
    story:
      'Los créditos los escribí en la máquina de mi abuelo. Hay un nombre mal escrito que nunca corregimos y que sigue mal en todas las ediciones.',
    priceCop: 1350000,
    images: ['v1786682103/63a008f631ae7492a75a001bd0791e8f.jpg'],
    stock: 1,
    available: true,
    soldAt: null,
  },
];

export const DROPS: DropDetail[] = [
  {
    id: 'bbbbbbbb-0000-0000-0000-00000000000b',
    slug: 'ojitos-verdes-maqueta',
    title: 'Ojitos verdes — máster de maqueta',
    description:
      'La maqueta original, sin mezclar. Se oye el conteo, se oye la silla, y en el segundo verso me equivoco y sigo. Es la primera vez que la canción existió contain.',
    priceCop: 25000,
    posterImage: 'v1786679539/800w-KKOAYz5esa4.jpg',
    capacity: 50,
    remaining: 12,
    soldOut: false,
    viewWindowHours: 24,
  },
  {
    id: 'bbbbbbbb-0000-0000-0000-00000000000c',
    slug: 'casa-42-maqueta',
    title: 'Casa 42 — máster de maqueta',
    description:
      'Grabada en la casa que le da el nombre, con un micrófono prestado y la windowHours abierta. Al final se oye pasar una moto y por eso nunca la usamos.',
    priceCop: 25000,
    posterImage: 'v1786682103/63a008f631ae7492a75a001bd0791e8f.jpg',
    capacity: 30,
    remaining: 0,
    soldOut: true,
    viewWindowHours: 24,
  },
  {
    id: 'bbbbbbbb-0000-0000-0000-00000000000d',
    slug: 'como-conoci-a-gabi',
    title: 'Cómo conocí a Gabi',
    description:
      'Siete minutos contando cómo nos conocimos, sin editar y sin guion. Es la historia que está detrás de medio disco y que nunca he contado en una entrevista.',
    priceCop: 4000,
    posterImage: 'v1786679541/RR8051_The-Travelled-Road.jpg',
    capacity: 200,
    remaining: 147,
    soldOut: false,
    viewWindowHours: 48,
  },
];

export const ORDERS: OrderSummary[] = [
  {
    id: 'cccccccc-0000-0000-0000-00000000000c',
    reference: 'ord_a1b2c3d4e5f6',
    status: 'paid',
    totalCop: 2400000,
    createdAt: '2026-08-10T14:30:00Z',
    items: [
      {
        kind: 'piece',
        slug: 'boceto-portada-primer-disco',
        title: 'Boceto de portada — primer disco',
        image: 'v1786679539/800w-KKOAYz5esa4.jpg',
        signed: true,
      },
    ],
    tracking: {
      number: '99120384',
      carrier: 'Servientrega',
      url: 'https://www.servientrega.com/wps/portal/rastreo-envio?guia=99120384',
    },
  },
  {
    // Order with several items and no shipment yet: physical piece plus video.
    id: 'cccccccc-0000-0000-0000-00000000000e',
    reference: 'ord_9f8e7d6c5b4a',
    status: 'paid',
    totalCop: 925000,
    createdAt: '2026-08-13T20:05:00Z',
    items: [
      {
        kind: 'piece',
        slug: 'prueba-de-color',
        title: 'Prueba de color',
        image: 'v1786679537/3YV2PTJAVFGCVJK5IC6RJYY6EA.jpg',
        signed: false,
      },
      {
        kind: 'drop',
        slug: 'ojitos-verdes-maqueta',
        title: 'Ojitos verdes — máster de maqueta',
        image: 'v1786679539/800w-KKOAYz5esa4.jpg',
        signed: false,
      },
    ],
    tracking: null,
  },
];

// The three possible states of an entitlement, so all of them can be seen in
// /cuenta. Dates are computed on the fly: a fixed date would make the "open"
// entitlement look expired a few hours after writing this.
const HOUR = 3_600_000;

export const ENTITLEMENTS: EntitlementSummary[] = [
  {
    id: 'dddddddd-0000-0000-0000-00000000000d',
    dropSlug: 'ojitos-verdes-maqueta',
    dropTitle: 'Ojitos verdes — máster de maqueta',
    firstPlayedAt: null,
    expiresAt: null,
    state: 'unopened',
  },
  {
    id: 'dddddddd-0000-0000-0000-00000000000e',
    dropSlug: 'casa-42-maqueta',
    dropTitle: 'Casa 42 — máster de maqueta',
    firstPlayedAt: new Date(Date.now() - 20.7 * HOUR).toISOString(),
    expiresAt: new Date(Date.now() + 3.3 * HOUR).toISOString(),
    state: 'open',
  },
  {
    id: 'dddddddd-0000-0000-0000-00000000000f',
    dropSlug: 'como-conoci-a-gabi',
    dropTitle: 'Cómo conocí a Gabi',
    firstPlayedAt: new Date(Date.now() - 9 * 24 * HOUR).toISOString(),
    expiresAt: new Date(Date.now() - 7 * 24 * HOUR).toISOString(),
    state: 'consumed',
  },
];

/**
 * Video files for the mock. In production this never lives in a public type:
 * the URL arrives signed and short-lived after the window is opened, so having
 * it here would mean anyone could watch without paying.
 *
 * lazy: goes away with the rest of this module.
 */
export const MOCK_VIDEO_URLS: Record<string, string> = {
  'ojitos-verdes-maqueta': 'https://res.cloudinary.com/dtiuqixet/video/upload/v1786687587/sangre.mp4',
  'casa-42-maqueta': 'https://res.cloudinary.com/dtiuqixet/video/upload/v1786687585/que-donar.mp4',
  'como-conoci-a-gabi': 'https://res.cloudinary.com/dtiuqixet/video/upload/v1786687587/sangre.mp4',
};
