import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  RecurrenceFrequency,
  TaskPriority,
  type Project,
  type Tag,
  type Task,
  type User,
} from '@prisma/client';
import { parseDateOnly, toDateOnly } from '../common/date.js';
import { compareTime } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';

type TaskWithRelations = Task & {
  project: Project | null;
  tags: Array<{ tag: Tag }>;
  subtasks?: TaskWithRelations[];
};

const taskInclude = {
  project: true,
  tags: { include: { tag: true } },
  subtasks: {
    include: {
      project: true,
      tags: { include: { tag: true } },
    },
    orderBy: [{ done: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

const PRIORITY_RANK: Record<TaskPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: User,
    query: { date?: string; from?: string; to?: string },
  ) {
    const dateFilter = this.resolveListDateFilter(query);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId: user.id,
        date: dateFilter,
        parentId: null,
      },
      include: taskInclude,
    });

    return tasks
      .map((task) => toTaskResponse(task as TaskWithRelations))
      .sort(compareTaskResponses);
  }

  private resolveListDateFilter(query: {
    date?: string;
    from?: string;
    to?: string;
  }) {
    const hasDate = Boolean(query.date);
    const hasFrom = Boolean(query.from);
    const hasTo = Boolean(query.to);

    if (hasDate && (hasFrom || hasTo)) {
      throw new BadRequestException(
        'Provide either date or from+to, not both',
      );
    }

    if (hasDate && query.date) {
      return parseDateOnly(query.date);
    }

    if (hasFrom && hasTo && query.from && query.to) {
      if (query.from > query.to) {
        throw new BadRequestException('from must be on or before to');
      }

      const daySpan =
        Math.round(
          (parseDateOnly(query.to).getTime() -
            parseDateOnly(query.from).getTime()) /
            (24 * 60 * 60 * 1000),
        ) + 1;

      if (daySpan > 62) {
        throw new BadRequestException('Date range cannot exceed 62 days');
      }

      return {
        gte: parseDateOnly(query.from),
        lte: parseDateOnly(query.to),
      };
    }

    throw new BadRequestException(
      'Provide either date or both from and to query params',
    );
  }

  async create(user: User, dto: CreateTaskDto) {
    this.assertTimeRange(dto.startTime, dto.endTime);

    let taskDate = parseDateOnly(dto.date);

    if (dto.parentId) {
      const parent = await this.ensureOwned(user.id, dto.parentId);
      taskDate = parent.date;
    }

    if (dto.projectId) {
      await this.ensureProjectOwned(user.id, dto.projectId);
    }

    if (dto.tagIds?.length) {
      await this.ensureTagsOwned(user.id, dto.tagIds);
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        notes: dto.notes?.trim() || null,
        date: taskDate,
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
        recurrence: dto.recurrence ?? RecurrenceFrequency.NONE,
        userId: user.id,
        projectId: dto.projectId ?? null,
        parentId: dto.parentId ?? null,
        tags: dto.tagIds?.length
          ? {
              create: dto.tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: taskInclude,
    });

    return toTaskResponse(task as TaskWithRelations);
  }

  async update(user: User, id: string, dto: UpdateTaskDto) {
    await this.ensureOwned(user.id, id);
    this.assertTimeRange(dto.startTime, dto.endTime);

    if (dto.projectId) {
      await this.ensureProjectOwned(user.id, dto.projectId);
    }

    if (dto.tagIds) {
      await this.ensureTagsOwned(user.id, dto.tagIds);
    }

    const task = await this.prisma.$transaction(async (tx) => {
      if (dto.tagIds) {
        await tx.taskTag.deleteMany({ where: { taskId: id } });
        if (dto.tagIds.length > 0) {
          await tx.taskTag.createMany({
            data: dto.tagIds.map((tagId) => ({ taskId: id, tagId })),
          });
        }
      }

      return tx.task.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.date !== undefined ? { date: parseDateOnly(dto.date) } : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes === null ? null : dto.notes.trim() || null }
            : {}),
          ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
          ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.reminderAt !== undefined
            ? {
                reminderAt:
                  dto.reminderAt === null ? null : new Date(dto.reminderAt),
                reminderSentAt: null,
              }
            : {}),
          ...(dto.recurrence !== undefined
            ? { recurrence: dto.recurrence }
            : {}),
          ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
          ...(dto.done !== undefined ? { done: dto.done } : {}),
        },
        include: taskInclude,
      });
    });

    return toTaskResponse(task as TaskWithRelations);
  }

  async remove(user: User, id: string) {
    await this.ensureOwned(user.id, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  private assertTimeRange(
    startTime?: string | null,
    endTime?: string | null,
  ) {
    if (startTime && endTime && endTime < startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  private async ensureOwned(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async ensureProjectOwned(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async ensureTagsOwned(userId: string, tagIds: string[]) {
    const tags = await this.prisma.tag.findMany({
      where: { userId, id: { in: tagIds } },
      select: { id: true },
    });

    if (tags.length !== tagIds.length) {
      throw new NotFoundException('One or more tags were not found');
    }
  }
}

export type TaskResponse = {
  id: string;
  title: string;
  notes: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  priority: TaskPriority;
  reminderAt: string | null;
  recurrence: RecurrenceFrequency;
  done: boolean;
  projectId: string | null;
  parentId: string | null;
  project: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  subtasks: TaskResponse[];
  createdAt: string;
  updatedAt: string;
};

function toTaskResponse(task: TaskWithRelations): TaskResponse {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    date: toDateOnly(task.date),
    startTime: task.startTime,
    endTime: task.endTime,
    priority: task.priority,
    reminderAt: task.reminderAt ? task.reminderAt.toISOString() : null,
    recurrence: task.recurrence,
    done: task.done,
    projectId: task.projectId,
    parentId: task.parentId,
    project: task.project
      ? {
          id: task.project.id,
          name: task.project.name,
          color: task.project.color,
        }
      : null,
    tags: task.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
    subtasks: (task.subtasks ?? []).map((subtask) =>
      toTaskResponse({ ...subtask, subtasks: [] }),
    ),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function compareTaskResponses(a: TaskResponse, b: TaskResponse) {
  if (a.done !== b.done) {
    return Number(a.done) - Number(b.done);
  }

  const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const timeDiff = compareTime(a.startTime, b.startTime);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return a.createdAt.localeCompare(b.createdAt);
}
