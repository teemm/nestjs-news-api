import { ApiProperty } from '@nestjs/swagger';

export class ChatReplyDto {
  @ApiProperty({ example: 'Our refund policy allows returns within 30 days of purchase.' })
  reply: string;
}
