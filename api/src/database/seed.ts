import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';

/**
 * Fills an empty database with the shop as it was mocked up in the frontend.
 *
 * Two things it is not. It is not fixtures for the tests — those build exactly
 * what they need and truncate afterwards. And it is not a migration: nothing
 * here is part of the schema, and a fresh deployment must not run it.
 *
 * Running it twice changes nothing, which matters because the reason to run it
 * again is usually that the last run half worked.
 *
 * THE IMAGES ARE COVERS OF REAL RECORDS, credited to an artist who does not
 * exist. They are here to see the grid with something in it and they cannot
 * survive into a public shop.
 */

/** The one Cloudflare asset that exists, so every video actually plays. */
const VIDEO_ASSET = 'd95d44921471579a2f1e0a3ae1144b6f';

const ARTIST = 'tory@toryteler.co';
const BUYER = 'comprador@toryteler.co';

interface SeedPiece {
  slug: string;
  title: string;
  description: string;
  story: string;
  priceUsdCents: number;
  image: string;
  stock: number;
  /** Days ago it was published: the catalogue is ordered by this. */
  published: number;
  soldAt?: string;
}

const PIECES: SeedPiece[] = [
  {
    slug: 'boceto-portada-primer-disco',
    title: 'Boceto de portada — primer disco',
    description:
      'Impresión de trabajo sobre papel mate, 30 × 30 cm. Marcas de lápiz en el margen inferior y una anotación de puño y letra en el reverso.',
    story:
      'Es la versión que llevé a la reunión donde decidimos la portada. Perdió por dos votos. La guardé enrollada detrás de un parlante durante seis años y tiene la esquina doblada por eso.',
    priceUsdCents: 24000,
    image: 'v1786679539/800w-KKOAYz5esa4.jpg',
    stock: 1,
    published: 1,
  },
  {
    slug: 'prueba-de-color',
    title: 'Prueba de color',
    description:
      'Prueba de imprenta, 30 × 30 cm, con las correcciones de tono marcadas en rojo por el diseñador.',
    story:
      'Hicimos catorce pruebas hasta dar con el color. Esta es la número nueve, la que casi queda. Todavía se ven las indicaciones de cuánto había que bajarle al azul.',
    priceUsdCents: 9000,
    image: 'v1786679537/3YV2PTJAVFGCVJK5IC6RJYY6EA.jpg',
    stock: 1,
    published: 2,
  },
  {
    slug: 'portada-descartada',
    title: 'Portada descartada',
    description: 'Única copia impresa de una portada que nunca se usó, 30 × 30 cm.',
    story:
      'Esta portada existió durante once días. Se imprimió una sola vez, para verla en papel, y al día siguiente cambiamos de idea. Nadie fuera del estudio la había visto hasta ahora.',
    priceUsdCents: 38000,
    image: 'v1786679539/250px-Taylor_Swift_-_1989.png.png',
    stock: 0,
    published: 3,
    soldAt: '2026-07-28T19:12:00Z',
  },
  {
    slug: 'plantilla-de-mezcla',
    title: 'Plantilla de mezcla',
    description: 'Cartón de trabajo con la retícula de la portada dibujada a mano, 30 × 30 cm.',
    story:
      'Antes de que existiera el arte final existió esto: una cuadrícula a lápiz para saber dónde iba cada cosa. Lo usábamos de mantel cuando pedíamos comida al estudio, y se nota.',
    priceUsdCents: 6200,
    image:
      'v1786679538/unknown-cd-album-mixtape-cover-design-templat-template-a0089f026a71f9722a55157364f22590_screen.jpg',
    stock: 1,
    published: 4,
  },
  {
    slug: 'retrato-sin-usar',
    title: 'Retrato sin usar',
    description: 'Copia fotográfica de la sesión de portada, 30 × 30 cm. Sin retoque.',
    story:
      'De esa sesión salieron cuatrocientas fotos y se usó una. Esta es la que yo quería. Me dijeron que se me veía cansado; llevaba dos días sin dormir, así que tenían razón.',
    priceUsdCents: 17500,
    image: 'v1786679538/rihanna-anti-cover-2016-billboard-1240.jpg',
    stock: 12,
    published: 5,
  },
  {
    slug: 'maqueta-de-empaque',
    title: 'Maqueta de empaque',
    description: 'Maqueta física del empaque, armada a mano con cinta y cartón.',
    story:
      'La armé yo en la cocina para ver si el disco cabía. No cabía. Le sobra medio centímetro por un lado y ahí quedó la marca del corte que le hice con un bisturí.',
    priceUsdCents: 11000,
    image: 'v1786679539/Ecomm-PreLaunch-CD-16STD-1_d64d3610-8393-4a07-95db-959456b7f15c.png',
    stock: 1,
    published: 6,
  },
  {
    slug: 'lamina-de-calcomanias',
    title: 'Lámina de calcomanías',
    description: 'Lámina de calcomanías de la primera gira, 30 × 30 cm. Faltan tres.',
    story:
      'Repartimos estas láminas en la primera gira. De la mía faltan tres calcomanías: dos se las pegué a la guitarra y una la perdí en un aeropuerto.',
    priceUsdCents: 4800,
    image: 'v1786679540/TattooYou81.jpg.jpg',
    stock: 0,
    published: 7,
    soldAt: '2026-08-02T22:40:00Z',
  },
  {
    slug: 'portada-alterna-vinilo',
    title: 'Portada alterna — vinilo',
    description: 'Portada alterna impresa para la edición en vinilo, 31 × 31 cm.',
    story:
      'Sacamos doscientos vinilos con esta portada y nunca se repitió. Esta es la copia cero, la que sale antes de la tirada para revisar que todo esté bien.',
    priceUsdCents: 29500,
    image: 'v1786679541/RR8051_The-Travelled-Road.jpg',
    stock: 5,
    published: 8,
  },
  {
    slug: 'estudio-de-luz',
    title: 'Estudio de luz',
    description: 'Impresión de un estudio de luz para la portada, 30 × 30 cm.',
    story:
      'Estuvimos una noche entera probando cómo se rompía la luz al pasar por un vidrio. De ahí salió todo lo demás. Es la imagen más antigua del proyecto.',
    priceUsdCents: 42000,
    image: 'v1786682102/6.-Pink-Floyd-_E2_80_98Dark-Side-of-the-Moon-1973-album-art-billboard-1240.jpg',
    stock: 1,
    published: 9,
  },
  {
    slug: 'contraportada-original',
    title: 'Contraportada original',
    description: 'Arte de contraportada con los créditos escritos a máquina, 30 × 30 cm.',
    story:
      'Los créditos los escribí en la máquina de mi abuelo. Hay un nombre mal escrito que nunca corregimos y que sigue mal en todas las ediciones.',
    priceUsdCents: 13500,
    image: 'v1786682103/63a008f631ae7492a75a001bd0791e8f.jpg',
    stock: 1,
    published: 10,
  },
];

