import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EnvironmentVariables } from '../config/env.validation';
import { FaqItem, FaqItemWithScore } from './embeddings.interfaces';

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly genai: GoogleGenAI;
  private readonly model: string;
  private faqEmbeddings: { item: FaqItem; embedding: number[] }[] = [];

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    this.genai = new GoogleGenAI({ apiKey: this.config.get('GOOGLE_API_KEY', { infer: true }) });
    this.model =
      this.config.get('GOOGLE_EMBEDDING_MODEL', { infer: true }) ?? 'gemini-embedding-001';
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.get('GOOGLE_API_KEY', { infer: true })) {
      this.logger.warn('GOOGLE_API_KEY is not set — chatbot knowledge base will not be embedded');
      return;
    }

    // Copied next to compiled output by nest-cli (see nest-cli.json "assets"),
    // so this resolves correctly in both `nest start` (src/) and dist builds.
    const dataDir = join(__dirname, '..', 'data');
    const faq: FaqItem[] = JSON.parse(readFileSync(join(dataDir, 'faq.json'), 'utf-8'));
    const knowledgeBase: FaqItem[] = JSON.parse(
      readFileSync(join(dataDir, 'knowledge-base.json'), 'utf-8'),
    );
    const items = [...faq, ...knowledgeBase];

    this.logger.log(`Embedding ${items.length} knowledge base items...`);

    for (const item of items) {
      const embedding = await this.embedText(item.question);
      this.faqEmbeddings.push({ item, embedding });
    }

    this.logger.log(`Embedded ${this.faqEmbeddings.length} knowledge base items`);
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.genai.models.embedContent({ model: this.model, contents: text });
    return response.embeddings?.[0]?.values ?? [];
  }

  async findRelevant(query: string, topK: number): Promise<FaqItemWithScore[]> {
    if (this.faqEmbeddings.length === 0) return [];

    const queryEmbedding = await this.embedText(query);

    const scored = this.faqEmbeddings.map(({ item, embedding }) => ({
      ...item,
      score: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    return magnitude === 0 ? 0 : dot / magnitude;
  }
}
