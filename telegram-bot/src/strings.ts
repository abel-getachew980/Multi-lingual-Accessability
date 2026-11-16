import type { Language } from './types';

/**
 * All learner-facing copy.
 *
 * Telegram renders plain text, so strings avoid Markdown: an unescaped `_` in
 * a filename would otherwise make the API reject the whole message.
 */

export interface BotStrings {
  welcome: string;
  help: string;
  askPrompt: string;
  menuTitle: string;
  languageTitle: string;
  languageChanged: Record<Language, string>;
  tutorRequested: (position?: number) => string;
  tutorPending: string;
  tutorUnavailable: string;
  tutorNotRequested: string;
  tutorCancelled: string;
  tutorCancelFailed: string;
  tutorStatus: (status: string, position?: number, waitMinutes?: number) => string;
  statusUnavailable: string;
  clearDone: string;
  empty: string;
  tooLong: string;
  rateLimited: (seconds: number) => string;
  aiUnavailable: string;
  voiceUnavailable: string;
  voiceTooLong: string;
  voiceTooLarge: string;
  voiceFailed: string;
  voiceNoTranscript: string;
  unexpected: string;
}

const STATUS_LABELS: Record<string, Record<Language, string>> = {
  pending: { am: 'በመጠባበቅ ላይ', en: 'Waiting for a tutor' },
  connected: { am: 'አማካሪ ተገናኝቷል', en: 'Tutor connected' },
  in_progress: { am: 'እርዳታ በሂደት ላይ', en: 'Help in progress' },
  resolved: { am: 'ተፈትቷል', en: 'Resolved' },
  cancelled: { am: 'ተሰርዟል', en: 'Cancelled' },
};

export function helpStatusLabel(
  status: string,
  language: Language,
): string {
  return STATUS_LABELS[status]?.[language] ?? status;
}