interface SeedDrop {
  slug: string;
  title: string;
  description: string;
  priceUsdCents: number;
  posterImage: string;
  capacity: number;
  windowHours: number;
  /** Seats already taken, so the shop shows a real number and not just capacity. */
  sold: number;
}

const DROPS: SeedDrop[] = [
  {
    slug: 'ojitos-verdes-maqueta',
    title: 'Ojitos verdes — máster de maqueta',
    description:
      'La maqueta original, sin mezclar. Se oye el conteo, se oye la silla, y en el segundo verso me equivoco y sigo. Es la primera vez que la canción existió entera.',
    priceUsdCents: 250,
    posterImage: 'v1786679539/800w-KKOAYz5esa4.jpg',
    capacity: 50,
    windowHours: 24,
    sold: 38,
  },
  {
    slug: 'casa-42-maqueta',
    title: 'Casa 42 — máster de maqueta',
    description:
      'Grabada en la casa que le da el nombre, con un micrófono prestado y la ventana abierta. Al final se oye pasar una moto y por eso nunca la usamos.',
    priceUsdCents: 250,
    posterImage: 'v1786682103/63a008f631ae7492a75a001bd0791e8f.jpg',
    capacity: 30,
    windowHours: 24,
    sold: 30,
  },
  {
    slug: 'como-conoci-a-gabi',
    title: 'Cómo conocí a Gabi',
    description:
      'Siete minutos contando cómo nos conocimos, sin editar y sin guion. Es la historia que está detrás de medio disco y que nunca he contado en una entrevista.',
    priceUsdCents: 40,
    posterImage: 'v1786679541/RR8051_The-Travelled-Road.jpg',
    capacity: 200,
    windowHours: 48,
    sold: 53,
  },
];

