'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { apiSend } from './api';

/**
 * Everything the artist writes. Same shape as the buyer's actions: a result
 * instead of an exception, because these are forms too.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  CLOUDINARY_NOT_CONFIGURED:
    'Falta configurar Cloudinary: el .env de la API todavía tiene las credenciales de ejemplo.',
  CAPACITY_BELOW_GRANTED: 'No puedes bajar los cupos por debajo de los que ya se vendieron.',
  PIECE_NOT_FOUND: 'Esa pieza ya no existe.',
  DROP_NOT_FOUND: 'Ese video ya no existe.',
  ORDER_NOT_PAID: 'Solo se puede marcar como enviado un pedido pagado.',
  CANNOT_REMOVE_SELF: 'No puedes quitarte el acceso a ti mismo.',
  LAST_ADMIN: 'No puedes quitar al único que tiene acceso al studio.',
  NOT_ADMIN: 'Esa persona ya no tenía acceso.',
  API_403: 'Esta cuenta no es la del artista.',
  API_401: 'Tu sesión venció. Entra otra vez.',
  API_NOT_CONFIGURED: 'Esto es una maqueta: no hay tienda conectada donde guardar.',
};

function explain(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = Object.keys(MESSAGES).find((key) => raw.includes(key));
  return code ? MESSAGES[code] : 'No pudimos guardar. Inténtalo de nuevo.';
}

async function attempt<T>(run: () => Promise<T>, revalidate = true): Promise<Result<T>> {
  try {
    const data = await run();
    // The catalogue and the studio list both change with any of these.
    if (revalidate) {
      revalidatePath('/studio');
      revalidatePath('/');
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export interface PieceInput {
  title: string;
  description?: string | null;
  story?: string | null;
  personalNote?: string | null;
  priceUsdCents: number;
  stock: number;
  images: string[];
}

export interface DropInput {
  title: string;
  description?: string | null;
  priceUsdCents: number;
  videoAssetId: string;
  posterImage?: string | null;
  capacity: number | null;
  viewWindowHours: number;
}

export async function createPiece(input: PieceInput): Promise<Result<{ id: string; slug: string }>> {
  return attempt(() => apiSend<{ id: string; slug: string }>('/admin/pieces', 'POST', input));
}

export async function updatePiece(id: string, changes: Partial<PieceInput>): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/pieces/${id}`, 'PATCH', changes);
    return null;
  });
}

export async function createDrop(input: DropInput): Promise<Result<{ id: string; slug: string }>> {
  return attempt(() => apiSend<{ id: string; slug: string }>('/admin/drops', 'POST', input));
}

export async function updateDrop(id: string, changes: Partial<DropInput>): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/drops/${id}`, 'PATCH', changes);
    return null;
  });
}

/** Puts something in the shop or takes it out. Never touches what was sold. */
export async function setListed(
  kind: 'piece' | 'drop',
  id: string,
  listed: boolean,
): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/${kind === 'piece' ? 'pieces' : 'drops'}/${id}/listed`, 'PATCH', { listed });
    return null;
  });
}

/** Records the shipment of a paid order. */
export async function markShipped(
  orderId: string,
  tracking: { carrier: string; number: string },
): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/orders/${orderId}/ship`, 'POST', tracking);
    return null;
  });
}

/** Gives someone the artist's role and mails them a way in. */
export async function addAdmin(email: string): Promise<Result<{ id: string; email: string }>> {
  return attempt(() => apiSend<{ id: string; email: string }>('/admin/team', 'POST', { email }), false);
}

/** Takes the role away. The API refuses to remove yourself or the last one left. */
export async function removeAdmin(id: string): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/team/${id}`, 'DELETE');
    return null;
  }, false);
}

export interface UploadTicket {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/**
 * What the browser needs to send a photograph to Cloudinary itself.
 *
 * The file never passes through this server: it would mean holding it in
 * memory and paying for the bytes twice. The secret stays on the API, which is
 * the only reason a signature is needed at all.
 */
export async function uploadTicket(folder: 'pieces' | 'posters'): Promise<Result<UploadTicket>> {
  return attempt(
    () => apiSend<UploadTicket>('/admin/uploads/signature', 'POST', { folder }),
    false,
  );
}

export interface VideoTicket {
  uploadUrl: string;
  uid: string;
}

/**
 * A one-time URL for sending a video to Cloudflare Stream.
 *
 * The video is marked as requiring signed URLs at this point, before a single
 * byte arrives, so it is never publicly reachable — not even in the gap
 * between the upload finishing and somebody remembering to protect it.
 */
export async function videoTicket(maxDurationSeconds = 3600): Promise<Result<VideoTicket>> {
  return attempt(
    () => apiSend<VideoTicket>('/admin/uploads/video', 'POST', { maxDurationSeconds }),
    false,
  );
}

export interface VideoStatus {
  uid: string;
  ready: boolean;
  state: string;
  durationSeconds: number | null;
  errorMessage: string | null;
}

/**
 * One frame of the video, as a data URI, to look at while choosing the cover.
 *
 * It comes through here because the video is protected and its thumbnails
 * answer 401 to a browser. Signing them for the browser instead would hand it
 * a key to the video, which is the one thing the whole design avoids.
 */
export async function framePreview(uid: string, seconds: number): Promise<Result<string>> {
  return attempt(async () => {
    const { apiBytes } = await import('./api');
    const bytes = await apiBytes(`/admin/uploads/video/${uid}/frame?seconds=${seconds}`);
    return `data:image/jpeg;base64,${bytes}`;
  }, false);
}

/** Copies that frame to public storage and returns the id the drop stores. */
export async function freezePoster(uid: string, seconds: number): Promise<Result<string>> {
  return attempt(async () => {
    const { image } = await apiSend<{ image: string }>(
      `/admin/uploads/video/${uid}/poster`,
      'POST',
      { seconds },
    );
    return image;
  }, false);
}

/** Cloudflare transcodes after the upload; nothing is playable until it does. */
export async function videoStatus(uid: string): Promise<Result<VideoStatus>> {
  return attempt(
    async () => {
      const { apiGet } = await import('./api');
      return apiGet<VideoStatus>(`/admin/uploads/video/${uid}`, true);
    },
    false,
  );
}

/**
 * Cambia uno de los 43 textos editoriales. revalidateTag, no
 * revalidatePath: el contenido se lee desde decenas de rutas a la vez, no
 * una sola.
 */
export async function updateContent(key: string, value: string): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/content/${encodeURIComponent(key)}`, 'PUT', { value });
    updateTag('content');
    return null;
  }, false);
}

/** Vuelve al texto original, borrando el override. */
export async function resetContent(key: string): Promise<Result<null>> {
  return attempt(async () => {
    await apiSend(`/admin/content/${encodeURIComponent(key)}`, 'DELETE');
    updateTag('content');
    return null;
  }, false);
}
