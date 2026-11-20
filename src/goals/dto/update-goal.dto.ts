import { ApiPropertyOptional } from '@nestjs/swagger';
import { GoalStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateGoalDto {
  @ApiPropertyOptional({ example: 'Ship portfolio site' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'Launch by end of quarter', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: GoalStatus })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional({ example: '2026-12-31', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'targetDate must be in YYYY-MM-DD format',
  })
  targetDate?: string | null;

  @ApiPropertyOptional({ example: '#2563eb', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6})$/, {
    message: 'Color must be a hex value like #2563eb',
  })
  color?: string | null;
}
