import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { axe } from 'jest-axe';
import type { HumanHelpRequest, UserPreferences } from '@/types';
import { DEFAULT_PREFERENCES } from '@/services/storage';
import { MessageInput } from '@/components/Chat/MessageInput';
import { SettingsPanel } from '@/components/Settings';
import {
  HumanHelpModal,
  StatusNotifier,
} from '@/components/HumanHelp';

function defaultPreferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

function helpRequest(overrides: Partial<HumanHelpRequest> = {}): HumanHelpRequest {
  return {
    id: 'help-1',
    userId: 'learner-1',
    conversationHistory: [],
    timestamp: new Date('2026-01-01T10:00:00Z'),
    status: 'pending',
    screenShareEnabled: false,
    position: 2,
    estimatedWaitMinutes: 4,
    ...overrides,
  };
}

async function expectNoViolations(element: ReactElement): Promise<void> {
  const { container } = render(element);
  expect(await axe(container)).toHaveNoViolations();
}

describe('axe audits', () => {
  it('finds no violations in the message composer (English)', async () => {
    await expectNoViolations(
      <MessageInput onSend={jest.fn()} language="en" />,
    );
  });

  it('finds no violations in the message composer (Amharic)', async () => {
    await expectNoViolations(
      <MessageInput onSend={jest.fn()} language="am" />,
    );
  });

  it('finds no violations in the settings dialog', async () => {
    await expectNoViolations(
      <SettingsPanel
        isOpen
        preferences={defaultPreferences()}
        onChange={jest.fn()}
        onClose={jest.fn()}
        onReset={jest.fn()}
      />,
    );
  });

  it('finds no violations in the help confirmation dialog', async () => {
    await expectNoViolations(
      <HumanHelpModal
        isOpen
        request={null}
        language="en"
        isRequesting={false}
        error={null}
        screenShareActive={false}
        onRequest={jest.fn()}
        onCancel={jest.fn()}
        onClose={jest.fn()}
        onScreenShareChange={jest.fn()}
      />,
    );
  });

  it('finds no violations while a learner waits in the queue', async () => {
    await expectNoViolations(
      <HumanHelpModal
        isOpen
        request={helpRequest()}
        language="am"
        isRequesting={false}
        error={null}
        screenShareActive={false}
        onRequest={jest.fn()}
        onCancel={jest.fn()}
        onClose={jest.fn()}
        onScreenShareChange={jest.fn()}
      />,
    );
  });

  it('finds no violations once a tutor connects', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia: jest.fn() },
    });

    await expectNoViolations(
      <HumanHelpModal
        isOpen
        request={helpRequest({
          status: 'connected',
          position: 0,
          assignedTutor: 'Sara',
        })}
        language="en"
        isRequesting={false}
        error={null}
        screenShareActive={false}
        onRequest={jest.fn()}
        onCancel={jest.fn()}
        onClose={jest.fn()}
        onScreenShareChange={jest.fn()}
      />,
    );
  });

  it('finds no violations in an error state', async () => {
    await expectNoViolations(
      <HumanHelpModal
        isOpen
        request={null}
        language="en"
        isRequesting={false}
        error="Could not request help. Please try again."
        screenShareActive={false}
        onRequest={jest.fn()}
        onCancel={jest.fn()}
        onClose={jest.fn()}
        onScreenShareChange={jest.fn()}
      />,
    );
  });

  it('finds no violations in the live queue status', async () => {
    await expectNoViolations(
      <StatusNotifier request={helpRequest()} language="en" />,
    );
  });
});
