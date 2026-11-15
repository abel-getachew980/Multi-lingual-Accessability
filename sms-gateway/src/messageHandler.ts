import { chunkMessage } from './chunker';
import type { AiClient } from './aiClient';
import type { HelpClient } from './helpClient';
import type { OptOutStore } from './optOutStore';
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

/** Keep long answers from crowding out context when stored in a help ticket. */
const MAX_HISTORY_CONTENT_LENGTH = 400;

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

/** Standard carrier/aggregator opt-out keywords. */
const STOP_COMMANDS = new Set([
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
  'አቁም',
]);

/** Re-subscribe keywords. */
const START_COMMANDS = new Set(['START', 'YES', 'UNSTOP', 'SUBSCRIBE', 'ጀምር']);

interface Messages {
  welcome: string;
  languageChanged: Record<Language, string>;
  stopped: string;
  helpRequested: string;
  helpPending: string;
  helpUnavailable: string;
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
    stopped: 'ከመልእክት አገልግሎት ተወግደዋል። ለመመለስ START ይላኩ።',
    helpRequested: 'የእርዳታ ጥያቄዎ ተመዝግቧል። አስተማሪው በቅርቡ ያገኝዎታል።',
    helpPending: 'የእርዳታ ጥያቄዎ ቀድሞ ተመዝግቧል። እባክዎ ይጠብቁ።',
    helpUnavailable: 'የእርዳታ ጥያቄውን መላክ አልቻልንም። እባክዎ በኋላ ይሞክሩ።',
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
    stopped: 'You have been unsubscribed. Reply START to resubscribe.',
    helpRequested: 'Your help request has been registered. A tutor will contact you soon.',
    helpPending: 'Your help request is already registered. Please wait for a tutor.',
    helpUnavailable: 'We could not reach the help desk. Please try again in a few minutes.',
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

  if (STOP_COMMANDS.has(first)) return { type: 'stop' };
  if (START_COMMANDS.has(first)) return { type: 'start' };

  switch (first) {
    case 'HELP':
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
  help: HelpClient;
  optOuts: OptOutStore;
  sessions: InMemorySessionStore;
  limiter: SlidingWindowRateLimiter;
  config: SmsConfig;
  now?: () => number;
  /** Called when the AI request fails so the gateway can log it. */
  onAiError?: (error: unknown, question: string) => void;
  /** Called when the help desk cannot be reached. */
  onHelpError?: (error: unknown, phoneNumber: string) => void;
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
    const { sessions, limiter, config, optOuts } = this.deps;
    const session = sessions.getOrCreate(inbound.from, config.defaultLanguage);
    const command = parseCommand(inbound.body);

    // Compliance: opted-out numbers only get a response to START (and a repeat
    // confirmation for STOP). Everything else is dropped silently.
    if (optOuts.isOptedOut(inbound.from)) {
      if (command.type === 'start') {
        optOuts.optIn(inbound.from);
        session.pendingChunks = [];
        session.history = [];
        const messages = this.prepareReply(MESSAGES[session.language].welcome, session);
        sessions.save(session);
        return { messages, session, rateLimited: false };
      }

      if (command.type === 'stop') {
        sessions.save(session);
        return {
          messages: [MESSAGES[session.language].stopped],
          session,
          rateLimited: false,
        };
      }

      sessions.save(session);
      return { messages: [], session, rateLimited: false };
    }

    if (command.type === 'stop') {
      optOuts.optOut(inbound.from);
      session.pendingChunks = [];
      session.history = [];
      session.helpRequestedAt = undefined;
      sessions.save(session);
      return {
        messages: [MESSAGES[session.language].stopped],
        session,
        rateLimited: false,
      };
    }

    if (command.type === 'start') {
      optOuts.optIn(inbound.from);
      session.pendingChunks = [];
      session.history = [];
      const messages = this.prepareReply(MESSAGES[session.language].welcome, session);
      sessions.save(session);
      return { messages, session, rateLimited: false };
    }

    if (command.type === 'empty') {
      const messages = this.prepareReply(MESSAGES[session.language].empty, session);
      sessions.save(session);
      return { messages, session, rateLimited: false };
    }

    // HELP is exempt from the rate limit: someone asking for a person should
    // never be told to wait. Duplicate tickets are handled by the cooldown.
    if (command.type !== 'help') {
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
    }

    let messages: string[];

    switch (command.type) {
      case 'set-language':
        session.language = command.language ?? session.language;
        session.pendingChunks = [];
        session.history = [];
        messages = this.prepareReply(
          MESSAGES[session.language].languageChanged[session.language],
          session,
        );
        break;

      case 'help':
        messages = await this.requestHelp(session);
        break;

      case 'reset':
        session.pendingChunks = [];
        session.history = [];
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

  private async requestHelp(session: SmsSession): Promise<string[]> {
    const now = (this.deps.now ?? Date.now)();
    const cooldown = this.deps.config.helpRequestCooldownMs;

    if (session.helpRequestedAt && now - session.helpRequestedAt < cooldown) {
      return this.prepareReply(MESSAGES[session.language].helpPending, session);
    }

    try {
      await this.deps.help.requestHelp({
        phoneNumber: session.phoneNumber,
        language: session.language,
        conversationHistory: session.history,
      });
      session.helpRequestedAt = now;
      return this.prepareReply(MESSAGES[session.language].helpRequested, session);
    } catch (error) {
      this.deps.onHelpError?.(error, session.phoneNumber);
      return this.prepareReply(MESSAGES[session.language].helpUnavailable, session);
    }
  }

  private async answerQuestion(session: SmsSession, question: string): Promise<string[]> {
    const { config, ai } = this.deps;

    if (question.length > config.maxQuestionLength) {
      return this.prepareReply(MESSAGES[session.language].tooLong, session);
    }

    session.pendingChunks = [];

    // Keep the question even if the AI is down: a later HELP ticket should
    // include what the learner was trying to ask.
    const previousTurns = session.history.slice();
    this.remember(session, 'user', question);

    let answer: AiAnswer;
    try {
      answer = await ai.ask(question, session.language, previousTurns);
    } catch (error) {
      this.deps.onAiError?.(error, question);
      return this.prepareReply(MESSAGES[session.language].aiUnavailable, session);
    }

    this.remember(session, 'assistant', answer.answer);

    const citation = formatCitation(answer.citation, session.language);
    const text = citation ? `${answer.answer}\n${citation}` : answer.answer;

    return this.prepareReply(text, session);
  }

  private remember(session: SmsSession, role: 'user' | 'assistant', content: string): void {
    const trimmed = content.trim().slice(0, MAX_HISTORY_CONTENT_LENGTH);
    if (!trimmed) return;

    session.history.push({ role, content: trimmed });

    const maxTurns = Math.max(this.deps.config.maxHistoryTurns, 1);
    if (session.history.length > maxTurns) {
      session.history = session.history.slice(-maxTurns);
    }
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
