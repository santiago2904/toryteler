import { uploadTicket } from './studio-actions';

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
