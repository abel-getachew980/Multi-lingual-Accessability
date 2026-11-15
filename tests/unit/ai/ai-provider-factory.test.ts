/** @jest-environment node */
import { createAIProvider } from '@/services/ai/AIProviderFactory';
import { CloudAIProvider } from '@/services/ai/CloudAIProvider';
import { LocalAIProvider } from '@/services/ai/LocalAIProvider';
import { OfflineFAQProvider } from '@/services/ai/OfflineFAQProvider';

describe('createAIProvider', () => {
  it('creates a cloud provider', () => {
    const provider = createAIProvider({
      provider: 'cloud',
      cloudApiKey: 'key',
      cloudEndpoint: 'https://example.com/v1/chat/completions',
      cloudModel: 'model',
    });

    expect(provider).toBeInstanceOf(CloudAIProvider);
  });

  it('creates a local provider', () => {
    const provider = createAIProvider({
      provider: 'local',
      localEndpoint: 'http://localhost:11434',
      localModel: 'llama3',
    });

    expect(provider).toBeInstanceOf(LocalAIProvider);
  });

  it('creates an offline provider by default', () => {
    expect(createAIProvider({ provider: 'offline' })).toBeInstanceOf(OfflineFAQProvider);
  });

  it('rejects incomplete cloud configuration', () => {
    expect(() => createAIProvider({ provider: 'cloud' })).toThrow(/cloud ai requires/i);
  });

  it('rejects incomplete local configuration', () => {
    expect(() => createAIProvider({ provider: 'local' })).toThrow(/local ai requires/i);
  });
});
