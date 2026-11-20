import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HabitFrequency } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateHabitDto {
  @ApiProperty({ example: 'Read 20 minutes' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ enum: HabitFrequency, default: HabitFrequency.DAILY })
  @IsOptional()
  @IsEnum(HabitFrequency)
  frequency?: HabitFrequency;

  @ApiPropertyOptional({ example: '#16a34a' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6})$/, {
    message: 'Color must be a hex value like #2563eb',
  })
  color?: string;
}
