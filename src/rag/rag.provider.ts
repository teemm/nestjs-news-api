import { FaqItemWithScore } from '../embeddings/embeddings.interfaces';

export class RagProvider {
  preparePrompt(query: string, relevantItems: FaqItemWithScore[]): string {
    const context = relevantItems
      .map((item) => `Q: ${item.question}\nA: ${item.answer} (relevance: ${item.score.toFixed(3)})`)
      .join('\n');

    return `You are an AI assistant. The following knowledge base entries are the most relevant to the user's question (ranked by semantic similarity):

${context}

Based on the above knowledge, answer the following user question:
User: ${query}
Answer in one short paragraph.`;
  }
}
