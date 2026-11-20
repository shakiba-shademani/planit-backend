import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class TasksQueryDto {
  @ApiPropertyOptional({ example: '2026-10-28' })
  @ValidateIf((query: TasksQueryDto) => !query.from && !query.to)
  @IsString()
  @Matches(DATE_ONLY, {
    message: 'Date must be in YYYY-MM-DD format',
  })
  date?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @ValidateIf((query: TasksQueryDto) => !query.date)
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY, {
    message: 'from must be in YYYY-MM-DD format',
  })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @ValidateIf((query: TasksQueryDto) => !query.date)
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY, {
    message: 'to must be in YYYY-MM-DD format',
  })
  to?: string;
}
