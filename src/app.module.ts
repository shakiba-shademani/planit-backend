import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { GoalsModule } from './goals/goals.module.js';
import { HabitsModule } from './habits/habits.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { PushModule } from './push/push.module.js';
import { TagsModule } from './tags/tags.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TagsModule,
    TasksModule,
    GoalsModule,
    HabitsModule,
    PushModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
