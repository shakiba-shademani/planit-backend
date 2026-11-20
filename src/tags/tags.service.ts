import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Tag, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTagDto } from './dto/create-tag.dto.js';
import type { UpdateTagDto } from './dto/update-tag.dto.js';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User) {
    const tags = await this.prisma.tag.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });
    return tags.map(toTagResponse);
  }

  async create(user: User, dto: CreateTagDto) {
    try {
      const tag = await this.prisma.tag.create({
        data: {
          name: dto.name.trim().toLowerCase(),
          color: dto.color ?? null,
          userId: user.id,
        },
      });
      return toTagResponse(tag);
    } catch {
      throw new ConflictException('A tag with this name already exists');
    }
  }

  async update(user: User, id: string, dto: UpdateTagDto) {
    await this.ensureOwned(user.id, id);

    try {
      const tag = await this.prisma.tag.update({
        where: { id },
        data: {
          ...(dto.name !== undefined
            ? { name: dto.name.trim().toLowerCase() }
            : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
        },
      });
      return toTagResponse(tag);
    } catch {
      throw new ConflictException('A tag with this name already exists');
    }
  }

  async remove(user: User, id: string) {
    await this.ensureOwned(user.id, id);
    await this.prisma.tag.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureOwned(userId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return tag;
  }
}

function toTagResponse(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}
