import { Injectable } from '@nestjs/common';
import { AnthropicService } from '../anthropic/anthropic.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(private readonly anthropicService: AnthropicService) {}

  async chat(dto: SendMessageDto): Promise<{ reply: string }> {
    return this.anthropicService.sendMessage(dto.message);
  }
}
