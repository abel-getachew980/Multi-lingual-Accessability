import type { AIConfig, AIProvider } from '@/types';
import type { AIProviderInterface, ProviderFactoryOptions } from './types';
import { CloudAIProvider } from './CloudAIProvider';
import { LocalAIProvider } from './LocalAIProvider';
import { OfflineFAQProvider } from './OfflineFAQProvider';

export function createAIProvider(
  config: AIConfig,
  options: ProviderFactoryOptions = {},
): AIProviderInterface {
  switch (config.provider) {
    case 'cloud':
      if (!config.cloudApiKey || !config.cloudEndpoint) {
        throw new Error('Cloud AI requires an API key and endpoint');
      }
      return new CloudAIProvider({
        apiKey: config.cloudApiKey,
        endpoint: config.cloudEndpoint,
        model: config.cloudModel,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        maxRetries: options.maxRetries,
        timeoutMs: options.timeoutMs,
      });

    case 'local':
      if (!config.localEndpoint) {
        throw new Error('Local AI requires an endpoint');
      }
      return new LocalAIProvider({
        endpoint: config.localEndpoint,
        model: config.localModel,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        maxRetries: options.maxRetries,
        timeoutMs: options.timeoutMs,
      });

    case 'offline':
    default:
      return new OfflineFAQProvider({
        entries: options.faqEntries,
        storage: options.faqStorage,
      });
  }
}

export function loadAIConfigFromEnv(providerOverride?: AIProvider): AIConfig {
  const env = (typeof process !== 'undefined' ? process.env : {}) as NodeJS.ProcessEnv;
  const provider = providerOverride
    ?? ((env.AI_PROVIDER as AIProvider | undefined) ?? 'offline');

  return {
    provider,
    cloudApiKey: env.CLOUD_AI_API_KEY,
    cloudEndpoint: env.CLOUD_AI_ENDPOINT,
    cloudModel: env.CLOUD_AI_MODEL,
    localEndpoint: env.LOCAL_AI_ENDPOINT,
    localModel: env.LOCAL_AI_MODEL,
  };
}

export function createAIProviderFromEnv(
  options: ProviderFactoryOptions = {},
  providerOverride?: AIProvider,
): AIProviderInterface {
  return createAIProvider(loadAIConfigFromEnv(providerOverride), options);
}
