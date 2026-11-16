import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '@/components/Chat/MessageInput';
import {
  getFocusableElements,
  trapFocus,
} from '@/utils/focusTrap';
import {
  handleListNavigation,
  skipToMainContent,
} from '@/utils/accessibility';

function buildDialog(): HTMLElement {
  document.body.innerHTML = `
    <button id="outside">Outside</button>
    <div id="dialog">
      <button id="first">First</button>
      <button id="disabled" disabled>Disabled</button>
      <div hidden><button id="hidden">Hidden</button></div>
      <div aria-hidden="true"><button id="aria-hidden">Aria hidden</button></div>
      <button id="last">Last</button>
    </div>
  `;

  return document.getElementById('dialog') as HTMLElement;
}

describe('focus trap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('only lists controls that can actually receive focus', () => {
    const dialog = buildDialog();

    expect(getFocusableElements(dialog).map((element) => element.id)).toEqual([
      'first',
      'last',
    ]);
  });

  it('focuses the first control and keeps Tab inside', () => {
    const dialog = buildDialog();
    const outside = document.getElementById('outside') as HTMLElement;
    outside.focus();

    const release = trapFocus(dialog);

    expect(document.getElementById('first')).toHaveFocus();

    (document.getElementById('last') as HTMLElement).focus();
    fireEvent.keyDown(document.getElementById('last') as HTMLElement, {
      key: 'Tab',
    });
    expect(document.getElementById('first')).toHaveFocus();

    fireEvent.keyDown(document.getElementById('first') as HTMLElement, {
      key: 'Tab',
      shiftKey: true,
    });
    expect(document.getElementById('last')).toHaveFocus();

    release();
  });

  it('pulls focus back when something focuses outside the dialog', () => {
    const dialog = buildDialog();
    const release = trapFocus(dialog);

    (document.getElementById('outside') as HTMLElement).focus();

    expect(document.getElementById('first')).toHaveFocus();
    release();
  });

  it('restores focus to the trigger and can be released twice', () => {
    const dialog = buildDialog();
    const outside = document.getElementById('outside') as HTMLElement;
    outside.focus();

    const release = trapFocus(dialog);
    release();
    expect(outside).toHaveFocus();

    release();
    expect(outside).toHaveFocus();
  });

  it('supports an explicit initial focus and Escape callback', () => {
    const dialog = buildDialog();
    const onEscape = jest.fn();

    const release = trapFocus(dialog, {
      initialFocus: document.getElementById('last') as HTMLElement,
      onEscape,
    });

    expect(document.getElementById('last')).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);

    release();
  });

  it('lets only the most recently opened dialog keep focus', () => {
    document.body.innerHTML = `
      <div id="first"><button id="first-control">First</button></div>
      <div id="second"><button id="second-control">Second</button></div>
    `;

    const first = document.getElementById('first') as HTMLElement;
    const second = document.getElementById('second') as HTMLElement;

    const releaseFirst = trapFocus(first);
    const releaseSecond = trapFocus(second);

    expect(document.getElementById('second-control')).toHaveFocus();

    (document.getElementById('first-control') as HTMLElement).focus();
    expect(document.getElementById('second-control')).toHaveFocus();

    releaseSecond();
    releaseFirst();
  });

  it('keeps focus in a dialog with no controls', () => {
    document.body.innerHTML = '<div id="dialog"><p>Nothing to focus</p></div>';
    const dialog = document.getElementById('dialog') as HTMLElement;

    const release = trapFocus(dialog);

    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog).toHaveFocus();

    release();
    expect(dialog).not.toHaveAttribute('tabindex');
  });
});

describe('MessageInput keyboard use', () => {
  function setup() {
    const onSend = jest.fn();
    const utils = render(<MessageInput onSend={onSend} language="en" />);

    return {
      ...utils,
      onSend,
      user: userEvent.setup(),
      textarea: screen.getByRole('textbox', { name: 'Type your message' }),
    };
  }

  it('follows a logical tab order through every action', async () => {
    const { user, textarea } = setup();

    await user.tab();
    expect(textarea).toHaveFocus();

    await user.type(textarea, 'Hello');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Voice input' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus();
  });

  it('sends with Enter and leaves Shift+Enter for a new line', async () => {
    const { user, textarea, onSend } = setup();

    await user.click(textarea);
    await user.type(textarea, 'Hello{Enter}');

    expect(onSend).toHaveBeenCalledWith('Hello');

    await user.type(textarea, 'Line one{Shift>}{Enter}{/Shift}Line two');

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(textarea).toHaveValue('Line one\nLine two');
  });

  it('does not send an empty message', async () => {
    const { user, textarea, onSend } = setup();

    await user.click(textarea);
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears the field and returns focus to the textarea', async () => {
    const { user, textarea } = setup();

    await user.type(textarea, 'Draft');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(textarea).toHaveValue('');
    expect(textarea).toHaveFocus();
  });

  it('announces the character count politely after 500 characters', () => {
    const { textarea } = setup();

    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } });

    const counter = screen.getByText('501 / 2000');
    expect(counter).toHaveAttribute('aria-live', 'polite');
  });
});

describe('list keyboard navigation', () => {
  function key(keyName: string, shiftKey = false) {
    return {
      key: keyName,
      shiftKey,
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;
  }

  it('moves with the arrow keys and wraps', () => {
    const onSelect = jest.fn();

    handleListNavigation(key('ArrowDown'), 2, 3, onSelect);
    expect(onSelect).toHaveBeenLastCalledWith(0);

    handleListNavigation(key('ArrowUp'), 0, 3, onSelect);
    expect(onSelect).toHaveBeenLastCalledWith(2);

    handleListNavigation(key('Home'), 2, 3, onSelect);
    expect(onSelect).toHaveBeenLastCalledWith(0);

    handleListNavigation(key('End'), 0, 3, onSelect);
    expect(onSelect).toHaveBeenLastCalledWith(2);
  });

  it('activates with Enter or Space and ignores other keys', () => {
    const onSelect = jest.fn();
    const onActivate = jest.fn();

    handleListNavigation(key('Enter'), 1, 3, onSelect, onActivate);
    expect(onActivate).toHaveBeenLastCalledWith(1);

    handleListNavigation(key(' '), 1, 3, onSelect, onActivate);
    expect(onActivate).toHaveBeenLastCalledWith(1);

    handleListNavigation(key('Escape'), 1, 3, onSelect, onActivate);
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('skip link', () => {
  it('moves focus to the main content and keeps it programmatically focusable', () => {
    render(
      <main id="main-content">
        <h1>Content</h1>
      </main>,
    );

    skipToMainContent();

    const main = document.getElementById('main-content') as HTMLElement;
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});
