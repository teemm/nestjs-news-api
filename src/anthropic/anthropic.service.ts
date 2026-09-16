import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { EnvironmentVariables } from '../config/env.validation';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { RagProvider } from '../rag/rag.provider';

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly ai: Anthropic | null = null;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly rag = new RagProvider();

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly embeddingsService: EmbeddingsService,
  ) {
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY is not set — /chat endpoints will return 503');
    } else {
      this.ai = new Anthropic({ apiKey, timeout: 45000, maxRetries: 0 });
    }

    this.model = this.config.get('ANTHROPIC_MODEL', { infer: true }) ?? 'claude-haiku-4-5-20251001';
    this.maxTokens = this.config.get('ANTHROPIC_MAX_TOKENS', { infer: true }) ?? 1024;
  }

  async sendMessage(message: string): Promise<{ reply: string }> {
    if (!this.ai) {
      throw new ServiceUnavailableException('AI chatbot is not configured on this server');
    }

    const relevantItems = await this.embeddingsService.findRelevant(message, 3);
    this.logger.debug(
      `Matched knowledge base items: ${relevantItems.map((r) => `[${r.score.toFixed(3)}] ${r.question}`).join(' | ')}`,
    );

    const prompt = this.rag.preparePrompt(message, relevantItems);

    try {
      const response = await this.ai.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const reply = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim();
      if (!reply) throw new Error('Anthropic returned no text');

      return { reply };
    } catch (error) {
      this.logger.error('Error calling Anthropic API', error instanceof Error ? error.name : 'Unknown error');
      throw new ServiceUnavailableException('AI chatbot is temporarily unavailable. Please try again.');
    }
  }
}
