import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { isCloudinaryConfigured, parseCloudinaryUrl } from './cloudinary-url';

/**
 * Where signed contracts live. An interface rather than a direct call so tests
 * do not upload, and so replacing Cloudinary later touches one file.
 */
export abstract class DocumentStore {
  abstract savePdf(buffer: Buffer, name: string): Promise<string>;

  /**
   * Stores an image the shop will show, and returns the id it stores —
   * `v<version>/<public_id>.<format>`, the same shape the browser uploads
   * produce. Public, unlike a contract: a poster is meant to be seen.
   */
  abstract saveImage(buffer: Buffer, folder: string): Promise<string>;
}

@Injectable()
export class CloudinaryDocumentStore extends DocumentStore {
  private readonly log = new Logger(CloudinaryDocumentStore.name);

  constructor(private readonly config: ConfigService) {
    super();

    // Credentials passed in rather than left to the SDK's own reading of
    // CLOUDINARY_URL: that lookup happens at a moment nobody controls, and
    // when it misses, the error is "Must supply api_key" halfway through an
    // upload.
    const raw = this.config.get<string>('CLOUDINARY_URL') ?? '';
    if (isCloudinaryConfigured(raw)) {
      const { cloudName, apiKey, apiSecret } = parseCloudinaryUrl(raw);
      cloudinary.config({ secure: true, cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    }
  }

  async savePdf(buffer: Buffer, name: string): Promise<string> {
    // Placeholder credentials mean a local run: pretend, so developing does
    // not need a real account.
    if (!isCloudinaryConfigured(this.config.get<string>('CLOUDINARY_URL') ?? '')) {
      this.log.log(`[pdf simulado] contracts/${name}`);
      return `https://example.invalid/contracts/${name}.pdf`;
    }

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        // `raw` and `authenticated`: a contract carries a name and an ID
        // number, so its URL must not be guessable.
        { resource_type: 'raw', public_id: `contracts/${name}`, type: 'authenticated' },
        (err, res) => (err || !res ? reject(err ?? new Error('UPLOAD_FAILED')) : resolve(res.secure_url)),
      );
      upload.end(buffer);
    });
  }

  async saveImage(buffer: Buffer, folder: string): Promise<string> {
    if (!isCloudinaryConfigured(this.config.get<string>('CLOUDINARY_URL') ?? '')) {
      this.log.log(`[imagen simulada] ${folder}`);
      return 'v0/simulada.jpg';
    }

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { resource_type: 'image', folder },
        (err, res) =>
          err || !res
            ? reject(err ?? new Error('UPLOAD_FAILED'))
            : resolve(`v${res.version}/${res.public_id}.${res.format}`),
      );
      upload.end(buffer);
    });
  }
}
