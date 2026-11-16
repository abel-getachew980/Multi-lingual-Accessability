import type { AiClient } from './aiClient';
import { CALLBACK, helpMenu, isActiveHelp, languageMenu, mainMenu, pendingHelpMenu } from './keyboardBuilder';
import type { HelpClient } from './helpClient';
import { SlidingWindowRateLimiter } from './rateLimiter';
import type { InMemorySessionStore } from './sessionManager';
import { botStrings, menuLabels } from './strings';
import type { TelegramApi } from './telegramClient';
import type {
  BotConfig,
  ChatSession,
  ChatSession as Session,
  Citation,
  HandleResult,
  Language,
  ParsedCommand,
  TelegramMessage,
  TelegramUpdate,
} from './types';
import type { VoiceHandler } from './voiceHandler';

const MAX_HISTORY_CONTENT_LENGTH = 600;

export interface MessageHandlerDeps {
  api: TelegramApi;
  ai: AiClient;
  help: HelpClient;
  sessions: InMemorySessionStore;
  limiter: SlidingWindowRateLimiter;
  voice?: VoiceHandler;
  config: BotConfig['behaviour'];
  now?: () => number;
  onAiError?: (error: unknown, question: string) => void;
  onHelpError?: (error: unknown, chatId: string) => void;
  onVoiceError?: (error: unknown) => void;
}

const SLASH_COMMANDS = new Set([
  'start',
  'help',
  'language',
  'lang',
  'tutor',
  'status',
  'cancel',
  'clear',
  'menu',
]);

/**
 * Parses text or a slash command.
 *
 * `/command@BotName` is accepted because Telegram groups append the bot's
 * username to commands. Anything that is not a command is a question.
 */
export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return { type: 'empty' };

  if (!trimmed.startsWith('/')) {
    return { type: 'question', question: trimmed };
  }

  const [head = '', ...restTokens] = trimmed.split(' ');
  const command = head.slice(1).split('@')[0]?.toLowerCase() ?? '';
  const args = restTokens.join(' ').trim();
  const lowerArgs = args.toLowerCase();

  if (!SLASH_COMMANDS.has(command)) {
    return { type: 'question', question: trimmed };
  }

  switch (command) {
    case 'start':
      return { type: 'start' };
    case 'help':
      return { type: 'help' };
    case 'menu':
      return { type: 'menu' };
    case 'language':
    case 'lang':
      if (!args) return { type: 'language' };
      if (['am', 'amharic', 'አማርኛ'].includes(lowerArgs)) {
        return { type: 'set-language', language: 'am' };
      }
      if (['en', 'english', 'እንግሊዝኛ'].includes(lowerArgs)) {
        return { type: 'set-language', language: 'en' };
      }
      return { type: 'language' };
    case 'tutor':
      return { type: 'tutor' };
    case 'status':
      return { type: 'status' };
    case 'cancel':
      return { type: 'cancel' };
    case 'clear':
      return { type: 'clear' };
    default:
      return { type: 'empty' };
  }
}

export function formatCitation(
  citation: Citation | undefined,
  language: Language,
): string | null {
  if (!citation?.source) return null;

  let label = citation.source.trim();
  if (citation.section) label += `, ${citation.section}`;
  if (typeof citation.page === 'number') label += `, p. ${citation.page}`;

  return language === 'am' ? `ምንጭ: ${label}` : `Source: ${label}`;
}

/**
 * Turns Telegram updates into replies.
 *
 * The handler owns the conversation flow; the API client only moves bytes.
 * That separation lets the tests drive a whole conversation with a fake API
 * and makes every message assertion exact.
 */
export class MessageHandler {
  constructor(private readonly deps: MessageHandlerDeps) {}

  async handleUpdate(update: TelegramUpdate): Promise<HandleResult> {
    if (update.callback_query) {
      await this.handleCallback(update);
      return { handled: true };
    }

    const message = update.message;
    if (!message || !message.chat || message.from?.is_bot) {
      return { handled: false };
    }

    const session = this.deps.sessions.getOrCreate(
      String(message.chat.id),
      this.deps.config.defaultLanguage,
    );

    try {
      await this.routeMessage(message, session);
    } catch (error) {
      console.error('[telegram] could not handle update', error);
      await this.safeSend(message.chat.id, this.strings(session).unexpected);
    } finally {
      this.deps.sessions.save(session);
    }

    return { handled: true };
  }

