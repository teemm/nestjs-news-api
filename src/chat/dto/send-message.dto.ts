import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { trim } from '../../common/utils/transform.util';

export class SendMessageDto {
  @ApiProperty({ example: 'What is your refund policy?' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}
