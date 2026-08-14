/**
 * Ficha del artista. Hoy es contenido fijo porque solo hay un artista y no
 * cambia con cada despliegue; si algún día se edita desde el panel, se muda
 * a la API sin tocar la página.
 *
 * lazy: textos de relleno hasta que el artista escriba los suyos.
 */
export const ARTISTA = {
  nombre: 'Toryteler',
  oficio: 'Músico y archivista de lo suyo',
  retrato: 'v1786679538/rihanna-anti-cover-2016-billboard-1240.jpg',
  bio: [
    'Grabo desde 2019, casi siempre de noche y casi siempre en cuartos prestados. Lo que hago no cabe en un disco: cabe en las cajas donde guardo lo que sobró.',
    'Esta tienda existe porque me cansé de que esas cajas se quedaran cerradas. Cada pieza que está aquí estuvo antes en un estudio, en un bus o en el piso de mi casa, y tiene una historia que puedo contar entera.',
    'No hay reediciones. Lo que se va, se fue.',
  ],
  redes: [
    { nombre: 'Instagram', usuario: '@toryteler', url: 'https://instagram.com/' },
    { nombre: 'YouTube', usuario: '@toryteler', url: 'https://youtube.com/' },
    { nombre: 'Spotify', usuario: 'Toryteler', url: 'https://open.spotify.com/' },
    { nombre: 'TikTok', usuario: '@toryteler', url: 'https://tiktok.com/' },
  ],
  correo: 'hola@toryteler.com',
  ubicacion: 'Medellín, Colombia',
} as const;