export const botStrings: Record<Language, BotStrings> = {
  am: {
    welcome:
      'እንኳን ደህና መጡ! የአማርኛ እና እንግሊዝኛ ቱቶር ነኝ።\n\n' +
      'ጥያቄዎን በጽሑፍ ይላኩ፣ ወይም በድምጽ መልእክት ይናገሩ። ከታች ያሉትን አዝራሮች መጠቀም ይችላሉ።',
    help:
      'እንዴት መጠቀም ይቻላል፦\n' +
      '• ጥያቄ ለመጠየቅ በቀላሉ ይጻፉ ወይም የድምጽ መልእክት ይላኩ።\n' +
      '• /language - ቋንቋ ይቀይሩ።\n' +
      '• /tutor - የሰው አማካሪ ይጠይቁ።\n' +
      '• /status - የእርዳታ ጥያቄዎን ሁኔታ ይመልከቱ።\n' +
      '• /cancel - የእርዳታ ጥያቄዎን ይሰርዙ።\n' +
      '• /clear - ውይይቱን ያጽዱ።',
    askPrompt: 'ጥያቄዎን ይጻፉ ወይም የድምጽ መልእክት ይላኩ።',
    menuTitle: 'ምን ማድረግ ይፈልጋሉ?',
    languageTitle: 'ቋንቋ ይምረጡ።',
    languageChanged: {
      am: 'ቋንቋ ወደ አማርኛ ተቀይሯል።',
      en: 'Language changed to English.',
    },
    tutorRequested: (position) =>
      position && position > 0
        ? `የእርዳታ ጥያቄዎ ተመዝግቧል። በሰልፍ ቦታዎ ${position} ነው። ሁኔታውን ለማየት /status ይላኩ።`
        : 'የእርዳታ ጥያቄዎ ተመዝግቧል። ሁኔታውን ለማየት /status ይላኩ።',
    tutorPending: 'የእርዳታ ጥያቄዎ ቀድሞ ተመዝግቧል። እባክዎ ይጠብቁ።',
    tutorUnavailable:
      'የእርዳታ ጥያቄውን መላክ አልቻልንም። እባክዎ በኋላ ይሞክሩ።',
    tutorNotRequested:
      'ንቁ የእርዳታ ጥያቄ የለም። አማካሪ ለመጠየቅ /tutor ይላኩ።',
    tutorCancelled: 'የእርዳታ ጥያቄዎ ተሰርዟል።',
    tutorCancelFailed:
      'ጥያቄውን መሰረዝ አልቻልንም። እባክዎ እንደገና ይሞክሩ።',
    tutorStatus: (status, position, waitMinutes) => {
      const label = helpStatusLabel(status, 'am');
      if (status === 'pending') {
        const parts = [label];
        if (position && position > 0) parts.push(`በሰልፍ ቦታ ${position}`);
        if (waitMinutes && waitMinutes > 0) {
          parts.push(`የመጠበቂያ ጊዜ ${waitMinutes} ደቂቃ`);
        }
        return `${parts.join('. ')}.`;
      }
      return label;
    },
    statusUnavailable:
      'የእርዳታ ጥያቄውን ሁኔታ ማየት አልቻልንም። እባክዎ በኋላ ይሞክሩ።',
    clearDone: 'ውይይቱ ጸድቷል። አዲስ ጥያቄ ይላኩ።',
    empty: 'እባክዎ ጥያቄ ይላኩ። እርዳታ ለማግኘት /tutor ይላኩ።',
    tooLong: 'ጥያቄው በጣም ረጅም ነው። እባክዎ በአጭሩ ይላኩ።',
    rateLimited: (seconds) =>
      `በጣም ብዙ መልእክቶች። እባክዎ ${seconds} ሰከንድ ይጠብቁ።`,
    aiUnavailable:
      'ይቅርታ፣ አሁን መልስ መስጠት አልቻልኩም። እባክዎ በኋላ ይሞክሩ።',
    voiceUnavailable:
      'የድምጽ መልእክቶችን በራስ-ሰር መረዳት አልቻልኩም። እባክዎ ጥያቄዎን በጽሑፍ ይላኩ።',
    voiceTooLong: 'የድምጽ መልእክቱ በጣም ረጅም ነው። እባክዎ በአጭሩ ይናገሩ።',
    voiceTooLarge: 'የድምጽ መልእክቱ በጣም ትልቅ ነው። እባክዎ በአጭሩ ይናገሩ።',
    voiceFailed:
      'የድምጽ መልእክቱን መረዳት አልቻልኩም። እባክዎ እንደገና ይሞክሩ ወይም በጽሑፍ ይላኩ።',
    voiceNoTranscript:
      'በድምጽ መልእክቱ ውስጥ ጥያቄ አልተረዳሁም። እባክዎ በጽሑፍ ይላኩ።',
    unexpected: 'ይቅርታ፣ ያልተጠበቀ ስህተት ተከስቷል። እባክዎ እንደገና ይሞክሩ።',
  },
  en: {
    welcome:
      "Welcome! I am your Amharic and English tutor.\n\n" +
      'Send a question as text, or record a voice message. You can also use the buttons below.',
    help:
      'How to use this bot:\n' +
      '• Send a question as text or as a voice message.\n' +
      '• /language - change the language.\n' +
      '• /tutor - ask for a human tutor.\n' +
      '• /status - check your help request.\n' +
      '• /cancel - cancel your help request.\n' +
      '• /clear - clear the conversation.',
    askPrompt: 'Send your question as text or as a voice message.',
    menuTitle: 'What would you like to do?',
    languageTitle: 'Choose a language.',
    languageChanged: {
      am: 'ቋንቋ ወደ አማርኛ ተቀይሯል።',
      en: 'Language changed to English.',
    },
    tutorRequested: (position) =>
      position && position > 0
        ? `Your help request is registered. You are number ${position} in the queue. Send /status to check the queue or see when a tutor joins.`
        : 'Your help request is registered. Send /status to check the queue or see when a tutor joins.',
    tutorPending:
      'Your help request is already registered. Please wait for a tutor.',
    tutorUnavailable:
      'We could not reach the help desk. Please try again in a few minutes.',
    tutorNotRequested:
      'You have no active help request. Send /tutor to ask for a human tutor.',
    tutorCancelled: 'Your help request was cancelled.',
    tutorCancelFailed:
      'We could not cancel the request. Please try again.',
    tutorStatus: (status, position, waitMinutes) => {
      const label = helpStatusLabel(status, 'en');
      if (status === 'pending') {
        const parts = [label];
        if (position && position > 0) parts.push(`Position ${position} in the queue`);
        if (waitMinutes && waitMinutes > 0) {
          parts.push(`Estimated wait ${waitMinutes} minutes`);
        }
        return `${parts.join('. ')}.`;
      }
      return label;
    },
    statusUnavailable:
      'We could not check the help request. Please try again later.',
    clearDone: 'Conversation cleared. Send a new question.',
    empty: 'Please send a question. Send /tutor for human help.',
    tooLong: 'Your question is too long. Please send a shorter one.',
    rateLimited: (seconds) =>
      `Too many messages. Please wait ${seconds} seconds.`,
    aiUnavailable:
      'Sorry, I could not answer right now. Please try again later.',
    voiceUnavailable:
      'I cannot understand voice messages on this deployment. Please send your question as text.',
    voiceTooLong: 'That voice message is too long. Please keep it shorter.',
    voiceTooLarge: 'That voice message is too large. Please keep it shorter.',
    voiceFailed:
      'I could not understand that voice message. Please try again, or send it as text.',
    voiceNoTranscript:
      'I could not hear a question in that voice message. Please send it as text.',
    unexpected: 'Sorry, something went wrong. Please try again.',
  },
};

export interface MenuLabels {
  ask: string;
  language: string;
  humanHelp: string;
  clear: string;
  requestHelp: string;
  status: string;
  cancelHelp: string;
  back: string;
  amharic: string;
  english: string;
  menu: string;
}

export const menuLabels: Record<Language, MenuLabels> = {
  am: {
    ask: '❓ ጥያቄ ጠይቅ',
    language: '🌐 ቋንቋ',
    humanHelp: '🙋 የሰው እርዳታ',
    clear: '🗑 ውይይት አጽዳ',
    requestHelp: '🙋 አማካሪ ጠይቅ',
    status: '📋 ሁኔታ',
    cancelHelp: '❌ ጥያቄ ሰርዝ',
    back: '← ተመለስ',
    amharic: 'አማርኛ',
    english: 'English',
    menu: '☰ ዝርዝር',
  },
  en: {
    ask: '❓ Ask a question',
    language: '🌐 Language',
    humanHelp: '🙋 Human help',
    clear: '🗑 Clear conversation',
    requestHelp: '🙋 Request a tutor',
    status: '📋 Status',
    cancelHelp: '❌ Cancel request',
    back: '← Back',
    amharic: 'አማርኛ',
    english: 'English',
    menu: '☰ Menu',
  },
};
