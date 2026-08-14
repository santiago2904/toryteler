import { uploadTicket, videoStatus, videoTicket } from './studio-actions';

/** Cloudflare's limit for a plain POST upload. Past it the protocol is tus. */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/**
 * Sends files straight from the browser to Cloudinary and returns the ids the
 * shop stores — `v1786679539/nombre.jpg`, the same shape the seed uses.
 *
 * One signature per batch: it is bound to a folder and a timestamp, not to a
 * file, so asking for one per photograph would be a round trip for nothing.
 */
export async function uploadImages(
  files: File[],
  folder: 'pieces' | 'posters',
  onProgress?: (done: number, total: number) => void,
): Promise<{ ids: string[]; error?: string }> {
  if (files.length === 0) return { ids: [] };

  const ticket = await uploadTicket(folder);
  if (!ticket.ok) return { ids: [], error: ticket.error };

  const { cloudName, apiKey, timestamp, signature } = ticket.data;
  const ids: string[] = [];

  for (const [index, file] of files.entries()) {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append('folder', ticket.data.folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      // Cloudinary says why, and it is almost never something the artist did:
      // swallowing it turned a missing setting into "no se pudo subir", which
      // is the same sentence for a wrong key, a file too large and a network
      // that dropped.
      const reason = await explain(res);
      return {
        ids,
        error: `No se pudo subir ${file.name}: ${reason}${
          ids.length ? ' Las anteriores sí subieron.' : ''
        }`,
      };
    }

    const json = (await res.json()) as { version: number; public_id: string; format: string };
    // The shop builds URLs from "v<version>/<public_id>.<format>".
    ids.push(`v${json.version}/${json.public_id}.${json.format}`);
    onProgress?.(index + 1, files.length);
  }

  return { ids };
}

/**
 * Sends a video to Cloudflare Stream and waits until it can actually be played.
 *
 * Two waits, and they are different: the upload, which has a percentage worth
 * showing, and the transcode afterwards, which has no progress at all — a
 * video is not playable the moment it arrives. Publishing between the two
 * would sell a seat to a black screen.
 *
 * XMLHttpRequest and not fetch because it is the only one that reports upload
 * progress, and a bar that does not move on a 90 MB file reads as broken.
 */
export async function uploadVideo(
  file: File,
  onProgress: (stage: 'subiendo' | 'procesando', percent: number) => void,
): Promise<{ uid?: string; durationSeconds?: number | null; error?: string }> {
  if (file.size > MAX_VIDEO_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    return { error: `El video pesa ${mb} MB y el máximo es 200 MB. Exporta una versión más liviana.` };
  }

  const ticket = await videoTicket();
  if (!ticket.ok) return { error: ticket.error };
  const { uploadUrl, uid } = ticket.data;

  const uploaded = await new Promise<string | null>((resolve) => {
    const request = new XMLHttpRequest();
    request.open('POST', uploadUrl);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress('subiendo', Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () =>
      resolve(request.status >= 200 && request.status < 300 ? null : `Cloudflare respondió ${request.status}.`);
    request.onerror = () => resolve('Se cortó la conexión durante la subida.');

    const form = new FormData();
    form.append('file', file);
    request.send(form);
  });
  if (uploaded) return { error: uploaded };

  // Transcoding. Cloudflare gives no percentage, so this reports the wait
  // itself rather than inventing one.
  for (let attempt = 0; attempt < 60; attempt++) {
    const status = await videoStatus(uid);
    if (!status.ok) return { error: status.error };
    if (status.data.ready) return { uid, durationSeconds: status.data.durationSeconds };
    if (status.data.state === 'error') {
      return { error: status.data.errorMessage ?? 'Cloudflare no pudo procesar el video.' };
    }
    onProgress('procesando', 0);
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Still not ready after three minutes: the video is safe, it just is not
  // playable yet, and saying so beats blocking the form forever.
  return { uid, error: 'PROCESANDO' };
}

/** Cloudinary's own reason, in words the artist can act on. */
async function explain(res: Response): Promise<string> {
  let message = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    message = body.error?.message ?? '';
  } catch {
    // No JSON body: the status is all there is.
  }

  if (/Invalid api_key|Unknown API key/i.test(message)) {
    return 'la tienda no tiene configuradas las credenciales de Cloudinary.';
  }
  if (/cloud_name/i.test(message)) {
    return 'el nombre de la nube de Cloudinary está mal escrito en la configuración.';
  }
  if (/Invalid Signature/i.test(message)) {
    return 'la firma no coincide. Es un fallo nuestro, no tuyo.';
  }
  if (/File size too large|too large/i.test(message)) {
    return 'la imagen pesa más de lo que acepta la cuenta.';
  }
  if (res.status === 420 || res.status === 429) {
    return 'Cloudinary está limitando las subidas. Espera un momento.';
  }
  return message || `error ${res.status} de Cloudinary.`;
}
