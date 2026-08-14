'use server';

import { apiSend } from './api';

/**
 * Opens the viewing window and returns a URL that plays.
 *
 * It is a server action and not a fetch from the player because the URL must
 * never be part of what the page ships: anything handed to a component ends up
 * in the payload, window open or not. This way it exists only in the response
 * to a deliberate press of play.
 */
export async function openPlayback(
  entitlementId: string,
  dropSlug: string,
): Promise<{ videoUrl: string | null; error?: string }> {
  try {
    const { videoUrl } = await apiSend<{ videoUrl: string; expiresAt: string }>(
      `/entitlements/${entitlementId}/play`,
      'POST',
      {},
    );
    return { videoUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // lazy: the demo deployment runs with no API behind it. Goes away with
    // lib/mock-data.ts once the API is deployed.
    if (message.includes('API_NOT_CONFIGURED')) {
      const { MOCK_VIDEO_URLS } = await import('./mock-data');
      const source = MOCK_VIDEO_URLS[dropSlug];
      return {
        videoUrl: source
          ? source.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,q_auto,w_1280/')
          : null,
      };
    }

    if (message.includes('WINDOW_CLOSED')) {
      return { videoUrl: null, error: 'Tu ventana ya se cerró.' };
    }
    return { videoUrl: null, error: 'No pudimos abrir el video. Inténtalo otra vez.' };
  }
}
