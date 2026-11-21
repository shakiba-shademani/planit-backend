import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class DeletePushSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2048)
  endpoint: string;
}
