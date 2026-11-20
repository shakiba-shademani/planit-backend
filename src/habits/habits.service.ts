import { Injectable, NotFoundException } from '@nestjs/common';
import {
  HabitFrequency,
  type Habit,
  type HabitLog,
  type User,
} from '@prisma/client';
import { parseDateOnly, toDateOnly } from '../common/date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateHabitDto } from './dto/create-habit.dto.js';
import type { ToggleHabitLogDto } from './dto/toggle-habit-log.dto.js';
import type { UpdateHabitDto } from './dto/update-habit.dto.js';

type HabitWithLogs = Habit & { logs: HabitLog[] };

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User, asOfDate?: string) {
    const asOf = asOfDate ?? toDateOnly(new Date());
    const range = completionRange(asOf);

    const habits = await this.prisma.habit.findMany({
      where: { userId: user.id },
      include: {
        logs: {
          where: {
            date: {
              gte: parseDateOnly(range.from),
              lte: parseDateOnly(range.to),
            },
          },
        },
      },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });

    return habits.map((habit) =>
      toHabitResponse(habit as HabitWithLogs, asOf),
    );
  }

  async create(user: User, dto: CreateHabitDto) {
    const habit = await this.prisma.habit.create({
      data: {
        title: dto.title.trim(),
        frequency: dto.frequency ?? HabitFrequency.DAILY,
        color: dto.color ?? null,
        userId: user.id,
      },
      include: { logs: true },
    });

    return toHabitResponse(habit as HabitWithLogs, toDateOnly(new Date()));
  }

  async update(user: User, id: string, dto: UpdateHabitDto) {
    await this.ensureOwned(user.id, id);

    const habit = await this.prisma.habit.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
      include: { logs: true },
    });

    return toHabitResponse(habit as HabitWithLogs, toDateOnly(new Date()));
  }

  async remove(user: User, id: string) {
    await this.ensureOwned(user.id, id);
    await this.prisma.habit.delete({ where: { id } });
    return { ok: true };
  }

  async toggleLog(user: User, id: string, dto: ToggleHabitLogDto) {
    await this.ensureOwned(user.id, id);
    const date = parseDateOnly(dto.date);

    const existing = await this.prisma.habitLog.findUnique({
      where: {
        habitId_date: {
          habitId: id,
          date,
        },
      },
    });

    if (existing) {
      await this.prisma.habitLog.delete({ where: { id: existing.id } });
      return { completed: false, date: dto.date };
    }

    await this.prisma.habitLog.create({
      data: {
        habitId: id,
        date,
      },
    });

    return { completed: true, date: dto.date };
  }

  private async ensureOwned(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id, userId } });
    if (!habit) {
      throw new NotFoundException('Habit not found');
    }
    return habit;
  }
}

function completionRange(asOf: string) {
  return {
    from: startOfWeekUtc(asOf),
    to: asOf,
  };
}

/** Monday as first day, using the YYYY-MM-DD calendar value. */
function startOfWeekUtc(value: string): string {
  const date = parseDateOnly(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return toDateOnly(date);
}

function isCompletedForPeriod(
  habit: HabitWithLogs,
  asOf: string,
): boolean {
  if (habit.frequency === HabitFrequency.DAILY) {
    return habit.logs.some((log) => toDateOnly(log.date) === asOf);
  }

  const weekStart = startOfWeekUtc(asOf);
  return habit.logs.some((log) => {
    const logDate = toDateOnly(log.date);
    return logDate >= weekStart && logDate <= asOf;
  });
}

function toHabitResponse(habit: HabitWithLogs, asOf: string) {
  return {
    id: habit.id,
    title: habit.title,
    frequency: habit.frequency,
    active: habit.active,
    color: habit.color,
    completedToday: isCompletedForPeriod(habit, asOf),
    createdAt: habit.createdAt.toISOString(),
    updatedAt: habit.updatedAt.toISOString(),
  };
}
