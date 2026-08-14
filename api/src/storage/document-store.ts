import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Where signed contracts live. An interface rather than a direct call so tests
 * do not upload, and so replacing Cloudinary later touches one file.
 */
export abstract class DocumentStore {
  abstract savePdf(buffer: Buffer, name: string): Promise<string>;
}

@Injectable()
export class CloudinaryDocumentStore extends DocumentStore {
  private readonly log = new Logger(CloudinaryDocumentStore.name);

  constructor(private readonly config: ConfigService) {
    super();
    cloudinary.config({ secure: true });
  }

  async savePdf(buffer: Buffer, name: string): Promise<string> {
    const url = this.config.get<string>('CLOUDINARY_URL') ?? '';
    // Placeholder credentials mean a local run: pretend, so developing does
    // not need a real account.
    if (url.includes('key:secret')) {
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
}
