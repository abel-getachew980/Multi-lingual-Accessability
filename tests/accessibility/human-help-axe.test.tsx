/** @jest-environment jsdom */

import { useEffect, useRef } from 'react';
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { TutorProvider, useTutor } from '@/context/TutorContext';
import { HumanHelpModal } from '@/components/HumanHelp/HumanHelpModal';

function HelpModalHarness() {
  const { requestHumanHelp } = useTutor();
  const requested = useRef(false);

  useEffect(() => {
    if (!requested.current) {
      requested.current = true;
      requestHumanHelp();
    }
  }, [requestHumanHelp]);

  return <HumanHelpModal />;
}

beforeEach(() => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/help') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          requestId: 'help-axe',
          status: 'pending',
          position: 1,
          estimatedWait: '2 minutes',
        }),
      });
    }

    return new Promise(() => undefined);
  }) as unknown as typeof fetch;
});

it('has no serious or critical axe violations', async () => {
  const { container } = render(
    <TutorProvider>
      <HelpModalHarness />
    </TutorProvider>,
  );

  await screen.findByRole('dialog');

  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(serious).toEqual([]);
});
