import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/** Pulls `{ id, scope }` out of whatever session token the request carries, or null. */
function resolveUser(req: any, auth: AuthService): { id: string; scope: string } | null {
  const raw: string | undefined =
    req.cookies?.session ?? req.headers['authorization']?.replace('Bearer ', '');
  const identity = raw ? auth.verifySession(raw) : null;
  return identity ? { id: identity.userId, scope: identity.scope } : null;
}

/**
 * Accepts any valid token — a real account session or a guest's
 * checkout-scoped one. What each route does with `req.user.scope` is up to
 * it: an endpoint that hands out account-wide data must check it itself (see
 * `AccountGuard`), one that already scopes by an id in its own path (an
 * order, a contract) checks the scope against that id.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(protected readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = resolveUser(req, this.auth);
    if (!user) throw new UnauthorizedException('NO_SESSION');
    req.user = user;
    return true;
  }
}

/**
 * Never fails: attaches `req.user` when the request carries a valid token,
 * leaves it undefined otherwise. For the one endpoint that must work both
 * signed in and as a guest — creating an order.
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = resolveUser(req, this.auth);
    if (user) req.user = user;
    return true;
  }
}

/**
 * A real account session — the email was proved via magic link, not just
 * typed at checkout. Required wherever a token could otherwise read or act on
 * a whole account instead of the one order it was scoped to: `/me/*` and
 * `/admin/*`.
 */
@Injectable()
export class AccountGuard extends SessionGuard {
  canActivate(ctx: ExecutionContext): boolean {
    super.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest();
    if (req.user.scope !== 'account') throw new UnauthorizedException('NO_SESSION');
    return true;
  }
}

/**
 * Only the artist. Runs after SessionGuard, so the session is already resolved;
 * being admin is read from the database on every request rather than baked into
 * the token, so revoking it takes effect immediately.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.id) throw new UnauthorizedException('NO_SESSION');
    if (!(await this.auth.isAdmin(req.user.id))) throw new ForbiddenException('NOT_ADMIN');
    return true;
  }
}
