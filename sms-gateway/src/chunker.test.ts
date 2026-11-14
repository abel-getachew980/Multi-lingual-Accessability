import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkMessage, isGsm7, maxLengthFor } from './chunker';

test('detects GSM-7 and UCS-2 text', () => {
  assert.equal(isGsm7('Hello, world! 123'), true);
  assert.equal(maxLengthFor('Hello'), 160);

  assert.equal(isGsm7('ሰላም ዓለም'), false);
  assert.equal(maxLengthFor('ሰላም ዓለም'), 70);
});

test('returns no chunks for empty input', () => {
  assert.deepEqual(chunkMessage(''), []);
  assert.deepEqual(chunkMessage('   \n  '), []);
});

test('keeps Latin answers inside the 160 character limit', () => {
  const words = Array.from({ length: 120 }, (_, index) => `word${index}`);
  const text = words.join(' ');
  const chunks = chunkMessage(text);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 160, `chunk was ${chunk.length} chars`);
  }
  assert.equal(chunks.join(' '), text);
});

test('keeps Amharic answers inside the 70 character limit', () => {
  const sentence = 'ሰላም ዓለም። ይህ የአማርኛ ትምህርት ነው። ';
  const text = sentence.repeat(5).trim();
  const chunks = chunkMessage(text);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(Array.from(chunk).length <= 70, `chunk was ${chunk.length} chars`);
  }
  assert.equal(chunks.join(' '), text);
});

test('hard-splits words that are longer than one segment', () => {
  const chunks = chunkMessage('a'.repeat(400));

  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [160, 160, 80],
  );
});

test('prefers word boundaries when splitting', () => {
  assert.deepEqual(chunkMessage('aaaa bbbb', 6), ['aaaa', 'bbbb']);
  assert.deepEqual(chunkMessage('aaaaaa bbbb', 6), ['aaaaaa', 'bbbb']);
  assert.deepEqual(chunkMessage('aaaa bbbbbb', 6), ['aaaa', 'bbbbbb']);
});

test('rejects invalid limits', () => {
  assert.throws(() => chunkMessage('hello', 0), RangeError);
  assert.throws(() => chunkMessage('hello', -5), RangeError);
});
