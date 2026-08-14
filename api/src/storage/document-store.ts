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

  /** Reads a stored document back, to serve it behind our own access check. */
  abstract readPdf(url: string): Promise<Buffer>;

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
        {
          // `raw` and `authenticated`: a contract carries a name and an ID
          // number, so it must not be reachable by guessing.
          resource_type: 'raw',
          // The extension belongs in the id for a raw upload. Without it the
          // file comes back as application/octet-stream and a browser opens a
          // blank tab instead of the document.
          public_id: `contracts/${name}.pdf`,
          type: 'authenticated',
        },
        // The id, not the URL. What upload returns as `secure_url` carries a
        // signature that does not authorise an authenticated raw file — it
        // answers 401 — and a link that did work would be one that never
        // expires, for a document with somebody's ID number in it.
        (err, res) => (err || !res ? reject(err ?? new Error('UPLOAD_FAILED')) : resolve(res.public_id)),
      );
      upload.end(buffer);
    });
  }

  /**
   * Reads a stored contract back, signing a short-lived link at that moment.
   *
   * The document is then served by the API, which checks who is asking. The
   * link minted here lives for minutes and never reaches a browser.
   */
  async readPdf(reference: string): Promise<Buffer> {
    if (!isCloudinaryConfigured(this.config.get<string>('CLOUDINARY_URL') ?? '')) {
      throw new Error('CLOUDINARY_NOT_CONFIGURED');
    }

    const url = cloudinary.utils.private_download_url(this.publicId(reference), '', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });

    const res = await fetch(url);
    if (!res.ok) throw new Error(`DOCUMENT_FETCH_FAILED_${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Contracts stored before this changed hold a full URL rather than an id.
   * The id is everything after the version segment, and reading it out is what
   * keeps those documents openable.
   */
  private publicId(reference: string): string {
    if (!reference.startsWith('http')) return reference;
    const match = reference.match(/\/v\d+\/(.+)$/);
    if (!match) throw new Error('DOCUMENT_REFERENCE_UNREADABLE');
    return match[1];
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
