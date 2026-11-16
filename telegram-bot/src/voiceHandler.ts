import type { Language, TelegramFile, TelegramVoice } from './types';

export interface VoiceDownloadClient {
  getFile(fileId: string): Promise<TelegramFile>;
  downloadFile(filePath: string): Promise<Buffer>;
}

export interface TranscriptionConfig {
  /** Whisper-compatible endpoint that accepts multipart/form-data. */
  url: string;
  model?: string;
  /** Overrides the chat language when a deployment needs it. */
  language?: string;
  timeoutMs: number;
}

export type VoiceFailureReason =
  | 'too-long'
  | 'too-large'
  | 'unavailable'
  | 'empty'
  | 'failed';

export type VoiceResult =
  | { ok: true; text: string }
  | { ok: false; reason: VoiceFailureReason };

export interface VoiceHandlerOptions {
  client: VoiceDownloadClient;
  transcription?: TranscriptionConfig;
  maxSeconds: number;
  maxBytes: number;
  fetchImpl?: typeof fetch;
  onError?: (error: unknown, voice: TelegramVoice) => void;
}

/**
 * Turns a Telegram voice note into text.
 *
 * Telegram delivers voice notes as OGG/Opus and performs no transcription, so
 * a deployment needs a Whisper-compatible endpoint (`TRANSCRIPTION_API_URL`).
 * When none is configured the handler says so instead of pretending to listen.
 */
export class VoiceHandler {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: VoiceHandlerOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return typeof this.options.transcription?.url === 'string';
  }

  async transcribe(voice: TelegramVoice, language: Language): Promise<VoiceResult> {
    if (voice.duration > this.options.maxSeconds) {
      return { ok: false, reason: 'too-long' };
    }

    if (typeof voice.file_size === 'number' && voice.file_size > this.options.maxBytes) {
      return { ok: false, reason: 'too-large' };
    }

    const transcription = this.options.transcription;
    if (!transcription) {
      return { ok: false, reason: 'unavailable' };
    }

    try {
      const file = await this.options.client.getFile(voice.file_id);

      if (typeof file.file_size === 'number' && file.file_size > this.options.maxBytes) {
        return { ok: false, reason: 'too-large' };
      }

      if (!file.file_path) {
        throw new Error('Telegram did not return a file path');
      }

      const audio = await this.options.client.downloadFile(file.file_path);
      if (audio.byteLength > this.options.maxBytes) {
        return { ok: false, reason: 'too-large' };
      }

      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(audio)], {
          type: voice.mime_type ?? 'audio/ogg',
        }),
        'voice.ogg',
      );

      if (transcription.model) form.append('model', transcription.model);
      form.append('language', transcription.language ?? language);
      form.append('response_format', 'json');

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        transcription.timeoutMs,
      );

      try {
        const response = await this.fetchImpl(transcription.url, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Transcription API responded with ${response.status}`);
        }

        const data = (await response.json()) as {
          text?: unknown;
          transcript?: unknown;
        };

        const raw =
          typeof data.text === 'string'
            ? data.text
            : typeof data.transcript === 'string'
              ? data.transcript
              : '';

        const text = raw.trim();
        return text ? { ok: true, text } : { ok: false, reason: 'empty' };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      this.options.onError?.(error, voice);
      return { ok: false, reason: 'failed' };
    }
  }
}
