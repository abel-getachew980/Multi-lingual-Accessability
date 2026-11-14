import { chunkMessage } from './chunker';
import type { AiClient } from './aiClient';
import type { SlidingWindowRateLimiter } from './rateLimiter';
import type { InMemorySessionStore } from './sessionManager';
import type {
  AiAnswer,
  Citation,
  HandleResult,
  InboundSms,
  Language,
  ParsedCommand,
  SmsConfig,
  SmsSession,
} from './types';

/** How many leftover segments we keep in memory for a `MORE` request. */
const MAX_PENDING_SEGMENTS = 20;

const MORE_HINT: Record<Language, string> = {
  am: 'ተጨማሪ ለማግኘት MORE ይላኩ።',
  en: 'Reply MORE for the rest.',
};

const SOURCE_LABEL: Record<Language, string> = {
  am: 'ምንጭ',
  en: 'Source',
};

const LANGUAGE_ALIASES: Record<string, Language> = {
  AM: 'am',
  AMHARIC: 'am',
  'አማርኛ': 'am',
  EN: 'en',
  ENGLISH: 'en',
  'እንግሊዝኛ': 'en',
};

interface Messages {
  welcome: string;
  languageChanged: Record<Language, string>;
  help: string;
  reset: string;
  nothingMore: string;
  empty: string;
  tooLong: string;
  rateLimited: (seconds: number) => string;
  aiUnavailable: string;
}

const MESSAGES: Record<Language, Messages> = {
  am: {
    welcome:
      'እንኳን ደህና መጡ! ጥያቄዎን በአማርኛ ወይም በእንግሊዝኛ ይላኩ።\nLANG AM - አማርኛ\nLANG EN - English\nHELP - የሰው እርዳታ',
    languageChanged: {
      am: 'ቋንቋ ወደ አማርኛ ተቀይሯል።',
      en: 'Language changed to English.',
    },
    help: 'የሰው እርዳታ ተጠይቋል። አስተማሪው በቅርቡ ያገኝዎታል።',
    reset: 'ውይይቱ ጸድቷል። አዲስ ጥያቄ ይላኩ።',
    nothingMore: 'ተጨማሪ መልስ የለም። አዲስ ጥያቄ ይላኩ።',
    empty: 'እባክዎ ጥያቄ ይላኩ። እርዳታ ለማግኘት HELP ይላኩ።',
    tooLong: 'ጥያቄው በጣም ረጅም ነው። እባክዎ በአጭሩ ይላኩ።',
    rateLimited: (seconds) => `በጣም ብዙ መልእክቶች። እባክዎ ${seconds} ሰከንድ ይጠብቁ።`,
    aiUnavailable: 'ይቅርታ፣ አሁን መልስ መስጠት አልቻልኩም። እባክዎ በኋላ ይሞክሩ።',
  },
  en: {
    welcome:
      'Welcome! Send your question in Amharic or English.\nLANG AM - አማርኛ\nLANG EN - English\nHELP - human help',
    languageChanged: {
      am: 'ቋንቋ ወደ አማርኛ ተቀይሯል።',
      en: 'Language changed to English.',
    },
    help: 'A human tutor has been notified and will contact you soon.',
    reset: 'Conversation cleared. Send a new question.',
    nothingMore: 'No more of that answer. Send a new question.',
    empty: 'Please send a question. Send HELP for human help.',
    tooLong: 'Your question is too long. Please send a shorter one.',
    rateLimited: (seconds) => `Too many messages. Please wait ${seconds} seconds.`,
    aiUnavailable: 'Sorry, I could not answer right now. Please try again later.',
  },
};

/**
 * Parses a raw SMS body into a command.
 *
 * Commands are case-insensitive and tolerate trailing punctuation, so
 * `lang en`, `LANG EN` and `LANG EN.` all work. Anything else is a question.
 */
export function parseCommand(body: string): ParsedCommand {
  const trimmed = body.replace(/\s+/g, ' ').trim();
  if (!trimmed) return { type: 'empty' };

  const [firstToken = '', ...restTokens] = trimmed.split(' ');
  const first = firstToken.toUpperCase().replace(/[.!?]+$/, '');
  const rest = restTokens.join(' ').trim();

  if (first === 'LANG' || first === 'LANGUAGE' || first === 'ቋንቋ') {
    const language = LANGUAGE_ALIASES[rest.toUpperCase().replace(/[.!?]+$/, '')];
    if (language) return { type: 'set-language', language };
    return { type: 'question', question: trimmed };
  }

  switch (first) {
    case 'HELP':
    case 'START':
    case 'እርዳታ':
    case 'እርዳኝ':
      return { type: 'help' };
    case 'MORE':
    case 'CONTINUE':
    case 'ተጨማሪ':
      return { type: 'more' };
    case 'RESET':
    case 'CLEAR':
    case 'አጽዳ':
      return { type: 'reset' };
    default:
      return { type: 'question', question: trimmed };
  }
}

