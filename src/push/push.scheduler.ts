import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushService } from './push.service.js';

@Injectable()
export class PushScheduler {
  private readonly logger = new Logger(PushScheduler.name);
  private running = false;

  constructor(private readonly pushService: PushService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDueReminders() {
    if (this.running) return;
    this.running = true;

    try {
      const result = await this.pushService.sendDueReminders();
      if (result.sent > 0) {
        this.logger.log(`Sent ${result.sent} reminder notification(s)`);
      }
    } catch (error) {
      this.logger.error(`Reminder cron failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
