// AI Provider abstraction - pluggable layer for different AI backends

import { Message, Citation, AIProvider, AIConfig } from '../types';

export interface AIProviderInterface {
  query(question: string, language: 'am' | 'en'): Promise<{
    answer: string;
    citation?: Citation;
  }>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}

/**
 * Cloud AI Provider (e.g., OpenAI, Claude, etc.)
 */
export class CloudAIProvider implements AIProviderInterface {
  private apiKey: string;
  private endpoint: string;
  
  constructor(config: { apiKey: string; endpoint: string }) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
  }
  
  async query(question: string, language: 'am' | 'en'): Promise<{
    answer: string;
    citation?: Citation;
  }> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          question,
          language,
          context: 'course_content',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Cloud AI request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Cloud AI error:', error);
      throw error;
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  getName(): string {
    return 'Cloud AI';
  }
}

/**
 * Local AI Provider (e.g., LLaMA, Mistral running locally)
 */
export class LocalAIProvider implements AIProviderInterface {
  private endpoint: string;
  private model: string;
  
  constructor(config: { endpoint: string; model: string }) {
    this.endpoint = config.endpoint;
    this.model = config.model;
  }
  
  async query(question: string, language: 'am' | 'en'): Promise<{
    answer: string;
    citation?: Citation;
  }> {
    try {
      const response = await fetch(`${this.endpoint}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: question,
          model: this.model,
          language,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Local AI request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Local AI error:', error);
      throw error;
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  getName(): string {
    return `Local AI (${this.model})`;
  }
}

/**
 * Offline FAQ Provider - no internet required
 */
export class OfflineFAQProvider implements AIProviderInterface {
  private faqDatabase: Map<string, { answer: string; citation?: Citation }>;
  
  constructor(faqData?: Array<{ question: string; answer: string; citation?: Citation }>) {
    this.faqDatabase = new Map();
    
    // Initialize with provided FAQ data
    if (faqData) {
      faqData.forEach(item => {
        const key = item.question.toLowerCase();
        this.faqDatabase.set(key, { answer: item.answer, citation: item.citation });
      });
    }
  }
  
  async query(question: string, _language: 'am' | 'en'): Promise<{
    answer: string;
    citation?: Citation;
  }> {
    // Normalize question for matching
    const normalizedQuestion = question.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = this.faqDatabase.get(normalizedQuestion);
    if (exactMatch) {
      return exactMatch;
    }
    
    // Try fuzzy match (contains)
    for (const [key, value] of this.faqDatabase.entries()) {
      if (normalizedQuestion.includes(key) || key.includes(normalizedQuestion)) {
        return value;
      }
    }
    
    // No match found
    return {
      answer: _language === 'am' 
        ? 'ይቅርታ፣ ይህን ጥያቄ መመለስ አልቻልኩም። እባክዎ ሌላ መንገድ ይሞክሩ።'
        : 'Sorry, I cannot answer this question. Please try another way.',
    };
  }
  
  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }
  
  getName(): string {
    return 'Offline FAQ';
  }
  
  // Add new FAQ entry
  addFAQ(question: string, answer: string, citation?: Citation): void {
    this.faqDatabase.set(question.toLowerCase(), { answer, citation });
  }
}

/**
 * Factory function to create AI provider based on configuration
 */
export function createAIProvider(config: AIConfig): AIProviderInterface {
  switch (config.provider) {
    case 'cloud':
      if (!config.cloudApiKey || !config.cloudEndpoint) {
        throw new Error('Cloud AI requires API key and endpoint');
      }
      return new CloudAIProvider({
        apiKey: config.cloudApiKey,
        endpoint: config.cloudEndpoint,
      });
      
    case 'local':
      if (!config.localEndpoint) {
        throw new Error('Local AI requires endpoint');
      }
      return new LocalAIProvider({
        endpoint: config.localEndpoint,
        model: config.localModel || 'default',
      });
      
    case 'offline':
    default:
      return new OfflineFAQProvider();
  }
}
