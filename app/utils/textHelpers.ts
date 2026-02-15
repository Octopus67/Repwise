/**
 * Strip markdown formatting from text and optionally truncate.
 *
 * Removes: headers (#), bold/italic (* _), links, code blocks,
 * blockquotes (>), and list markers (- * numbered).
 */
export function stripMarkdown(text: string | null | undefined, maxLength: number = 120): string {
  if (text == null) return '';
  if (text === '') return '';

  let result = text
    // Remove code blocks (fenced)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]*)`/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Replace links [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove headers (# ## ### etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s?/gm, '')
    // Remove bold/italic (*** ** * ___ __ _)
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove unordered list markers (- or * at line start)
    .replace(/^[\s]*[-*]\s+/gm, '')
    // Remove ordered list markers (1. 2. etc.)
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Collapse multiple newlines
    .replace(/\n{2,}/g, '\n')
    // Trim
    .trim()
    // Collapse multiple spaces
    .replace(/\s+/g, ' ');

  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + '...';
  }

  return result;
}
