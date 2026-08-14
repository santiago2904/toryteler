import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VideoUploadTicket {
  /** Where the browser POSTs the file. Single use, and it expires. */
  uploadUrl: string;
  /** The asset id, which is what the drop stores. It exists before the bytes do. */
  uid: string;
}

export interface VideoStatus {
  uid: string;
  /** Playable. Until then the drop must not be published. */
  ready: boolean;
  state: string;
  durationSeconds: number | null;
  errorMessage: string | null;
}

/**
 * Direct creator uploads: the video goes from the browser to Cloudflare Stream
 * without crossing this API.
 *
 * Forwarding it would mean holding hundreds of megabytes in memory for no
 * reason, and the point of a one-time URL is precisely that the token never
 * reaches the browser.
 *
 * `requireSignedURLs` is set when the upload is reserved, not afterwards, so
 * the video is never public — not even for the seconds between the file
 * arriving and someone remembering to protect it.
 */
@Injectable()
export class VideoUploadService {
  constructor(private readonly config: ConfigService) {}

  async createUpload(maxDurationSeconds = 3600): Promise<VideoUploadTicket> {
    const json = await this.call('stream/direct_upload', {
      method: 'POST',
      body: JSON.stringify({ maxDurationSeconds, requireSignedURLs: true }),
    });
    return { uploadUrl: json.result.uploadURL, uid: json.result.uid };
  }

  /**
   * Cloudflare transcodes after the upload, so a video is not playable the
   * instant it arrives. The studio waits on this before letting a drop be
   * published, because publishing early sells a seat to a black screen.
   */
  async status(uid: string): Promise<VideoStatus> {
    const json = await this.call(`stream/${uid}`);
    const result = json.result;
    return {
      uid,
      ready: result.readyToStream === true,
      state: result.status?.state ?? 'unknown',
      durationSeconds: typeof result.duration === 'number' && result.duration > 0 ? result.duration : null,
      errorMessage: result.status?.errorReasonText || null,
    };
  }

  /**
   * A frame of the video, as an image.
   *
   * Signed like everything else about a protected video: its thumbnails answer
   * 401 to anyone without a token, which is why a frame cannot be used
   * directly as the shop's poster and has to be copied somewhere public.
   */
  async frame(uid: string, seconds: number, height = 720): Promise<Buffer> {
    const json = await this.call(`stream/${uid}/token`, {
      method: 'POST',
      body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300 }),
    });

    const code = this.config.get<string>('CF_STREAM_CUSTOMER_CODE');
    const res = await fetch(
      `https://customer-${code}.cloudflarestream.com/${json.result.token}/thumbnails/thumbnail.jpg` +
        `?time=${Math.max(0, seconds)}s&height=${height}`,
    );
    if (!res.ok) throw new ServiceUnavailableException(`CF_STREAM_THUMBNAIL_FAILED_${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async call(path: string, init: RequestInit = {}) {
    const account = this.config.get<string>('CF_STREAM_ACCOUNT_ID') ?? '';
    const token = this.config.get<string>('CF_STREAM_TOKEN') ?? '';
    // Same refusal as Cloudinary's: better than a 401 arriving at the end of a
    // long upload and reading like a bug in the shop.
    if (!account || !token || account === 'xxx' || token === 'xxx') {
      throw new ServiceUnavailableException('CF_STREAM_NOT_CONFIGURED');
    }

    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    const json = (await res.json()) as {
      success: boolean;
      result: Record<string, any>;
      errors?: { message: string }[];
    };
    if (!res.ok || !json.success) {
      throw new ServiceUnavailableException(
        `CF_STREAM_FAILED: ${json.errors?.[0]?.message ?? res.status}`,
      );
    }
    return json;
  }
}
