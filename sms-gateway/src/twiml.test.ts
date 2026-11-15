import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTwiml, escapeXml } from './twiml';

test('escapes XML-sensitive characters', () => {
  assert.equal(
    escapeXml('AT&T <test> "quoted" \'single\''),
    'AT&amp;T &lt;test&gt; &quot;quoted&quot; &apos;single&apos;',
  );
});

test('returns an empty TwiML response when there is nothing to send', () => {
  assert.match(buildTwiml([]), /<Response><\/Response>$/);
});

test('renders one Message element per segment', () => {
  const xml = buildTwiml(['First <answer>', 'Second & final']);

  assert.match(xml, /<Message>First &lt;answer&gt;<\/Message>/);
  assert.match(xml, /<Message>Second &amp; final<\/Message>/);
  assert.equal(xml.match(/<Message>/g)?.length, 2);
});

test('ignores blank segments', () => {
  const xml = buildTwiml(['', '   ']);
  assert.doesNotMatch(xml, /<Message>/);
});
