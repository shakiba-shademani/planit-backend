import { Module } from '@nestjs/common';
import { PushController } from './push.controller.js';
import { PushScheduler } from './push.scheduler.js';
import { PushService } from './push.service.js';

@Module({
  controllers: [PushController],
  providers: [PushService, PushScheduler],
  exports: [PushService],
})
export class PushModule {}