async function seed(ds: DataSource): Promise<void> {
  const artistId = await upsertUser(ds, ARTIST, 'Tory', true);
  const buyerId = await upsertUser(ds, BUYER, 'Comprador de prueba', false);

  for (const piece of PIECES) {
    await ds.query(
      `INSERT INTO pieces (slug, title, description, story, personal_note, price_usd_cents,
                           images, stock, status, published_at, sold_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available',
               now() - make_interval(days => $9), $10)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         story = EXCLUDED.story, price_usd_cents = EXCLUDED.price_usd_cents,
         images = EXCLUDED.images, stock = EXCLUDED.stock,
         status = EXCLUDED.status, sold_at = EXCLUDED.sold_at`,
      [
        piece.slug,
        piece.title,
        piece.description,
        piece.story,
        `Gracias por quedarte con esto. Espero que te dure más de lo que me duró a mí.\n\nTory`,
        piece.priceUsdCents,
        JSON.stringify([piece.image]),
        piece.stock,
        piece.published,
        piece.soldAt ?? null,
      ],
    );
  }

  const dropIds = new Map<string, string>();

  for (const drop of DROPS) {
    const [row] = await ds.query(
      `INSERT INTO drops (slug, title, description, price_usd_cents, video_asset_id, poster_image,
                          capacity, view_window_hours, status, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available', now() - make_interval(days => $9))
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         price_usd_cents = EXCLUDED.price_usd_cents, video_asset_id = EXCLUDED.video_asset_id,
         poster_image = EXCLUDED.poster_image, capacity = EXCLUDED.capacity,
         view_window_hours = EXCLUDED.view_window_hours
       RETURNING id`,
      [
        drop.slug,
        drop.title,
        drop.description,
        drop.priceUsdCents,
        VIDEO_ASSET,
        drop.posterImage,
        drop.capacity,
        drop.windowHours,
        DROPS.indexOf(drop) + 1,
      ],
    );
    dropIds.set(drop.slug, row.id);
  }

  // The buyer's own seats come first, and the invented public fills what is
  // left. The other way round, a sold-out drop ended up with one entitlement
  // more than its capacity — a state the shop itself could never reach.
  await giveBuyerHistory(ds, buyerId);

  for (const drop of DROPS) {
    await fillSeats(ds, dropIds.get(drop.slug)!, drop.slug, drop.sold);
  }

  const [{ pieces }] = await ds.query(`SELECT count(*)::int AS pieces FROM pieces`);
  const [{ drops }] = await ds.query(`SELECT count(*)::int AS drops FROM drops`);
  const [{ ents }] = await ds.query(`SELECT count(*)::int AS ents FROM entitlements`);
  console.log(`\n  ${pieces} piezas · ${drops} videos · ${ents} accesos vendidos`);
  console.log(`  artista:   ${ARTIST}`);
  console.log(`  comprador: ${BUYER}`);
  console.log(`  ambos entran pidiendo un enlace en /entrar; sale en la consola de la API.\n`);
  void artistId;
}

async function upsertUser(
  ds: DataSource,
  email: string,
  fullName: string,
  isAdmin: boolean,
): Promise<string> {
  const [row] = await ds.query(
    `INSERT INTO users (email, full_name, is_admin) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, is_admin = EXCLUDED.is_admin
     RETURNING id`,
    [email, fullName, isAdmin],
  );
  return row.id;
}

/**
 * Sells seats to invented buyers until the drop shows the number the mock did.
 *
 * The count has to come from real rows because that is where the shop reads it:
 * writing "quedan 12" anywhere else would be a number that stops being true the
 * first time someone buys.
 */
async function fillSeats(ds: DataSource, dropId: string, slug: string, wanted: number): Promise<void> {
  const [{ count }] = await ds.query(
    `SELECT count(*)::int AS count FROM entitlements WHERE drop_id = $1`,
    [dropId],
  );
  const missing = wanted - count;
  if (missing <= 0) return;

  await ds.query(
    `WITH nuevos AS (
       INSERT INTO users (email)
       SELECT format('publico-%s-%s@ejemplo.invalid', $2::text, n)
         FROM generate_series($3::int + 1, $4::int) AS n
       ON CONFLICT (email) DO NOTHING
       RETURNING id
     ), pedidos AS (
       INSERT INTO orders (user_id, total_cop, payment_method, reference, status, paid_at)
       SELECT id, 250, 'CARD', 'ord_seed_' || replace(id::text, '-', ''), 'paid', now()
         FROM nuevos
       RETURNING id, user_id
     )
     INSERT INTO entitlements (user_id, drop_id, order_id)
     SELECT user_id, $1, id FROM pedidos
     ON CONFLICT (order_id, drop_id) DO NOTHING`,
    [dropId, slug, count, wanted],
  );
}

/**
 * The demo buyer's account: two orders and the three states a video can be in,
 * because /cuenta is unreadable until you can see all three side by side.
 */
