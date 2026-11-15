import type { HumanHelpStatus, Language } from '@/types';
import { translations } from '@/i18n/translations';

interface HumanHelpCopy {
  request: string;
  cancel: string;
  dialogTitle: string;
  confirm: string;
  close: string;
  noActive: string;
  statusLabel: string;
  status: Record<HumanHelpStatus, string>;
  queuePosition: (position: number) => string;
  estimatedWait: (wait: string) => string;
  tutor: (tutorId: string) => string;
  cancelRequest: string;
  shareScreen: string;
  stopScreenShare: string;
  screenShareHint: string;
  screenShareUnsupported: string;
  screenShareNotConfigured: string;
  screenShareError: string;
  onlyConnected: string;
  viewRequest: string;
}

function sharedLabels(language: Language) {
  return {
    request: translations[language].requestHumanHelp,
    cancel: translations[language].cancelHelp,
    cancelRequest: translations[language].cancelHelp,
    shareScreen: translations[language].screenShare,
    stopScreenShare: translations[language].stopScreenShare,
  };
}

export const humanHelpCopy: Record<Language, HumanHelpCopy> = {
  en: {
    ...sharedLabels('en'),
    dialogTitle: 'Human help',
    confirm: 'Request human help? Your conversation will be shared.',
    close: 'Close help dialog',
    noActive: 'No active human help request.',
    statusLabel: 'Status',
    status: {
      pending: 'Waiting for a tutor',
      connected: 'Connected to a tutor',
      in_progress: 'Help in progress',
      resolved: 'Help resolved',
      cancelled: 'Request cancelled',
    },
    queuePosition: (position) => `Position in queue: ${position}`,
    estimatedWait: (wait) => `Estimated wait: ${wait}`,
    tutor: (tutorId) => `Tutor: ${tutorId}`,
    screenShareHint: 'Your tutor can see your screen. You can stop sharing at any time.',
    screenShareUnsupported: 'Screen sharing is not supported in this browser.',
    screenShareNotConfigured: 'Screen sharing is not configured.',
    screenShareError: 'Could not start screen sharing.',
    onlyConnected: 'You must be connected to a tutor first.',
    viewRequest: 'View human help request',
  },
  am: {
    ...sharedLabels('am'),
    dialogTitle: 'የሰው እርዳታ',
    confirm: 'የሰው እርዳታ ይጠይቁ? ውይይትዎ ይጋራል።',
    close: 'የእርዳታ መስኮቱን ይዝጉ',
    noActive: 'ገባሪ የሰው እርዳታ ጥያቄ የለም።',
    statusLabel: 'ሁኔታ',
    status: {
      pending: 'ለሰው እርዳታ በመጠበቅ ላይ',
      connected: 'ከአስተማሪ ጋር ተገናኝተዋል',
      in_progress: 'እርዳታ በሂደት ላይ',
      resolved: 'እርዳታ ተጠናቅቋል',
      cancelled: 'ጥያቄው ተሰርዟል',
    },
    queuePosition: (position) => `በሰልፍ ላይ ያለው ቦታ፦ ${position}`,
    estimatedWait: (wait) => `የግምት ጊዜ፦ ${wait}`,
    tutor: (tutorId) => `አስተማሪ፦ ${tutorId}`,
    screenShareHint: 'አስተማሪው ስክሪንዎን እንዲያይ ይፈቅዳል። ማንኛውንም ጊዜ ማቆም ይችላሉ።',
    screenShareUnsupported: 'ይህ አሳሽ የስክሪን መጋራትን አይደግፍም።',
    screenShareNotConfigured: 'የስክሪን መጋራት አገልግሎት አልተዋቀረም።',
    screenShareError: 'ስክሪን ማጋራት መጀመር አልተቻለም።',
    onlyConnected: 'መጀመሪያ ከአስተማሪ ጋር መገናኘት አለብዎ።',
    viewRequest: 'የሰው እርዳታ ጥያቄን ይመልከቱ',
  },
};
