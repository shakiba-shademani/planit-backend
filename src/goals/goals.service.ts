import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus, type Goal, type User } from '@prisma/client';
import { parseDateOnly, toDateOnly } from '../common/date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateGoalDto } from './dto/create-goal.dto.js';
import type { UpdateGoalDto } from './dto/update-goal.dto.js';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User) {
    const goals = await this.prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    const statusRank: Record<GoalStatus, number> = {
      ACTIVE: 0,
      DONE: 1,
      ARCHIVED: 2,
    };

    return goals
      .map(toGoalResponse)
      .sort(
        (a, b) =>
          statusRank[a.status] - statusRank[b.status] ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
  }

  async create(user: User, dto: CreateGoalDto) {
    const goal = await this.prisma.goal.create({
      data: {
        title: dto.title.trim(),
        notes: dto.notes?.trim() || null,
        status: dto.status ?? GoalStatus.ACTIVE,
        targetDate: dto.targetDate ? parseDateOnly(dto.targetDate) : null,
        color: dto.color ?? null,
        userId: user.id,
      },
    });
    return toGoalResponse(goal);
  }

  async update(user: User, id: string, dto: UpdateGoalDto) {
    await this.ensureOwned(user.id, id);

    const goal = await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes === null ? null : dto.notes.trim() || null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.targetDate !== undefined
          ? {
              targetDate:
                dto.targetDate === null ? null : parseDateOnly(dto.targetDate),
            }
          : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });

    return toGoalResponse(goal);
  }

  async remove(user: User, id: string) {
    await this.ensureOwned(user.id, id);
    await this.prisma.goal.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    return goal;
  }
}

function toGoalResponse(goal: Goal) {
  return {
    id: goal.id,
    title: goal.title,
    notes: goal.notes,
    status: goal.status,
    targetDate: goal.targetDate ? toDateOnly(goal.targetDate) : null,
    color: goal.color,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}
