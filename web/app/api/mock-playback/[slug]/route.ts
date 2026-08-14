import { NextResponse } from 'next/server';
import { MOCK_VIDEO_URLS } from '@/lib/mock-data';

/**
 * Stands in for POST /entitlements/:id/play.
 *
 * It exists so the playback URL is never in the page a viewer who has not
 * opened their window receives: passing it as a prop would ship it inside the
 * payload even when the player is not rendered, which is precisely what the
 * window is meant to prevent. The real endpoint will additionally check that
 * the entitlement belongs to the session and is still open.
 *
 * lazy: delete along with lib/mock-data.ts.
 */

// Cloudinary re-encodes on the fly. The source files are HEVC, which only
// Safari plays, and tens of megabytes: h264 at 1280 wide is what every browser
// can actually show.
const TRANSFORM = 'f_mp4,vc_h264,q_auto,w_1280';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const source = MOCK_VIDEO_URLS[slug];

  if (!source) return NextResponse.json({ videoUrl: null }, { status: 404 });

  const videoUrl = source.replace('/video/upload/', `/video/upload/${TRANSFORM}/`);
  return NextResponse.json({ videoUrl });
}
