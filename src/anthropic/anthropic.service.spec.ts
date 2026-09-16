import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicService } from './anthropic.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: jest.fn() }));

describe('Anthropic chat replies', () => {
  const create = jest.fn();
  function service(apiKey: string | undefined = 'test-key') {
    const values: Record<string, unknown> = { ANTHROPIC_API_KEY: apiKey };
    const config = { get: (key: string) => values[key] } as ConfigService;
    const embeddings = { findRelevant: jest.fn().mockResolvedValue([]) };
    return new AnthropicService(config as never, embeddings as unknown as EmbeddingsService);
  }
  beforeEach(() => {
    jest.clearAllMocks();
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({ messages: { create } }));
  });
  it('uses Claude Haiku 4.5 and returns all text blocks', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: 'there' }] });
    await expect(service().sendMessage('Hi')).resolves.toEqual({ reply: 'Hello\nthere' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024 }));
  });
  it('returns a retryable service error when Anthropic fails', async () => {
    create.mockRejectedValue(new Error('Provider failure'));
    await expect(service().sendMessage('Hi')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('rejects empty replies', async () => {
    create.mockResolvedValue({ content: [] });
    await expect(service().sendMessage('Hi')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('does not call Anthropic without an API key', async () => {
    await expect(service('').sendMessage('Hi')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(create).not.toHaveBeenCalled();
  });
});
