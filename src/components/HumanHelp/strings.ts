import type { HumanHelpStatus, Language } from '@/types';

/** Strings used by the human help UI. Kept together so both languages stay in sync. */

export const statusLabels: Record<HumanHelpStatus, Record<Language, string>> = {
  pending: { am: 'በመጠባበቅ ላይ', en: 'Waiting for a tutor' },
  connected: { am: 'አማካሪ ተገናኝቷል', en: 'Tutor connected' },
  in_progress: { am: 'እርዳታ በሂደት ላይ', en: 'Help in progress' },
  resolved: { am: 'ተፈትቷል', en: 'Resolved' },
  cancelled: { am: 'ተሰርዟል', en: 'Cancelled' },
};

export const helpStrings = {
  am: {
    dialogTitle: 'የሰው እርዳታ',
    confirmTitle: 'የሰው አማካሪ ይጠይቁ?',
    confirmBody:
      'አማካሪው የቅርብ ጊዜ ውይይትዎን ያያል። መስኮትዎን የሚያጋሩት እርስዎ ሲፈቅዱ ብቻ ነው።',
    privacyNote: 'የተመረጡት 20 መልእክቶች ብቻ ይላካሉ።',
    request: 'እርዳታ ጠይቅ',
    requesting: 'በመጠየቅ ላይ...',
    cancelRequest: 'ጥያቄውን ሰርዝ',
    close: 'ዝጋ',
    retry: 'እንደገና ሞክር',
    statusTitle: 'የእርዳታ ሁኔታ',
    screenShareTitle: 'መስኮት ማጋራት',
    screenShareBody:
      'አማካሪው ችግሩን እንዲያይ መስኮትዎን ማጋራት ይችላሉ። በማንኛውም ጊዜ ማቆም ይችላሉ።',
    sharingNow: 'መስኮትዎ አሁን በመጋራት ላይ ነው።',
    startSharing: 'መስኮት አጋራ',
    stopSharing: 'ማጋራት አቁም',
    starting: 'በመጀመር ላይ...',
    shareUnsupported: 'ይህ አሳሽ መስኮት ማጋራትን አይደግፍም።',
    sharePermissionDenied: 'የመስኮት ማጋራት ፈቃድ አልተሰጠም።',
    shareCancelled: 'መስኮት ማጋራት ተሰርዟል።',
    shareFailed: 'መስኮት ማጋራት አልተቻለም።',
    requestFailed: 'እርዳታ መጠየቅ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    cancelFailed: 'ጥያቄውን መሰረዝ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
    offline: 'እርዳታ ለመጠየቅ የኢንተርኔት ግንኙነት ያስፈልጋል።',
    resolvedHint: 'አማካሪው እርዳታውን ጨርሷል። አስፈላጊ ከሆነ አዲስ ጥያቄ መጠየቅ ይችላሉ።',
    activeButton: 'የእርዳታ ሁኔታ',
  },
  en: {
    dialogTitle: 'Human help',
    confirmTitle: 'Request a human tutor?',
    confirmBody:
      'A tutor will see your recent conversation. Your screen is shared only if you choose to share it.',
    privacyNote: 'Only the last 20 messages are sent.',
    request: 'Request help',
    requesting: 'Requesting...',
    cancelRequest: 'Cancel request',
    close: 'Close',
    retry: 'Try again',
    statusTitle: 'Help status',
    screenShareTitle: 'Screen sharing',
    screenShareBody:
      'You can share your screen so the tutor can see the problem. You can stop at any time.',
    sharingNow: 'Your screen is being shared.',
    startSharing: 'Share screen',
    stopSharing: 'Stop sharing',
    starting: 'Starting...',
    shareUnsupported: 'This browser does not support screen sharing.',
    sharePermissionDenied: 'Screen sharing permission was denied.',
    shareCancelled: 'Screen sharing was cancelled.',
    shareFailed: 'Screen sharing could not start.',
    requestFailed: 'Could not request help. Please try again.',
    cancelFailed: 'Could not cancel the request. Please try again.',
    offline: 'An internet connection is required to request help.',
    resolvedHint: 'The tutor has finished. You can request help again if needed.',
    activeButton: 'Help status',
  },
} as const;

export interface HelpStatusSummary {
  status: HumanHelpStatus;
  position?: number;
  estimatedWaitMinutes?: number;
  assignedTutor?: string;
}

/** One sentence describing the current state, used by the live region. */
export function describeHelpRequest(
  request: HelpStatusSummary,
  language: Language,
): string {
  const label = statusLabels[request.status][language];

  if (request.status === 'pending') {
    const parts = [label];

    if (request.position && request.position > 0) {
      parts.push(
        language === 'am'
          ? `በሰልፍ ቦታ ${request.position}`
          : `Position ${request.position} in the queue`,
      );
    }

    if (request.estimatedWaitMinutes && request.estimatedWaitMinutes > 0) {
      parts.push(
        language === 'am'
          ? `የመጠበቂያ ጊዜ ${request.estimatedWaitMinutes} ደቂቃ`
          : `Estimated wait ${request.estimatedWaitMinutes} minutes`,
      );
    }

    return `${parts.join('. ')}.`;
  }

  if (request.status === 'connected' || request.status === 'in_progress') {
    return request.assignedTutor ? `${label} - ${request.assignedTutor}` : label;
  }

  if (request.status === 'resolved') {
    return language === 'am'
      ? 'እርዳታው ተጠናቋል።'
      : 'This help session is complete.';
  }

  return language === 'am'
    ? 'የእርዳታ ጥያቄው ተሰርዟል።'
    : 'The help request was cancelled.';
}
