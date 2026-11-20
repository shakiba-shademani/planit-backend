import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { CreateHabitDto } from './dto/create-habit.dto.js';
import { HabitsQueryDto } from './dto/habits-query.dto.js';
import { ToggleHabitLogDto } from './dto/toggle-habit-log.dto.js';
import { UpdateHabitDto } from './dto/update-habit.dto.js';
import { HabitsService } from './habits.service.js';

@ApiTags('habits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: HabitsQueryDto) {
    return this.habitsService.list(user, query.date);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitsService.update(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.habitsService.remove(user, id);
  }

  @Post(':id/toggle')
  toggle(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ToggleHabitLogDto,
  ) {
    return this.habitsService.toggleLog(user, id, dto);
  }
}
