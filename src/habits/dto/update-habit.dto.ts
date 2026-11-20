import { ApiPropertyOptional } from '@nestjs/swagger';
import { HabitFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateHabitDto {
  @ApiPropertyOptional({ example: 'Read 20 minutes' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: HabitFrequency })
  @IsOptional()
  @IsEnum(HabitFrequency)
  frequency?: HabitFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: '#16a34a', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6})$/, {
    message: 'Color must be a hex value like #2563eb',
  })
  color?: string | null;
}
