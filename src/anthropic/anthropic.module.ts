import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { AnthropicService } from './anthropic.service';

@Module({
  imports: [EmbeddingsModule],
  providers: [AnthropicService],
  exports: [AnthropicService],
})
export class AnthropicModule {}
