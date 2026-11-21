import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto.js';
import { UpsertPushSubscriptionDto } from './dto/upsert-push-subscription.dto.js';
import { PushService } from './push.service.js';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getPublicKey() {
    return this.pushService.getPublicKey();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subscriptions')
  upsert(
    @CurrentUser() user: User,
    @Body() dto: UpsertPushSubscriptionDto,
  ) {
    return this.pushService.upsertSubscription(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('subscriptions')
  remove(
    @CurrentUser() user: User,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.pushService.removeSubscription(user, dto);
  }
}
