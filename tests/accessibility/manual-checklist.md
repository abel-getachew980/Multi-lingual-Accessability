# Manual accessibility checklist

The automated suite (`npm run test:a11y`) catches structure, contrast and
keyboard logic. It cannot hear a screen reader, see a 200% zoomed layout, or
notice that a recorded voice note never actually played. Run this checklist
before a demo and after any change to layout, colour or dialog behaviour.

Record the date, the browser/OS, and the assistive technology version next to
each run. A checked box means the result was observed, not assumed.

## 1. Screen reader — NVDA on Windows

Setup: NVDA 2024 or newer, Chrome or Firefox, app in English.

- [ ] Load `/`. NVDA announces the page title and the main landmark.
- [ ] The skip link is the first Tab stop; activating it moves focus to the chat
      region and NVDA reads "Chat conversation".
- [ ] The message list is announced as a list/log; a new answer is announced
      once, not letter by letter.
- [ ] Typing a question and pressing Enter reads the learner message and the
      typing indicator without stealing focus from the textarea.
- [ ] Opening Settings announces the dialog name, reads the first control, and
      warns that focus is trapped.
- [ ] Tab and Shift+Tab cycle only through Settings controls; Escape closes it
      and focus returns to the gear button.
- [ ] Each radio/checkbox group is preceded by its legend ("Language",
      "Text size", "Accessibility").
- [ ] Changing text size or high contrast is confirmed by a live-region
      message, not only by a visual change.
- [ ] Requesting human help says "requesting", then the queue position only
      after the API confirms. A failed request is read as an error.
- [ ] While waiting for a tutor, queue changes are announced politely and do
      not interrupt typing.

## 2. Screen reader — TalkBack on Android

Setup: TalkBack, Chrome, a mid-range phone, portrait and landscape.

- [ ] Swipe order follows the visual order: header, messages, input, actions.
- [ ] Buttons announce their name and state ("Settings, button, collapsed").
- [ ] The 44px minimum touch targets are reachable without mis-taps.
- [ ] The on-screen keyboard does not cover the textarea or send button.
- [ ] Rotating the phone keeps the layout usable; the app is not locked to
      portrait.
- [ ] A voice note records, transcribes and answers, with a spoken error when
      the microphone permission is denied.
- [ ] With the screen reader on, notification sounds are supplementary; every
      event also has text or a status role.

## 3. Keyboard only

Setup: unplug the mouse, start at the browser address bar.

- [ ] Tab reaches every control; there are no keyboard traps outside dialogs.
- [ ] The focus ring is always visible and at least 3:1 against its background.
- [ ] Enter sends a message; Shift+Enter inserts a newline; Escape closes open
      dialogs.
- [ ] The clear button returns focus to the textarea.
- [ ] The message list can be scrolled with Page Up/Page Down and arrow keys
      once it has focus.
- [ ] No action requires a drag, hover, or a right-click.

## 4. 200% and 400% zoom / reflow

Setup: Chrome, zoom the page (Ctrl + plus) to 200%, then 400%.

- [ ] No horizontal scrollbar appears at 200% at a 1280px window, or at 400% at
      320 CSS pixels (WCAG 1.4.10).
- [ ] Header controls wrap instead of overlapping; the settings label may hide
      on narrow screens but its accessible name is unchanged.
- [ ] Message bubbles grow taller instead of clipping text.
- [ ] Long unbroken URLs and Amharic strings wrap inside bubbles.
- [ ] Dialogs stay inside the viewport and scroll internally when taller than
      the screen.
- [ ] Text remains readable at every step; no fixed pixel font sizes shrink
      relative to the page.

## 5. Contrast and colour

Setup: browser DevTools accessibility pane, or a contrast checker on the
computed colours.

- [ ] Body text on white and on the surface colour is at least 4.5:1.
- [ ] Secondary text (timestamps, hints) is at least 4.5:1.
- [ ] White text on primary, success, warning and error fills is at least 4.5:1.
- [ ] Input and button borders are at least 3:1 against their background.
- [ ] The focus ring is at least 3:1 against both the page and the control.
- [ ] High contrast mode keeps black text on white and does not rely on colour
      alone for status: offline, help active, recording and errors all include
      text.
- [ ] Colour is never the only signal; error text and icons both change.

## 6. Reduced motion and sound off

- [ ] OS "reduce motion" makes animations and smooth scrolling effectively
      instant.
- [ ] Settings → Reduce motion does the same without restarting the app.
- [ ] With the device muted, every sound cue has a visible counterpart: typing
      indicator, error banner, queue status, recording state.
- [ ] Notification sound plays at a quiet volume and never overlaps speech
      recognition.

## 7. Amharic and RTL text

- [ ] Switch to አማርኛ: menus, buttons, errors and help copy are translated; no
      English placeholder remains.
- [ ] Ethiopic glyphs render with the self-hosted Noto Sans Ethiopic font, with
      no missing-glyph boxes.
- [ ] Chat bubbles align to the right in Amharic and left in English.
- [ ] Screen readers pronounce Amharic text with an Amharic voice when one is
      installed; the page declares `lang="am"`.
- [ ] Switching language keeps the conversation readable and clears or relabels
      language-specific history as documented.

## 8. Offline and low bandwidth

- [ ] Load the app once, then go offline (DevTools → Network → Offline).
- [ ] Reload: the shell and the offline page appear; no blank screen.
- [ ] Previously stored messages and preferences are still available.
- [ ] Sending a question offline queues or explains the failure honestly; it
      never shows a fabricated answer.
- [ ] When the connection returns, queued messages send once, without
      duplicates.
- [ ] On a throttled "Slow 3G" profile, the first screen is usable before the
      rest of the app finishes loading.
- [ ] No request goes to Google Fonts or another third-party CDN.

## 9. Human help and screen sharing

- [ ] Requesting help is explicit: nothing is sent until the learner confirms.
- [ ] The queue position and estimated wait come from the API; a failure shows
      an error and no ticket.
- [ ] Screen sharing asks for permission in the browser and can be stopped from
      the dialog and from the browser's own indicator.
- [ ] A second request while a ticket is open is refused with an explanation.
- [ ] Cancelling removes the ticket and is confirmed in text.
- [ ] A tutor disconnect is reported; the learner is not left on a fake
      "connected" screen.

## 10. Sign-off

| Field | Value |
|---|---|
| Date | |
| Build / commit | |
| Browser and OS | |
| Screen reader and version | |
| Zoom levels tested | |
| Tester | |
| Open issues | |
