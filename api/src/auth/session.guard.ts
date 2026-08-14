import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(protected readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const raw: string | undefined =
      req.cookies?.session ?? req.headers['authorization']?.replace('Bearer ', '');
    const userId = raw ? this.auth.verifySession(raw) : null;
    if (!userId) throw new UnauthorizedException('NO_SESSION');
    req.user = { id: userId };
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
