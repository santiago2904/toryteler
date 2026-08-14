import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { firstRow } from '../database/rows';

/**
 * Turns a stored video into a URL that plays and then stops working.
 *
 * A function rather than a service because the hosting provider is an
 * implementation detail: signed Cloudflare Stream today, something else later,
 * and nothing above this line changes.
 */
export type PlaybackUrlSigner = (
  videoAssetId: string,
  ttlSeconds: number,
) => Promise<string>;

/**
 * How long the URL itself stays valid. Shorter than any viewing window on
 * purpose: a URL that outlives the session it was minted for is a URL that can
 * be forwarded. The player asks again if the buyer is still watching.
 */
const URL_TTL_SECONDS = 7200;

@Injectable()
export class PlaybackService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly signUrl: PlaybackUrlSigner,
  ) {}

  /**
   * Opens the viewing window on first play and hands back a playable URL.
   *
   * The URL is returned here and nowhere else. Anything a page receives ends up
   * in its source, so putting it in the drop's payload would give it away to
   * someone whose window never opened — and the window is the whole product.
   */
  async play(
    entitlementId: string,
    userId: string,
    ctx: { ip: string | null; userAgent: string | null },
  ): Promise<{ videoUrl: string; expiresAt: Date }> {
    /**
     * Opening the window and getting a working URL are one operation.
     *
     * Signing happens over the network and can fail. If it did after the
     * window had opened, the buyer would have burnt their only chance without
     * seeing a frame, so the whole thing runs in a transaction: no URL, no
     * window. The row stays locked across that call, which is the price.
     */
    return this.ds.transaction(async (m) => {
      // One statement: it opens the window if it was never opened, respects it if
      // it was, and refuses if it closed. Postgres serialises writes to the row,
      // so two simultaneous plays share one window instead of racing to set it.
      const opened = firstRow<{ expires_at: string; video_asset_id: string }>(
        await m.query(
          `UPDATE entitlements e
            SET first_played_at = COALESCE(e.first_played_at, now()),
                expires_at = COALESCE(
                  e.expires_at, now() + make_interval(hours => d.view_window_hours)),
                -- Counts sessions, and is not a limit: the window is what runs
                -- out. Coming back after the wifi drops must not cost a view.
                views_used = e.views_used + 1
           FROM drops d
          WHERE e.id = $1 AND e.user_id = $2 AND e.drop_id = d.id
            AND (e.expires_at IS NULL OR e.expires_at > now())
        RETURNING e.expires_at, d.video_asset_id`,
          [entitlementId, userId],
        ),
      );

      if (!opened) throw await this.explainRefusal(entitlementId, userId);

      await m.query(
        `INSERT INTO view_sessions (entitlement_id, ip, user_agent) VALUES ($1, $2, $3)`,
        [entitlementId, ctx.ip, ctx.userAgent],
      );

      return {
        videoUrl: await this.signUrl(opened.video_asset_id, URL_TTL_SECONDS),
        expiresAt: new Date(opened.expires_at),
      };
    });
  }

  /**
   * Why the update matched nothing: the window closed, or this access is not
   * theirs. Someone else's entitlement is reported as missing, not as
   * forbidden — confirming it exists tells them something they did not buy.
   */
  private async explainRefusal(
    entitlementId: string,
    userId: string,
  ): Promise<Error> {
    const mine = firstRow<{ id: string }>(
      await this.ds.query(
        `SELECT id FROM entitlements WHERE id = $1 AND user_id = $2`,
        [entitlementId, userId],
      ),
    );
    return mine
      ? new ForbiddenException('WINDOW_CLOSED')
      : new NotFoundException('NOT_FOUND');
  }
}
