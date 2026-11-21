import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { createRequire } from 'node:module';
import { toDateOnly } from '../common/date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto.js';
import type { UpsertPushSubscriptionDto } from './dto/upsert-push-subscription.dto.js';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:todo@localhost';

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys missing; web push is disabled');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  getPublicKey() {
    return {
      publicKey: this.config.get<string>('VAPID_PUBLIC_KEY') ?? null,
      enabled: this.configured,
    };
  }

  async upsertSubscription(user: User, dto: UpsertPushSubscriptionDto) {
    const subscription = await this.prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: user.id,
          endpoint: dto.endpoint,
        },
      },
      create: {
        userId: user.id,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
      },
      update: {
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
      },
    });

    return {
      id: subscription.id,
      endpoint: subscription.endpoint,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  async removeSubscription(user: User, dto: DeletePushSubscriptionDto) {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint: dto.endpoint,
      },
    });
    return { ok: true };
  }

  async sendDueReminders() {
    if (!this.configured) return { sent: 0 };

    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        done: false,
        reminderAt: {
          not: null,
          gte: windowStart,
          lte: now,
        },
        reminderSentAt: null,
      },
      include: {
        user: {
          include: {
            pushSubscriptions: true,
          },
        },
      },
      take: 100,
    });

    let sent = 0;

    for (const task of tasks) {
      if (!task.reminderAt) continue;

      // Wait until the user has at least one device subscribed.
      if (task.user.pushSubscriptions.length === 0) {
        continue;
      }

      const payload = JSON.stringify({
        title: 'Plan It',
        body: task.title,
        url: '/home',
        taskId: task.id,
        date: toDateOnly(task.date),
      });

      const staleEndpoints: string[] = [];
      let delivered = false;

      await Promise.all(
        task.user.pushSubscriptions.map(async (subscription) => {
          try {
            await this.sendToSubscription(subscription, payload);
            sent += 1;
            delivered = true;
          } catch (error) {
            const statusCode = getPushStatusCode(error);

            if (statusCode === 404 || statusCode === 410) {
              staleEndpoints.push(subscription.endpoint);
            } else {
              this.logger.warn(
                `Failed to push reminder for task ${task.id}: ${String(error)}`,
              );
            }
          }
        }),
      );

      if (staleEndpoints.length > 0) {
        await this.prisma.pushSubscription.deleteMany({
          where: {
            userId: task.userId,
            endpoint: { in: staleEndpoints },
          },
        });
      }

      if (delivered) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { reminderSentAt: now },
        });
      }
    }

    return { sent };
  }

  private sendToSubscription(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: string,
  ) {
    return webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload,
    );
  }
}

function getPushStatusCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }
  return null;
}
