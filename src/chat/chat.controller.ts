import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatReplyDto } from './dto/chat-reply.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI chatbot (RAG-backed)' })
  @ApiOkResponse({ type: ChatReplyDto })
  sendMessage(@Body() dto: SendMessageDto): Promise<{ reply: string }> {
    return this.chatService.chat(dto);
  }
}
