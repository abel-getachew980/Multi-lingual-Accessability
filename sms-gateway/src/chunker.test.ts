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

test('keeps menu lines intact when splitting', () => {
  const text = 'ሰላም!\nLANG AM - አማርኛ\nLANG EN - English\nHELP - የሰው እርዳታ';
  const chunks = chunkMessage(text, 40);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(Array.from(chunk).length <= 40, `chunk was ${chunk.length} chars`);
  }
  for (const line of text.split('\n')) {
    assert.ok(
      chunks.some((chunk) => chunk.includes(line)),
      `line was split across messages: ${line}`,
    );
  }
});

test('falls back to a space or line break when the line break wastes the segment', () => {
  assert.deepEqual(chunkMessage('ab\ncdefgh', 8), ['ab', 'cdefgh']);
  assert.deepEqual(chunkMessage('ab cdefgh', 8), ['ab', 'cdefgh']);
});

test('rejects invalid limits', () => {
  assert.throws(() => chunkMessage('hello', 0), RangeError);
  assert.throws(() => chunkMessage('hello', -5), RangeError);
});
