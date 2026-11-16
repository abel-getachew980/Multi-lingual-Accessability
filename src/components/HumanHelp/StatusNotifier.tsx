'use client';

import type { HumanHelpRequest, Language } from '@/types';
import { describeHelpRequest } from './strings';

interface StatusNotifierProps {
  request: HumanHelpRequest | null;
  language: Language;
}

/**
 * Global live region for help status changes.
 *
 * It stays mounted even when the dialog is closed, so a learner who is waiting
 * hears when a tutor joins instead of having to re-open the dialog.
 */
export function StatusNotifier({ request, language }: StatusNotifierProps) {
  const text = request ? describeHelpRequest(request, language) : '';

  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="help-status-announcer"
    >
      {text}
    </div>
  );
}
