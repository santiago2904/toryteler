import { ServiceUnavailableException } from '@nestjs/common';

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Unpacks `cloudinary://key:secret@cloud`.
 *
 * The SDK can read that variable by itself, and relying on it was a mistake:
 * it picks it up from the process environment at a moment nobody controls, and
 * when it does not, the failure is "Must supply api_key" at upload time —
 * which reads like a missing argument rather than like configuration. Passing
 * the three values explicitly removes the question.
 */
export function parseCloudinaryUrl(raw: string): CloudinaryCredentials {
  const match = (raw ?? '').match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) throw new Error('CLOUDINARY_URL_MALFORMED');

  const [, apiKey, apiSecret, cloudName] = match;
  if (apiKey === 'key' || apiSecret === 'secret') {
    throw new ServiceUnavailableException('CLOUDINARY_NOT_CONFIGURED');
  }
  return { apiKey, apiSecret, cloudName };
}

/** Whether the placeholder credentials are still in place. */
export function isCloudinaryConfigured(raw: string): boolean {
  try {
    parseCloudinaryUrl(raw);
    return true;
  } catch {
    return false;
  }
}