export function formatCitation(citation: Citation | undefined, language: Language): string | null {
  if (!citation?.source) return null;

  let label = citation.source.trim();
  if (citation.section) label += `, ${citation.section}`;
  if (typeof citation.page === 'number') label += `, p. ${citation.page}`;

  return `${SOURCE_LABEL[language]}: ${label}`;
}

export interface MessageHandlerDeps {
  ai: AiClient;
  sessions: InMemorySessionStore;
  limiter: SlidingWindowRateLimiter;
  config: SmsConfig;
  now?: () => number;
  /** Called when the AI request fails so the gateway can log it. */
  onAiError?: (error: unknown, question: string) => void;
}

/**
 * Turns an inbound SMS into one or more reply segments.
 *
 * The handler is transport-agnostic: the Express gateway decides whether the
 * segments go back as TwiML or through the provider API.
 */
export class MessageHandler {
  constructor(private readonly deps: MessageHandlerDeps) {}

  async handle(inbound: InboundSms): Promise<HandleResult> {
    const { sessions, limiter, config } = this.deps;
    const session = sessions.getOrCreate(inbound.from, config.defaultLanguage);
    const command = parseCommand(inbound.body);

    if (command.type === 'empty') {
      const messages = this.prepareReply(MESSAGES[session.language].empty, session);
      sessions.save(session);
      return { messages, session, rateLimited: false };
    }

    const limit = limiter.check(inbound.from);
    if (!limit.allowed) {
      const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1_000));
      sessions.save(session);
      return {
        messages: [MESSAGES[session.language].rateLimited(seconds)],
        session,
        rateLimited: true,
      };
    }

    let messages: string[];

    switch (command.type) {
      case 'set-language':
        session.language = command.language ?? session.language;
        session.pendingChunks = [];
        messages = this.prepareReply(MESSAGES[session.language].languageChanged[session.language], session);
        break;

      case 'help':
        session.helpRequestedAt = (this.deps.now ?? Date.now)();
        messages = this.prepareReply(MESSAGES[session.language].help, session);
        break;

      case 'reset':
        session.pendingChunks = [];
        session.helpRequestedAt = undefined;
        messages = this.prepareReply(MESSAGES[session.language].reset, session);
        break;

      case 'more':
        messages = this.sendMore(session);
        break;

      case 'question':
      default:
        messages = await this.answerQuestion(session, command.question ?? '');
        break;
    }

    sessions.save(session);
    return { messages, session, rateLimited: false };
  }

  private async answerQuestion(session: SmsSession, question: string): Promise<string[]> {
    const { config, ai } = this.deps;

    if (question.length > config.maxQuestionLength) {
      return this.prepareReply(MESSAGES[session.language].tooLong, session);
    }

    session.pendingChunks = [];

    let answer: AiAnswer;
    try {
      answer = await ai.ask(question, session.language);
    } catch (error) {
      this.deps.onAiError?.(error, question);
      return this.prepareReply(MESSAGES[session.language].aiUnavailable, session);
    }

    const citation = formatCitation(answer.citation, session.language);
    const text = citation ? `${answer.answer}\n${citation}` : answer.answer;

    return this.prepareReply(text, session);
  }

  private sendMore(session: SmsSession): string[] {
    if (session.pendingChunks.length === 0) {
      session.pendingChunks = [];
      return this.prepareReply(MESSAGES[session.language].nothingMore, session);
    }

    const pending = session.pendingChunks;
    session.pendingChunks = [];
    // Chunks were already sized when the answer was split, so reuse them as-is.
    return this.paginate(pending, session);
  }

  private prepareReply(text: string, session: SmsSession): string[] {
    return this.paginate(chunkMessage(text), session);
  }

  /**
   * Keeps at most `maxSegmentsPerReply` messages. When the answer is longer,
   * one slot is reserved for the "MORE" hint and the rest stay in the session.
   */
  private paginate(chunks: string[], session: SmsSession): string[] {
    const max = Math.max(this.deps.config.maxSegmentsPerReply, 1);

    if (chunks.length <= max) {
      session.pendingChunks = [];
      return chunks;
    }

    const keep = Math.max(1, max - 1);
    session.pendingChunks = chunks.slice(keep, keep + MAX_PENDING_SEGMENTS);

    return [...chunks.slice(0, keep), MORE_HINT[session.language]];
  }
}
