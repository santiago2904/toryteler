import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { parseCloudinaryUrl } from './cloudinary-url';

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/**
 * Lets the browser upload straight to Cloudinary.
 *
 * The alternative is posting the file to this API and forwarding it, which
 * means holding a photograph in memory and paying for the bytes twice. Signing
 * instead keeps the secret here and the traffic out there.
 *
 * The signature covers the folder and the timestamp, so it cannot be reused to
 * write somewhere else, and it goes stale on its own. Only the artist can ask
 * for one — the endpoint sits behind the role guard.
 */
@Injectable()
export class UploadSignatureService {
  constructor(private readonly config: ConfigService) {}

  sign(folder: 'pieces' | 'posters'): UploadSignature {
    const { cloudName, apiKey, apiSecret } = this.credentials();
    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary signs the parameters that will be sent, sorted by name and
    // joined as a query string, with the secret appended.
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    return { cloudName, apiKey, timestamp, signature, folder };
  }

  /** `cloudinary://key:secret@cloud` unpacked, and refused if it is the example. */
  private credentials(): { cloudName: string; apiKey: string; apiSecret: string } {
    return parseCloudinaryUrl(this.config.get<string>('CLOUDINARY_URL') ?? '');
  }
}