  private async handleCallback(update: TelegramUpdate): Promise<void> {
    const query = update.callback_query;
    if (!query) return;

    // Telegram keeps a spinner on the button until the query is answered,
    // even when the action itself fails.
    try {
      await this.deps.api.answerCallbackQuery(query.id);
    } catch {
      // Ignore: the visible reply still goes through.
    }

    const chatId = query.message?.chat.id;
    if (chatId === undefined || query.from.is_bot) return;

    const session = this.deps.sessions.getOrCreate(
      String(chatId),
      this.deps.config.defaultLanguage,
    );

    try {
      switch (query.data) {
        case CALLBACK.ask:
          await this.deps.api.sendMessage(
            chatId,
            this.strings(session).askPrompt,
          );
          break;

        case CALLBACK.language:
          await this.deps.api.sendMessage(
            chatId,
            this.strings(session).languageTitle,
            { reply_markup: languageMenu(session.language) },
          );
          break;

        case CALLBACK.humanHelp:
          await this.deps.api.sendMessage(
            chatId,
            this.strings(session).menuTitle,
            { reply_markup: helpMenu(session.language, isActiveHelp(session)) },
          );
          break;

        case CALLBACK.clear:
          await this.clearConversation(chatId, session);
          break;

        case CALLBACK.back:
          await this.sendMainMenu(chatId, session);
          break;

        case CALLBACK.requestHelp:
          await this.requestHelp(chatId, session);
          break;

        case CALLBACK.helpStatus:
          await this.sendStatus(chatId, session);
          break;

        case CALLBACK.cancelHelp:
          await this.cancelHelp(chatId, session);
          break;

        case CALLBACK.languageAm:
          await this.setLanguage(chatId, session, 'am');
          break;

        case CALLBACK.languageEn:
          await this.setLanguage(chatId, session, 'en');
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('[telegram] could not handle callback', error);
      await this.safeSend(chatId, this.strings(session).unexpected);
    } finally {
      this.deps.sessions.save(session);
    }
  }

  private async routeMessage(
    message: TelegramMessage,
    session: Session,
  ): Promise<void> {
    const chatId = message.chat.id;
    const text = (message.text ?? message.caption ?? '').trim();
    const command = parseCommand(text);

    if (!text && message.voice) {
      await this.handleVoice(chatId, session, message);
      return;
    }

    switch (command.type) {
      case 'start':
        await this.deps.api.sendMessage(
          chatId,
          this.strings(session).welcome,
          { reply_markup: mainMenu(session.language) },
        );
        return;

      case 'menu':
        await this.sendMainMenu(chatId, session);
        return;

      case 'help':
        await this.deps.api.sendMessage(
          chatId,
          this.strings(session).help,
          { reply_markup: mainMenu(session.language) },
        );
        return;

      case 'language':
        await this.deps.api.sendMessage(
          chatId,
          this.strings(session).languageTitle,
          { reply_markup: languageMenu(session.language) },
        );
        return;

      case 'set-language':
        if (command.language) {
          await this.setLanguage(chatId, session, command.language);
        }
        return;

      case 'tutor':
        await this.requestHelp(chatId, session);
        return;

      case 'status':
        await this.sendStatus(chatId, session);
        return;

      case 'cancel':
        await this.cancelHelp(chatId, session);
        return;

      case 'clear':
        await this.clearConversation(chatId, session);
        return;

      case 'empty':
        await this.deps.api.sendMessage(
          chatId,
          this.strings(session).empty,
          { reply_markup: mainMenu(session.language) },
        );
        return;

      case 'question':
      default:
        await this.answerQuestion(chatId, session, command.question ?? text);
    }
  }

  private async answerQuestion(
    chatId: number,
    session: Session,
    question: string,
    options: { skipRateLimit?: boolean } = {},
  ): Promise<void> {
    const strings = this.strings(session);

    if (!options.skipRateLimit) {
      const limit = this.deps.limiter.check(String(chatId));

      if (!limit.allowed) {
        const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1_000));
        await this.safeSend(chatId, strings.rateLimited(seconds));
        return;
      }
    }

