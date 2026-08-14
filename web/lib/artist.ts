/**
 * The artist's profile. Today it is static content because there is a single
 * artist and it does not change per deploy; if it ever becomes editable from
 * the studio, it moves to the API without touching the page.
 *
 * lazy: placeholder copy until the artist writes their own.
 */
export const ARTIST = {
  name: 'Toryteler',
  role: 'Músico y archivista de lo suyo',
  portrait: 'v1786679538/rihanna-anti-cover-2016-billboard-1240.jpg',
  bio: [
    'Grabo desde 2019, casi siempre de noche y casi siempre en cuartos prestados. Lo que hago no cabe en un disco: cabe en las cajas donde guardo lo que sobró.',
    'Esta tienda existe porque me cansé de que esas cajas se quedaran cerradas. Cada pieza que está aquí estuvo antes en un estudio, en un bus o en el piso de mi casa, y tiene una historia que puedo contar entera.',
    'No hay reediciones. Lo que se va, se fue.',
  ],
  socials: [
    { name: 'Instagram', handle: '@toryteler', url: 'https://instagram.com/' },
    { name: 'YouTube', handle: '@toryteler', url: 'https://youtube.com/' },
    { name: 'Spotify', handle: 'Toryteler', url: 'https://open.spotify.com/' },
    { name: 'TikTok', handle: '@toryteler', url: 'https://tiktok.com/' },
  ],
  email: 'hola@toryteler.com',
  location: 'Medellín, Colombia',
} as const;
