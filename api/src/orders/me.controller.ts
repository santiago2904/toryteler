import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { AccountService } from './account.service';

type Authenticated = Request & { user: { id: string } };

/**
 * Everything under /me is scoped to the session, never to an id in the path.
 * A caller cannot ask for someone else's history because there is nowhere to
 * put the request.
 */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly account: AccountService) {}

  @Get('orders')
  orders(@Req() req: Authenticated) {
    return this.account.orders(req.user.id);
  }

  @Get('entitlements')
  entitlements(@Req() req: Authenticated) {
    return this.account.entitlements(req.user.id);
  }

  @Get('entitlements/:id')
  async entitlement(@Param('id', ParseUUIDPipe) id: string, @Req() req: Authenticated) {
    const entitlement = await this.account.findEntitlement(id, req.user.id);
    if (!entitlement) throw new NotFoundException('ENTITLEMENT_NOT_FOUND');
    return entitlement;
  }
}
