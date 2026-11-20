import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Project, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User) {
    const projects = await this.prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });
    return projects.map(toProjectResponse);
  }

  async create(user: User, dto: CreateProjectDto) {
    try {
      const project = await this.prisma.project.create({
        data: {
          name: dto.name.trim(),
          color: dto.color ?? null,
          userId: user.id,
        },
      });
      return toProjectResponse(project);
    } catch {
      throw new ConflictException('A project with this name already exists');
    }
  }

  async update(user: User, id: string, dto: UpdateProjectDto) {
    await this.ensureOwned(user.id, id);

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
      });
      return toProjectResponse(project);
    } catch {
      throw new ConflictException('A project with this name already exists');
    }
  }

  async remove(user: User, id: string) {
    await this.ensureOwned(user.id, id);
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}

function toProjectResponse(project: Project) {
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
