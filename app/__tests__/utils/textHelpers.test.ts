import { stripMarkdown } from '../../utils/textHelpers';

describe('stripMarkdown', () => {
  test('strips # Heading to Heading', () => {
    expect(stripMarkdown('# Heading')).toBe('Heading');
    expect(stripMarkdown('## Sub Heading')).toBe('Sub Heading');
    expect(stripMarkdown('### Third Level')).toBe('Third Level');
  });

  test('strips **bold** to bold', () => {
    expect(stripMarkdown('**bold**')).toBe('bold');
    expect(stripMarkdown('__bold__')).toBe('bold');
  });

  test('strips *italic* to italic', () => {
    expect(stripMarkdown('*italic*')).toBe('italic');
    expect(stripMarkdown('_italic_')).toBe('italic');
  });

  test('strips [link](url) to link', () => {
    expect(stripMarkdown('[click here](https://example.com)')).toBe('click here');
  });

  test('preserves plain text', () => {
    expect(stripMarkdown('Hello world')).toBe('Hello world');
  });

  test('truncates long text with ...', () => {
    const long = 'a'.repeat(200);
    const result = stripMarkdown(long, 120);
    expect(result).toBe('a'.repeat(120) + '...');
    expect(result.length).toBe(123);
  });

  test('does not truncate text at or under maxLength', () => {
    const exact = 'a'.repeat(120);
    expect(stripMarkdown(exact, 120)).toBe(exact);
  });

  test('handles empty string', () => {
    expect(stripMarkdown('')).toBe('');
  });

  test('handles null/undefined gracefully', () => {
    expect(stripMarkdown(null as any)).toBe('');
    expect(stripMarkdown(undefined as any)).toBe('');
  });

  test('strips blockquotes', () => {
    expect(stripMarkdown('> quoted text')).toBe('quoted text');
  });

  test('strips list markers', () => {
    expect(stripMarkdown('- item one')).toBe('item one');
    expect(stripMarkdown('* item two')).toBe('item two');
    expect(stripMarkdown('1. item three')).toBe('item three');
  });

  test('strips code blocks and inline code', () => {
    expect(stripMarkdown('`inline code`')).toBe('inline code');
    expect(stripMarkdown('```\ncode block\n```')).toBe('');
  });
});