    if (question.length > this.deps.config.maxQuestionLength) {
      await this.safeSend(chatId, strings.tooLong);
      return;
    }

    const previousTurns = session.history.slice();
    this.remember(session, 'user', question);

    await this.tryTyping(chatId);

    try {
      const answer = await this.deps.ai.ask(
        question,
        session.language,
        previousTurns,
      );

      this.remember(session, 'assistant', answer.answer);

      const citation = formatCitation(answer.citation, session.language);
      await this.safeSend(
        chatId,
        citation ? `${answer.answer}\n\n${citation}` : answer.answer,
      );
    } catch (error) {
      this.deps.onAiError?.(error, question);
      await this.safeSend(chatId, strings.aiUnavailable);
    }
  }

  private async handleVoice(
    chatId: number,
    session: Session,
    message: TelegramMessage,
  ): Promise<void> {
    const strings = this.strings(session);
    const voice = message.voice;
    if (!voice) return;

    const limit = this.deps.limiter.check(String(chatId));
    if (!limit.allowed) {
      const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1_000));
      await this.safeSend(chatId, strings.rateLimited(seconds));
      return;
    }

    if (!this.deps.voice || !this.deps.voice.isConfigured()) {
      await this.safeSend(chatId, strings.voiceUnavailable);
      return;
    }

    await this.tryTyping(chatId);
    const result = await this.deps.voice.transcribe(voice, session.language);

    if (!result.ok) {
      if (result.reason === 'unavailable') {
        await this.safeSend(chatId, strings.voiceUnavailable);
      } else if (result.reason === 'too-long') {
        await this.safeSend(chatId, strings.voiceTooLong);
      } else if (result.reason === 'too-large') {
        await this.safeSend(chatId, strings.voiceTooLarge);
      } else if (result.reason === 'empty') {
        await this.safeSend(chatId, strings.voiceNoTranscript);
      } else {
        await this.safeSend(chatId, strings.voiceFailed);
      }
      return;
    }

    await this.answerQuestion(chatId, session, result.text, {
      skipRateLimit: true,
    });
  }

  private async requestHelp(chatId: number, session: Session): Promise<void> {
    const strings = this.strings(session);
    const now = (this.deps.now ?? Date.now)();

    if (isActiveHelp(session)) {
      await this.deps.api.sendMessage(chatId, strings.tutorPending, {
        reply_markup: pendingHelpMenu(session.language),
      });
      return;
    }

    if (
      session.helpRequestedAt &&
      now - session.helpRequestedAt < this.deps.config.helpRequestCooldownMs
    ) {
      await this.deps.api.sendMessage(chatId, strings.tutorPending, {
        reply_markup: pendingHelpMenu(session.language),
      });
      return;
    }

    try {
      const result = await this.deps.help.requestHelp({
        chatId: String(chatId),
        language: session.language,
        conversationHistory: session.history,
      });

      // Only now is a tutor actually queued: the id comes from the help desk.
      session.helpRequestId = result.requestId;
      session.helpStatus = result.status ?? 'pending';
      session.helpPosition = result.position;
      session.helpRequestedAt = now;

      await this.deps.api.sendMessage(
        chatId,
        strings.tutorRequested(result.position),
        { reply_markup: pendingHelpMenu(session.language) },
      );
    } catch (error) {
      this.deps.onHelpError?.(error, String(chatId));
      await this.deps.api.sendMessage(chatId, strings.tutorUnavailable, {
        reply_markup: helpMenu(session.language, false),
      });
    }
  }

  private async sendStatus(chatId: number, session: Session): Promise<void> {
    const strings = this.strings(session);

    if (!session.helpRequestId) {
      await this.deps.api.sendMessage(chatId, strings.tutorNotRequested, {
        reply_markup: helpMenu(session.language, false),
      });
      return;
    }

    try {
      const status = await this.deps.help.getStatus(session.helpRequestId);

      session.helpStatus = status.status;
      session.helpPosition = status.position;

      if (status.status === 'resolved' || status.status === 'cancelled') {
        session.helpRequestId = undefined;
        session.helpPosition = undefined;
      }

      await this.deps.api.sendMessage(
        chatId,
        strings.tutorStatus(
          status.status,
          status.position,
          status.estimatedWaitMinutes,
        ),
        {
          reply_markup:
            status.status === 'pending'
              ? pendingHelpMenu(session.language)
              : helpMenu(session.language, isActiveHelp(session)),
        },
      );
    } catch (error) {
      this.deps.onHelpError?.(error, String(chatId));
      await this.deps.api.sendMessage(chatId, strings.statusUnavailable, {
        reply_markup: pendingHelpMenu(session.language),
      });
    }
  }

  private async cancelHelp(chatId: number, session: Session): Promise<void> {
    const strings = this.strings(session);

    if (!session.helpRequestId) {
      await this.deps.api.sendMessage(chatId, strings.tutorNotRequested, {
        reply_markup: helpMenu(session.language, false),
      });
      return;
    }

    try {
      await this.deps.help.cancel(session.helpRequestId);
      session.helpRequestId = undefined;
      session.helpStatus = undefined;
      session.helpPosition = undefined;

      await this.deps.api.sendMessage(chatId, strings.tutorCancelled, {
        reply_markup: helpMenu(session.language, false),
      });
    } catch (error) {
      // The tutor may still be on the way, so the ticket is kept.
      this.deps.onHelpError?.(error, String(chatId));
      await this.deps.api.sendMessage(chatId, strings.tutorCancelFailed, {
        reply_markup: pendingHelpMenu(session.language),
      });
    }
  }

  private async setLanguage(
    chatId: number,
    session: Session,
    language: Language,
  ): Promise<void> {
    session.language = language;
    // The context belonged to the previous language, and mixing them would
    // confuse both the AI and the learner.
    session.history = [];

    const strings = this.strings(session);
    await this.deps.api.sendMessage(
      chatId,
      strings.languageChanged[language],
      { reply_markup: mainMenu(language) },
    );
  }

  private async clearConversation(
    chatId: number,
    session: Session,
  ): Promise<void> {
    session.history = [];
    // Keep an active help ticket: clearing the chat must not orphan it.
    await this.deps.api.sendMessage(
      chatId,
      this.strings(session).clearDone,
      { reply_markup: mainMenu(session.language) },
    );
  }

  private async sendMainMenu(
    chatId: number,
    session: Session,
  ): Promise<void> {
    await this.deps.api.sendMessage(
      chatId,
      this.strings(session).menuTitle,
      { reply_markup: mainMenu(session.language) },
    );
  }

  private remember(
    session: ChatSession,
    role: 'user' | 'assistant',
    content: string,
  ): void {
    const trimmed = content.trim().slice(0, MAX_HISTORY_CONTENT_LENGTH);
    if (!trimmed) return;

    session.history.push({ role, content: trimmed });

    const maxTurns = Math.max(this.deps.config.maxHistoryTurns, 1);
    if (session.history.length > maxTurns) {
      session.history = session.history.slice(-maxTurns);
    }
  }

  private async tryTyping(chatId: number): Promise<void> {
    try {
      await this.deps.api.sendChatAction(chatId, 'typing');
    } catch {
      // Typing feedback is a nicety; never fail a question over it.
    }
  }

  private async safeSend(
    chatId: number,
    text: string,
    options?: Parameters<TelegramApi['sendMessage']>[2],
  ): Promise<void> {
    try {
      await this.deps.api.sendMessage(chatId, text, options);
    } catch (error) {
      console.error('[telegram] could not send a message', error);
    }
  }

  private strings(session: Session) {
    return botStrings[session.language];
  }
}

// Re-exported so the bot factory and tests share the menu labels.
export { menuLabels };
