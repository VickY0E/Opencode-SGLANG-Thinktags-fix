const XML_PATTERN = new RegExp('<think>[\\s\\S]*</think>\\s*', 'g');

const MINIMAX_PATTERN = new RegExp('<\\|message\\|>[\\s\\S]*?<\\|message_end\\|>\\s*', 'g');

export function stripThinkTags(text: string, tagFormats: Array<'xml' | 'minimax'> = ['xml', 'minimax']): string {
  if (!text) return text ?? '';

  let result = text;

  if (tagFormats.includes('xml')) {
    result = result.replace(XML_PATTERN, '');
  }
  if (tagFormats.includes('minimax')) {
    result = result.replace(MINIMAX_PATTERN, '');
  }

  result = result.trim();

  return result;
}

export function countThinkTokens(text: string, tagFormats: Array<'xml' | 'minimax'> = ['xml', 'minimax']): number {
  if (!text) return 0;

  let totalChars = 0;

  if (tagFormats.includes('xml')) {
    const matches = text.matchAll(XML_PATTERN);
    for (const match of matches) {
      totalChars += match[0].trimEnd().length;
    }
  }
  if (tagFormats.includes('minimax')) {
    const matches = text.matchAll(MINIMAX_PATTERN);
    for (const match of matches) {
      totalChars += match[0].trimEnd().length;
    }
  }

  return Math.ceil(totalChars / 4);
}