async function giveBuyerHistory(ds: DataSource, buyerId: string): Promise<void> {
  const [{ count }] = await ds.query(
    `SELECT count(*)::int AS count FROM orders WHERE user_id = $1`,
    [buyerId],
  );
  if (count > 0) return; // already has a history

  // Asked signed, so the studio shows what that looks like on a real order.
  const shipped = await createOrder(ds, buyerId, 24000, {
    pieceSlug: 'boceto-portada-primer-disco',
    signed: true,
  });
  await ds.query(
    `UPDATE orders SET tracking_carrier = 'servientrega', tracking_number = '99120384',
            shipped_at = now() - interval '2 days'
      WHERE id = $1`,
    [shipped],
  );

  await createOrder(ds, buyerId, 9250, {
    pieceSlug: 'prueba-de-color',
    dropSlug: 'ojitos-verdes-maqueta',
  });

  // Unopened, open and consumed, one of each.
  await grant(ds, buyerId, 'ojitos-verdes-maqueta', null, null);
  await grant(ds, buyerId, 'casa-42-maqueta', '20.7 hours', '3.3 hours');
  await grant(ds, buyerId, 'como-conoci-a-gabi', '9 days', '-7 days');
}

async function createOrder(
  ds: DataSource,
  userId: string,
  totalCop: number,
  items: { pieceSlug?: string; dropSlug?: string; signed?: boolean },
): Promise<string> {
  const [order] = await ds.query(
    `INSERT INTO orders (user_id, total_cop, payment_method, reference, status, paid_at)
     VALUES ($1, $2, 'CARD', 'ord_demo_' || substr(md5(random()::text), 1, 12), 'paid', now())
     RETURNING id`,
    [userId, totalCop],
  );

  if (items.pieceSlug) {
    await ds.query(
      `INSERT INTO order_items (order_id, piece_id, unit_price_cop, wants_signature)
       SELECT $1, id, price_usd_cents, $3 FROM pieces WHERE slug = $2`,
      [order.id, items.pieceSlug, items.signed ?? false],
    );
  }
  if (items.dropSlug) {
    await ds.query(
      `INSERT INTO order_items (order_id, drop_id, unit_price_cop)
       SELECT $1, id, price_usd_cents FROM drops WHERE slug = $2`,
      [order.id, items.dropSlug],
    );
  }
  return order.id;
}

/** An entitlement whose window is placed relative to now, so it never rots. */
async function grant(
  ds: DataSource,
  userId: string,
  dropSlug: string,
  playedAgo: string | null,
  expiresIn: string | null,
): Promise<void> {
  // Checked first rather than left to ON CONFLICT: the order is written by an
  // earlier CTE, and a conflict on the entitlement would strand it.
  const [existing] = await ds.query(
    `SELECT e.id FROM entitlements e JOIN drops d ON d.id = e.drop_id
      WHERE e.user_id = $1 AND d.slug = $2`,
    [userId, dropSlug],
  );
  if (existing) return;

  await ds.query(
    `WITH d AS (
       SELECT id, price_usd_cents FROM drops WHERE slug = $2
     ), o AS (
       INSERT INTO orders (user_id, total_cop, payment_method, reference, status, paid_at)
       SELECT $1, d.price_usd_cents, 'CARD',
              'ord_ent_' || substr(md5(random()::text), 1, 12), 'paid', now()
         FROM d
       RETURNING id
     )
     INSERT INTO entitlements (user_id, drop_id, order_id, first_played_at, expires_at, views_used)
     SELECT $1, d.id, o.id,
            CASE WHEN $3::text IS NULL THEN NULL ELSE now() - $3::interval END,
            CASE WHEN $4::text IS NULL THEN NULL ELSE now() + $4::interval END,
            CASE WHEN $3::text IS NULL THEN 0 ELSE 1 END
       FROM d, o`,
    [userId, dropSlug, playedAgo, expiresIn],
  );
}

async function main(): Promise<void> {
  const forced = process.argv.includes('--force');

  // Producción sigue rechazándolo por defecto, y --force es la puerta: hay que
  // escribirlo, así que nadie lo hace sin querer desde un despliegue.
  if (process.env.NODE_ENV === 'production' && !forced) {
    throw new Error(
      'SEED_REFUSED_IN_PRODUCTION: los datos de ejemplo usan portadas de discos ' +
        'reales atribuidas a un artista que no existe. Si aun así los quieres ' +
        'para probar, repite el comando con --force.',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    console.log('\n  ⚠  Sembrando en PRODUCCIÓN con portadas de discos reales.');
    console.log('     Bórralas antes de que la tienda sea pública.\n');
  }

  const fresh = process.argv.includes('--fresh');
  const ds = await AppDataSource.initialize();
  try {
    await ds.runMigrations();
    if (fresh) await wipe(ds);
    await seed(ds);
  } finally {
    await ds.destroy();
  }
}

/**
 * Empties every table before seeding.
 *
 * Seeding on top of an existing database is idempotent but additive: anything
 * left over from poking around by hand stays, and then the shop shows a piece
 * called "prueba1" that is in no file. This is the way back to exactly what
 * this script describes, and nothing else.
 */
async function wipe(ds: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await ds.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  if (tables.length === 0) return;
  await ds.query(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  console.log('  base vaciada');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
